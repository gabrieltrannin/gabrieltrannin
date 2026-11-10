//! Acesso à Web API do Spotify (biblioteca, playlists, busca, curtidas).

use std::sync::Arc;
use std::time::Duration;

use reqwest::{Method, StatusCode};
use serde_json::Value;
use tokio::sync::Mutex;

use crate::auth::{self, Tokens};
use crate::model::{Collection, Kind, ListData, SearchResults, Track, UserInfo};

const BASE: &str = "https://api.spotify.com/v1";

#[derive(Clone)]
pub struct Api {
    http: reqwest::Client,
    tokens: Arc<Mutex<Tokens>>,
}

#[derive(Debug)]
pub enum ApiError {
    Status(u16, String),
    Net(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiError::Status(code, msg) => write!(f, "Spotify respondeu {code}: {msg}"),
            ApiError::Net(e) => write!(f, "Sem conexão com o Spotify: {e}"),
        }
    }
}

type Res<T> = Result<T, ApiError>;

impl Api {
    pub fn new(tokens: Tokens) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .unwrap_or_default();
        Self { http, tokens: Arc::new(Mutex::new(tokens)) }
    }

    pub async fn access_token(&self) -> Res<String> {
        let mut t = self.tokens.lock().await;
        if t.expires_soon() {
            let fresh = auth::refresh(&t).await.map_err(ApiError::Net)?;
            auth::save(&fresh);
            *t = fresh;
        }
        Ok(t.access_token.clone())
    }

    async fn force_refresh(&self) -> Res<()> {
        let mut t = self.tokens.lock().await;
        let fresh = auth::refresh(&t).await.map_err(ApiError::Net)?;
        auth::save(&fresh);
        *t = fresh;
        Ok(())
    }

    async fn call(&self, method: Method, url: &str, body: Option<Value>) -> Res<Value> {
        let full = if url.starts_with("http") { url.to_string() } else { format!("{BASE}{url}") };
        let mut refreshed = false;
        let mut waits = 0;
        loop {
            let token = self.access_token().await?;
            let mut req = self.http.request(method.clone(), &full).bearer_auth(&token);
            if let Some(b) = &body {
                req = req.json(b);
            } else if method == Method::PUT || method == Method::DELETE {
                req = req.header("Content-Length", "0");
            }
            let resp = req.send().await.map_err(|e| ApiError::Net(e.to_string()))?;
            let status = resp.status();
            if status == StatusCode::UNAUTHORIZED && !refreshed {
                refreshed = true;
                self.force_refresh().await?;
                continue;
            }
            if status == StatusCode::TOO_MANY_REQUESTS && waits < 3 {
                waits += 1;
                let secs = resp
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(2)
                    .min(30);
                tokio::time::sleep(Duration::from_secs(secs)).await;
                continue;
            }
            let text = resp.text().await.unwrap_or_default();
            if !status.is_success() {
                let msg = serde_json::from_str::<Value>(&text)
                    .ok()
                    .and_then(|v| v["error"]["message"].as_str().map(str::to_string))
                    .unwrap_or_else(|| text.chars().take(200).collect());
                return Err(ApiError::Status(status.as_u16(), msg));
            }
            if text.trim().is_empty() {
                return Ok(Value::Null);
            }
            return serde_json::from_str(&text).map_err(|e| ApiError::Net(e.to_string()));
        }
    }

    async fn get(&self, url: &str) -> Res<Value> {
        self.call(Method::GET, url, None).await
    }

    pub async fn me(&self) -> Res<UserInfo> {
        let v = self.get("/me").await?;
        Ok(UserInfo {
            id: s(&v["id"]),
            name: v["display_name"].as_str().filter(|n| !n.is_empty()).map(str::to_string).unwrap_or_else(|| s(&v["id"])),
        })
    }

    pub async fn my_playlists(&self) -> Res<Vec<Collection>> {
        let mut out = Vec::new();
        let mut url = Some("/me/playlists?limit=50".to_string());
        while let Some(u) = url {
            let v = self.get(&u).await?;
            for p in v["items"].as_array().into_iter().flatten() {
                if p.is_null() {
                    continue;
                }
                out.push(Collection {
                    kind: Kind::Playlist,
                    id: s(&p["id"]),
                    name: s(&p["name"]),
                    subtitle: format!("Playlist • {}", p["owner"]["display_name"].as_str().unwrap_or("")),
                    image: pick_image(&p["images"], true),
                });
            }
            url = v["next"].as_str().map(str::to_string);
            if out.len() >= 1000 {
                break;
            }
        }
        Ok(out)
    }

    pub async fn saved_albums(&self) -> Res<Vec<Collection>> {
        let mut out = Vec::new();
        let mut url = Some("/me/albums?limit=50".to_string());
        while let Some(u) = url {
            let v = self.get(&u).await?;
            for it in v["items"].as_array().into_iter().flatten() {
                let a = &it["album"];
                out.push(Collection {
                    kind: Kind::Album,
                    id: s(&a["id"]),
                    name: s(&a["name"]),
                    subtitle: format!("Álbum • {}", artists(&a["artists"])),
                    image: pick_image(&a["images"], true),
                });
            }
            url = v["next"].as_str().map(str::to_string);
            if out.len() >= 500 {
                break;
            }
        }
        Ok(out)
    }

    pub async fn followed_artists(&self) -> Res<Vec<Collection>> {
        let mut out = Vec::new();
        let mut url = Some("/me/following?type=artist&limit=50".to_string());
        while let Some(u) = url {
            let v = self.get(&u).await?;
            let block = &v["artists"];
            for a in block["items"].as_array().into_iter().flatten() {
                out.push(artist_collection(a));
            }
            url = block["next"].as_str().map(str::to_string);
            if out.len() >= 500 {
                break;
            }
        }
        Ok(out)
    }

    pub async fn recently_played(&self) -> Res<Vec<Track>> {
        let v = self.get("/me/player/recently-played?limit=30").await?;
        let mut out: Vec<Track> = Vec::new();
        for it in v["items"].as_array().into_iter().flatten() {
            if let Some(t) = parse_track(&it["track"], None, None) {
                if !out.iter().any(|x| x.id == t.id) {
                    out.push(t);
                }
            }
        }
        Ok(out)
    }

    pub async fn top_artists(&self) -> Res<Vec<Collection>> {
        let v = self.get("/me/top/artists?limit=12&time_range=medium_term").await?;
        Ok(v["items"].as_array().into_iter().flatten().map(artist_collection).collect())
    }

    /// Primeira página das músicas curtidas. Retorna (dados, próxima url).
    pub async fn liked_first(&self) -> Res<(ListData, Option<String>)> {
        let v = self.get("/me/tracks?limit=50").await?;
        let tracks = saved_tracks(&v);
        Ok((
            ListData {
                kind_label: "Playlist".into(),
                title: "Músicas curtidas".into(),
                owner: String::new(),
                description: "Tudo que você curtiu, num lugar só.".into(),
                image: None,
                total: v["total"].as_u64().unwrap_or(tracks.len() as u64) as u32,
                tracks,
                complete: v["next"].is_null(),
            },
            v["next"].as_str().map(str::to_string),
        ))
    }

    pub async fn playlist_first(&self, id: &str) -> Res<(ListData, Option<String>)> {
        let v = self.get(&format!("/playlists/{id}")).await?;
        // O Spotify renomeou "tracks" para "items" em alguns casos; aceita os dois.
        let block = if v["tracks"].is_object() { &v["tracks"] } else { &v["items"] };
        let mut tracks = saved_tracks(block);
        let mut next = block["next"].as_str().map(str::to_string);
        let total = block["total"].as_u64().unwrap_or(0) as u32;
        if tracks.is_empty() && total > 0 {
            // Alguns retornos vêm sem as faixas: busca a primeira página separada.
            match self.get(&format!("/playlists/{id}/tracks?limit=100")).await {
                Ok(p) => {
                    tracks = saved_tracks(&p);
                    next = p["next"].as_str().map(str::to_string);
                }
                Err(_) => {
                    let p = self.get(&format!("/playlists/{id}/items?limit=100")).await?;
                    tracks = saved_tracks(&p);
                    next = p["next"].as_str().map(str::to_string);
                }
            }
        }
        Ok((
            ListData {
                kind_label: "Playlist".into(),
                title: s(&v["name"]),
                owner: v["owner"]["display_name"].as_str().unwrap_or("").to_string(),
                description: strip_html(v["description"].as_str().unwrap_or("")),
                image: pick_image(&v["images"], false),
                total: total.max(tracks.len() as u32),
                complete: next.is_none(),
                tracks,
            },
            next,
        ))
    }

    pub async fn album_first(&self, id: &str) -> Res<(ListData, Option<String>)> {
        let v = self.get(&format!("/albums/{id}")).await?;
        let small = pick_image(&v["images"], true);
        let large = pick_image(&v["images"], false);
        let album_name = s(&v["name"]);
        let block = &v["tracks"];
        let tracks: Vec<Track> = block["items"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|t| {
                let mut tr = parse_track(t, small.clone(), large.clone())?;
                tr.album = album_name.clone();
                Some(tr)
            })
            .collect();
        let next = block["next"].as_str().map(str::to_string);
        let year = v["release_date"].as_str().unwrap_or("").get(0..4).unwrap_or("").to_string();
        Ok((
            ListData {
                kind_label: if year.is_empty() { "Álbum".into() } else { format!("Álbum • {year}") },
                title: album_name,
                owner: artists(&v["artists"]),
                description: String::new(),
                image: large,
                total: block["total"].as_u64().unwrap_or(tracks.len() as u64) as u32,
                complete: next.is_none(),
                tracks,
            },
            next,
        ))
    }

    /// Página seguinte de uma lista (curtidas, playlist ou álbum).
    pub async fn next_page(&self, url: &str, album: Option<(&str, Option<String>, Option<String>)>) -> Res<(Vec<Track>, Option<String>)> {
        let v = self.get(url).await?;
        let tracks = match album {
            Some((name, small, large)) => v["items"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|t| {
                    let mut tr = parse_track(t, small.clone(), large.clone())?;
                    tr.album = name.to_string();
                    Some(tr)
                })
                .collect(),
            None => saved_tracks(&v),
        };
        Ok((tracks, v["next"].as_str().map(str::to_string)))
    }

    pub async fn artist(&self, id: &str) -> Res<ListData> {
        let a = self.get(&format!("/artists/{id}")).await?;
        let name = s(&a["name"]);
        let tracks = match self.get(&format!("/artists/{id}/top-tracks?market=from_token")).await {
            Ok(v) => v["tracks"].as_array().into_iter().flatten().filter_map(|t| parse_track(t, None, None)).collect(),
            Err(_) => {
                // Plano B: busca pelas músicas do artista.
                let q = encode(&format!("artist:\"{name}\""));
                let v = self.get(&format!("/search?q={q}&type=track&limit=10")).await?;
                v["tracks"]["items"].as_array().into_iter().flatten().filter_map(|t| parse_track(t, None, None)).collect()
            }
        };
        let tracks: Vec<Track> = tracks;
        Ok(ListData {
            kind_label: "Artista • músicas populares".into(),
            title: name,
            owner: String::new(),
            description: String::new(),
            image: pick_image(&a["images"], false),
            total: tracks.len() as u32,
            tracks,
            complete: true,
        })
    }

    pub async fn search(&self, query: &str) -> Res<SearchResults> {
        let q = encode(query);
        let v = self.get(&format!("/search?q={q}&type=track,artist,album,playlist&limit=10")).await?;
        let tracks = v["tracks"]["items"].as_array().into_iter().flatten().filter_map(|t| parse_track(t, None, None)).collect();
        let artist_list = v["artists"]["items"].as_array().into_iter().flatten().filter(|a| !a.is_null()).map(artist_collection).collect();
        let albums = v["albums"]["items"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|a| !a.is_null())
            .map(|a| Collection {
                kind: Kind::Album,
                id: s(&a["id"]),
                name: s(&a["name"]),
                subtitle: artists(&a["artists"]),
                image: pick_image(&a["images"], false),
            })
            .collect();
        let playlists = v["playlists"]["items"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|p| !p.is_null())
            .map(|p| Collection {
                kind: Kind::Playlist,
                id: s(&p["id"]),
                name: s(&p["name"]),
                subtitle: format!("De {}", p["owner"]["display_name"].as_str().unwrap_or("")),
                image: pick_image(&p["images"], false),
            })
            .collect();
        Ok(SearchResults { query: query.to_string(), tracks, artists: artist_list, albums, playlists })
    }

    pub async fn contains(&self, ids: &[String]) -> Res<Vec<bool>> {
        let joined = ids.join(",");
        match self.get(&format!("/me/tracks/contains?ids={joined}")).await {
            Ok(v) => Ok(v.as_array().into_iter().flatten().map(|b| b.as_bool().unwrap_or(false)).collect()),
            Err(_) => {
                let uris: Vec<String> = ids.iter().map(|i| format!("spotify:track:{i}")).collect();
                let v = self.get(&format!("/me/library/contains?uris={}", encode(&uris.join(",")))).await?;
                Ok(v.as_array().into_iter().flatten().map(|b| b.as_bool().unwrap_or(false)).collect())
            }
        }
    }

    pub async fn set_liked(&self, id: &str, liked: bool) -> Res<()> {
        let method = if liked { Method::PUT } else { Method::DELETE };
        match self.call(method.clone(), &format!("/me/tracks?ids={id}"), None).await {
            Ok(_) => Ok(()),
            Err(_) => {
                let uri = encode(&format!("spotify:track:{id}"));
                self.call(method, &format!("/me/library?uris={uri}"), None).await.map(|_| ())
            }
        }
    }
}

