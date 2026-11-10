//! Dados de exemplo para abrir o app sem conta (`vitral.exe --demo`).

use crate::model::{Collection, Kind, ListData, ListKey, Track};

fn t(id: &str, name: &str, artists: &str, album: &str, secs: u32, added: &str) -> Track {
    Track {
        id: id.into(),
        uri: format!("spotify:track:{id}"),
        name: name.into(),
        artists: artists.into(),
        album: album.into(),
        duration_ms: secs * 1000,
        image_small: None,
        image_large: None,
        added_at: Some(added.into()),
    }
}

pub fn tracks() -> Vec<Track> {
    vec![
        t("demo01", "Midnight City", "M83", "Hurry Up, We're Dreaming", 243, "2026-01-12"),
        t("demo02", "Redbone", "Childish Gambino", "\"Awaken, My Love!\"", 326, "2026-02-03"),
        t("demo03", "Blinding Lights", "The Weeknd", "After Hours", 200, "2026-03-21"),
        t("demo04", "Let It Happen", "Tame Impala", "Currents", 467, "2026-04-08"),
        t("demo05", "Get Lucky", "Daft Punk", "Random Access Memories", 369, "2026-05-15"),
        t("demo06", "Do I Wanna Know?", "Arctic Monkeys", "AM", 272, "2026-06-02"),
        t("demo07", "Construção", "Chico Buarque", "Construção", 384, "2026-07-19"),
        t("demo08", "Águas de Março", "Elis Regina, Tom Jobim", "Elis & Tom", 212, "2026-08-27"),
        t("demo09", "Take Five", "The Dave Brubeck Quartet", "Time Out", 324, "2026-09-09"),
        t("demo10", "Chega de Saudade", "João Gilberto", "Chega de Saudade", 119, "2026-10-01"),
    ]
}

pub fn playlists() -> Vec<Collection> {
    ["Madrugada", "Noite de estudos", "MPB de domingo", "Rock no carro", "Foco total"]
        .iter()
        .enumerate()
        .map(|(i, n)| Collection {
            kind: Kind::Playlist,
            id: format!("demo-pl-{i}"),
            name: n.to_string(),
            subtitle: "Playlist • Gabriel".into(),
            image: None,
        })
        .collect()
}

pub fn albums() -> Vec<Collection> {
    tracks()
        .iter()
        .take(6)
        .map(|t| Collection {
            kind: Kind::Album,
            id: format!("demo-al-{}", t.id),
            name: t.album.clone(),
            subtitle: format!("Álbum • {}", t.artists),
            image: None,
        })
        .collect()
}

pub fn artists() -> Vec<Collection> {
    ["M83", "Tame Impala", "Chico Buarque", "Elis Regina", "Daft Punk", "The Weeknd"]
        .iter()
        .enumerate()
        .map(|(i, n)| Collection {
            kind: Kind::Artist,
            id: format!("demo-ar-{i}"),
            name: n.to_string(),
            subtitle: "Artista".into(),
            image: None,
        })
        .collect()
}

pub fn list(key: &ListKey) -> ListData {
    let all = tracks();
    let (title, kind, desc, tracks): (String, &str, &str, Vec<Track>) = match key {
        ListKey::Liked => ("Músicas curtidas".into(), "Playlist", "Tudo que você curtiu, num lugar só.", all.iter().step_by(2).cloned().collect()),
        ListKey::Playlist(id) => {
            let name = playlists().into_iter().find(|p| &p.id == id).map(|p| p.name).unwrap_or_default();
            (name, "Playlist", "Synth, neon e fone de ouvido.", all.clone())
        }
        ListKey::Album(id) => {
            let name = albums().into_iter().find(|p| &p.id == id).map(|p| p.name).unwrap_or_default();
            (name, "Álbum", "", all.iter().take(3).cloned().collect())
        }
        ListKey::Artist(id) => {
            let name = artists().into_iter().find(|p| &p.id == id).map(|p| p.name).unwrap_or_default();
            (name, "Artista • músicas populares", "", all.iter().take(5).cloned().collect())
        }
    };
    ListData {
        kind_label: kind.into(),
        title,
        owner: "Gabriel".into(),
        description: desc.into(),
        image: None,
        total: tracks.len() as u32,
        tracks,
        complete: true,
    }
}
