//! Login com a conta do Spotify (OAuth no navegador) e renovação do token.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use librespot_core::config::SessionConfig;
use librespot_oauth::{OAuthClient, OAuthClientBuilder, OAuthToken};
use serde::{Deserialize, Serialize};

use crate::settings::data_dir;

/// Porta local que recebe a resposta do login no navegador.
const REDIRECT_URI: &str = "http://127.0.0.1:8898/login";

/// Permissões pedidas (as mesmas que o app oficial de desktop usa).
const SCOPES: &[&str] = &[
    "streaming",
    "user-read-private",
    "user-read-email",
    "user-library-read",
    "user-library-modify",
    "playlist-read",
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify",
    "playlist-modify-private",
    "playlist-modify-public",
    "user-follow-read",
    "user-follow-modify",
    "user-read-recently-played",
    "user-top-read",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "user-read-playback-position",
    "user-personalized",
    "app-remote-control",
];

const DONE_PAGE: &str = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Vitral</title></head>\
<body style=\"margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#16181C;color:#F2F3F5;font-family:system-ui,sans-serif\">\
<div style=\"text-align:center\"><h1 style=\"margin:0 0 8px\">Pronto!</h1><p style=\"margin:0;color:#A2A5AB\">Pode fechar esta aba e voltar pro Vitral.</p></div></body></html>";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Tokens {
    pub access_token: String,
    pub refresh_token: String,
    /// Segundos desde 1970.
    pub expires_at: u64,
}

impl Tokens {
    fn from_oauth(t: OAuthToken, old_refresh: Option<&str>) -> Self {
        let left = t.expires_at.saturating_duration_since(std::time::Instant::now());
        let refresh = if t.refresh_token.is_empty() {
            old_refresh.unwrap_or_default().to_string()
        } else {
            t.refresh_token
        };
        Self {
            access_token: t.access_token,
            refresh_token: refresh,
            expires_at: now() + left.as_secs(),
        }
    }

    pub fn expires_soon(&self) -> bool {
        now() + 120 >= self.expires_at
    }
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

fn token_path() -> std::path::PathBuf {
    data_dir().join("auth.json")
}

pub fn client_id() -> String {
    SessionConfig::default().client_id
}

fn oauth_client() -> Result<OAuthClient, String> {
    OAuthClientBuilder::new(&client_id(), REDIRECT_URI, SCOPES.to_vec())
        .open_in_browser()
        .with_custom_message(DONE_PAGE)
        .build()
        .map_err(|e| format!("Não consegui preparar o login: {e}"))
}

pub fn load_saved() -> Option<Tokens> {
    let text = std::fs::read_to_string(token_path()).ok()?;
    serde_json::from_str(&text).ok()
}

pub fn save(tokens: &Tokens) {
    if let Ok(text) = serde_json::to_string(tokens) {
        if let Err(e) = std::fs::write(token_path(), text) {
            log::warn!("não consegui salvar o login: {e}");
        }
    }
}

pub fn forget() {
    let _ = std::fs::remove_file(token_path());
    let _ = std::fs::remove_file(data_dir().join("credentials.json"));
}

/// Abre o navegador na página de login do Spotify e espera a resposta.
pub async fn login_in_browser() -> Result<Tokens, String> {
    tokio::task::spawn_blocking(|| {
        let client = oauth_client()?;
        let token = client
            .get_access_token()
            .map_err(|e| format!("O login não terminou: {e}"))?;
        Ok(Tokens::from_oauth(token, None))
    })
    .await
    .map_err(|e| format!("O login travou: {e}"))?
}

pub async fn refresh(old: &Tokens) -> Result<Tokens, String> {
    let client = oauth_client()?;
    let token = client
        .refresh_token_async(&old.refresh_token)
        .await
        .map_err(|e| format!("Não consegui renovar o login: {e}"))?;
    Ok(Tokens::from_oauth(token, Some(&old.refresh_token)))
}
