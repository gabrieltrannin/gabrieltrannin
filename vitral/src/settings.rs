//! Configurações salvas em disco e pasta de dados do app.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::model::UpdateMode;

/// Pasta onde o Vitral guarda login, configurações, cache e log.
/// Windows: %APPDATA%\Vitral. Outros sistemas: ~/.config/vitral.
pub fn data_dir() -> PathBuf {
    let base = if cfg!(windows) {
        std::env::var_os("APPDATA").map(PathBuf::from)
    } else {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))
    };
    let dir = base
        .unwrap_or_else(std::env::temp_dir)
        .join(if cfg!(windows) { "Vitral" } else { "vitral" });
    let _ = std::fs::create_dir_all(&dir);
    dir
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// 96, 160 ou 320 kbps.
    pub quality: u16,
    pub normalize: bool,
    /// 0.0 a 1.0
    pub volume: f32,
    pub accent: [u8; 3],
    pub check_updates: bool,
    pub update_mode: UpdateMode,
    pub show_queue: bool,
    pub recent_searches: Vec<String>,
    pub skipped_version: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            quality: 320,
            normalize: false,
            volume: 0.7,
            accent: [0x36, 0xD6, 0x7A],
            check_updates: true,
            update_mode: UpdateMode::Ask,
            show_queue: true,
            recent_searches: Vec::new(),
            skipped_version: None,
        }
    }
}

impl Settings {
    fn path() -> PathBuf {
        data_dir().join("settings.json")
    }

    pub fn load() -> Self {
        std::fs::read_to_string(Self::path())
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self) {
        if let Ok(s) = serde_json::to_string_pretty(self) {
            if let Err(e) = std::fs::write(Self::path(), s) {
                log::warn!("não consegui salvar as configurações: {e}");
            }
        }
    }
}
