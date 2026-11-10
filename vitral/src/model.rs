//! Tipos compartilhados entre a interface (app.rs) e o motor (backend.rs).

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Track {
    /// ID base62 do Spotify.
    pub id: String,
    pub uri: String,
    pub name: String,
    pub artists: String,
    pub album: String,
    pub duration_ms: u32,
    /// Capa pequena (~64 px).
    pub image_small: Option<String>,
    /// Capa grande (~300 px).
    pub image_large: Option<String>,
    /// Data em que entrou na playlist/biblioteca, formato AAAA-MM-DD.
    pub added_at: Option<String>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum Kind {
    #[default]
    Playlist,
    Album,
    Artist,
}

/// Resumo de uma playlist, álbum ou artista (biblioteca, busca).
#[derive(Clone, Debug, Default)]
pub struct Collection {
    pub kind: Kind,
    pub id: String,
    pub name: String,
    pub subtitle: String,
    pub image: Option<String>,
}

impl Collection {
    pub fn key(&self) -> ListKey {
        match self.kind {
            Kind::Playlist => ListKey::Playlist(self.id.clone()),
            Kind::Album => ListKey::Album(self.id.clone()),
            Kind::Artist => ListKey::Artist(self.id.clone()),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum ListKey {
    Liked,
    Playlist(String),
    Album(String),
    Artist(String),
}

/// Conteúdo de uma lista aberta (playlist, álbum, curtidas, artista).
#[derive(Clone, Debug, Default)]
pub struct ListData {
    pub kind_label: String,
    pub title: String,
    pub owner: String,
    pub description: String,
    pub image: Option<String>,
    pub tracks: Vec<Track>,
    pub total: u32,
    pub complete: bool,
}

#[derive(Clone, Debug, Default)]
pub struct SearchResults {
    pub query: String,
    pub tracks: Vec<Track>,
    pub artists: Vec<Collection>,
    pub albums: Vec<Collection>,
    pub playlists: Vec<Collection>,
}

#[derive(Clone, Debug, Default)]
pub struct UserInfo {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug)]
pub struct UpdateInfo {
    pub version: String,
    pub notes: String,
    pub url: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum UpdateMode {
    #[default]
    Ask,
    Auto,
}

/// Pedidos da interface para o motor.
#[derive(Debug)]
pub enum Cmd {
    Login,
    Logout,
    OpenList(ListKey),
    Search(String),
    Load { uri: String, play: bool, position_ms: u32 },
    Preload(String),
    Play,
    Pause,
    Seek(u32),
    Volume(f32),
    SetLiked { id: String, liked: bool },
    CheckLiked(Vec<String>),
    FetchImage { url: String, size: u32 },
    ApplyAudio { quality: u16, normalize: bool },
    CheckUpdate { manual: bool },
    DownloadUpdate(UpdateInfo),
    RestartForUpdate,
}

#[derive(Debug)]
pub enum PlayerEv {
    Loading { uri: String },
    Playing { uri: String, position_ms: u32 },
    Paused { uri: String, position_ms: u32 },
    Position { uri: String, position_ms: u32 },
    EndOfTrack { uri: String },
    Unavailable { uri: String },
    PreloadNext,
    Stopped,
}

#[derive(Debug)]
pub enum UpdateEv {
    UpToDate { manual: bool },
    Available(UpdateInfo),
    Progress(f32),
    Ready,
    Failed(String),
}

/// Respostas do motor para a interface.
#[derive(Debug)]
pub enum Ev {
    NeedLogin,
    LoggingIn,
    LoggedIn(UserInfo),
    LoggedOut,
    Library {
        playlists: Vec<Collection>,
        albums: Vec<Collection>,
        artists: Vec<Collection>,
    },
    Home {
        recent: Vec<Track>,
        top_artists: Vec<Collection>,
    },
    List { key: ListKey, data: ListData },
    ListMore { key: ListKey, tracks: Vec<Track>, complete: bool },
    ListFailed { key: ListKey, msg: String },
    Search(SearchResults),
    Liked(Vec<(String, bool)>),
    Image { key: String, image: Option<egui::ColorImage> },
    Player(PlayerEv),
    Update(UpdateEv),
    Error(String),
}

pub use eframe::egui;