fn s(v: &Value) -> String {
    v.as_str().unwrap_or_default().to_string()
}

fn artists(v: &Value) -> String {
    v.as_array()
        .into_iter()
        .flatten()
        .filter_map(|a| a["name"].as_str())
        .collect::<Vec<_>>()
        .join(", ")
}

/// Escolhe a menor imagem com pelo menos 60 px (small) ou a de ~300 px (large).
fn pick_image(v: &Value, small: bool) -> Option<String> {
    let mut imgs: Vec<(u64, String)> = v
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|i| Some((i["width"].as_u64().unwrap_or(300), i["url"].as_str()?.to_string())))
        .collect();
    if imgs.is_empty() {
        return None;
    }
    imgs.sort_by_key(|(w, _)| *w);
    let target = if small { 60 } else { 280 };
    imgs.iter()
        .find(|(w, _)| *w >= target)
        .or_else(|| imgs.last())
        .map(|(_, u)| u.clone())
}

fn artist_collection(a: &Value) -> Collection {
    Collection {
        kind: Kind::Artist,
        id: s(&a["id"]),
        name: s(&a["name"]),
        subtitle: "Artista".into(),
        image: pick_image(&a["images"], false),
    }
}

pub fn parse_track(t: &Value, small: Option<String>, large: Option<String>) -> Option<Track> {
    if t.is_null() || t["is_local"].as_bool() == Some(true) {
        return None;
    }
    if let Some(kind) = t["type"].as_str() {
        if kind != "track" {
            return None;
        }
    }
    let id = t["id"].as_str()?.to_string();
    Some(Track {
        uri: t["uri"].as_str().map(str::to_string).unwrap_or_else(|| format!("spotify:track:{id}")),
        id,
        name: s(&t["name"]),
        artists: artists(&t["artists"]),
        album: s(&t["album"]["name"]),
        duration_ms: t["duration_ms"].as_u64().unwrap_or(0) as u32,
        image_small: pick_image(&t["album"]["images"], true).or(small),
        image_large: pick_image(&t["album"]["images"], false).or(large),
        added_at: None,
    })
}

/// Lê uma página de itens salvos ({ added_at, track|item }).
fn saved_tracks(v: &Value) -> Vec<Track> {
    v["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|it| {
            let inner = if it["track"].is_object() { &it["track"] } else { &it["item"] };
            let mut t = parse_track(inner, None, None)?;
            t.added_at = it["added_at"].as_str().and_then(|d| d.get(0..10)).map(str::to_string);
            Some(t)
        })
        .collect()
}

fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.replace("&amp;", "&")
        .replace("&#x27;", "'")
        .replace("&#39;", "'")
        .replace("&quot;", "\"")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

/// Codifica texto para usar numa URL.
pub fn encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
