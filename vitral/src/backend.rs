//! Motor do app: roda numa thread separada com tokio. Cuida do login, da Web API,
//! do player (librespot), das capas e das atualizações.

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::mpsc::Sender;
use std::time::Duration;

use eframe::egui;
use librespot_core::{
    SpotifyUri, authentication::Credentials, cache::Cache, config::SessionConfig, session::Session,
};
use librespot_playback::{
    audio_backend,
    config::{AudioFormat, Bitrate, PlayerConfig},
    mixer::{Mixer, MixerConfig, softmixer::SoftMixer},
    player::{Player, PlayerEvent},
};
use tokio::sync::{Mutex, Semaphore, mpsc};

use crate::auth;
use crate::model::{Cmd, Ev, ListKey, PlayerEv, UpdateEv};
use crate::settings::{Settings, data_dir};
use crate::spotify::Api;
use crate::updater;

#[derive(Clone)]
struct Out {
    tx: Sender<Ev>,
    ctx: egui::Context,
}

impl Out {
    fn send(&self, ev: Ev) {
        let _ = self.tx.send(ev);
        self.ctx.request_repaint();
    }
}

struct Audio {
    session: Session,
    player: Arc<Player>,
    mixer: Arc<SoftMixer>,
}

#[derive(Clone, Copy)]
struct AudioCfg {
    quality: u16,
    normalize: bool,
    volume: f32,
}

struct Shared {
    out: Out,
    api: Mutex<Option<Api>>,
    audio: Mutex<Option<Audio>>,
    cfg: Mutex<AudioCfg>,
    http: reqwest::Client,
    images: Semaphore,
    update_file: Mutex<Option<PathBuf>>,
}

pub fn spawn(ctx: egui::Context, tx: Sender<Ev>, settings: &Settings) -> mpsc::UnboundedSender<Cmd> {
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel();
    let cfg = AudioCfg { quality: settings.quality, normalize: settings.normalize, volume: settings.volume };
    std::thread::Builder::new()
        .name("vitral-backend".into())
        .spawn(move || {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .worker_threads(3)
                .enable_all()
                .build()
                .expect("tokio");
            rt.block_on(run(cmd_rx, Out { tx, ctx }, cfg));
        })
        .expect("thread do motor");
    cmd_tx
}

async fn run(mut rx: mpsc::UnboundedReceiver<Cmd>, out: Out, cfg: AudioCfg) {
    let http = reqwest::Client::builder()
        .user_agent(concat!("Vitral/", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(20))
        .build()
        .unwrap_or_default();
    let sh = Arc::new(Shared {
        out,
        api: Mutex::new(None),
        audio: Mutex::new(None),
        cfg: Mutex::new(cfg),
        http,
        images: Semaphore::new(6),
        update_file: Mutex::new(None),
    });

    // Tenta entrar com o login salvo.
    match auth::load_saved() {
        Some(tokens) => {
            let sh2 = sh.clone();
            tokio::spawn(async move {
                sh2.out.send(Ev::LoggingIn);
                match auth::refresh(&tokens).await {
                    Ok(fresh) => {
                        auth::save(&fresh);
                        finish_login(sh2, fresh).await;
                    }
                    Err(e) => {
                        log::warn!("login salvo falhou: {e}");
                        if e.contains("invalid_grant") || e.contains("invalid_client") {
                            auth::forget();
                            sh2.out.send(Ev::NeedLogin);
                        } else {
                            sh2.out.send(Ev::NeedLogin);
                            sh2.out.send(Ev::Error(format!("{e}. Confira a internet e tente entrar de novo.")));
                        }
                    }
                }
            });
        }
        None => sh.out.send(Ev::NeedLogin),
    }

    while let Some(cmd) = rx.recv().await {
        let s = sh.clone();
        match cmd {
            Cmd::Login => {
                tokio::spawn(async move {
                    s.out.send(Ev::LoggingIn);
                    match auth::login_in_browser().await {
                        Ok(tokens) => {
                            auth::save(&tokens);
                            finish_login(s, tokens).await;
                        }
                        Err(e) => {
                            log::warn!("{e}");
                            s.out.send(Ev::NeedLogin);
                            s.out.send(Ev::Error(e));
                        }
                    }
                });
            }
            Cmd::Logout => {
                if let Some(a) = s.audio.lock().await.take() {
                    a.player.stop();
                    a.session.shutdown();
                }
                *s.api.lock().await = None;
                auth::forget();
                s.out.send(Ev::LoggedOut);
            }
            Cmd::OpenList(key) => {
                tokio::spawn(open_list(s, key));
            }
            Cmd::Search(q) => {
                tokio::spawn(async move {
                    let Some(api) = s.api.lock().await.clone() else { return };
                    match api.search(&q).await {
                        Ok(r) => s.out.send(Ev::Search(r)),
                        Err(e) => s.out.send(Ev::Error(format!("A busca falhou. {e}"))),
                    }
                });
            }
            Cmd::Load { uri, play, position_ms } => {
                if let Err(e) = ensure_audio(&s).await {
                    s.out.send(Ev::Error(e));
                    s.out.send(Ev::Player(PlayerEv::Stopped));
                    continue;
                }
                match SpotifyUri::from_uri(&uri) {
                    Ok(id) => {
                        if let Some(a) = s.audio.lock().await.as_ref() {
                            a.player.load(id, play, position_ms);
                        }
                    }
                    Err(e) => s.out.send(Ev::Error(format!("Música inválida: {e}"))),
                }
            }
            Cmd::Preload(uri) => {
                if let (Ok(id), Some(a)) = (SpotifyUri::from_uri(&uri), s.audio.lock().await.as_ref()) {
                    a.player.preload(id);
                }
            }
            Cmd::Play => {
                if let Some(a) = s.audio.lock().await.as_ref() {
                    a.player.play();
                }
            }
            Cmd::Pause => {
                if let Some(a) = s.audio.lock().await.as_ref() {
                    a.player.pause();
                }
            }
            Cmd::Seek(ms) => {
                if let Some(a) = s.audio.lock().await.as_ref() {
                    a.player.seek(ms);
                }
            }
            Cmd::Volume(v) => {
                s.cfg.lock().await.volume = v;
                if let Some(a) = s.audio.lock().await.as_ref() {
                    a.mixer.set_volume(volume_u16(v));
                }
            }
            Cmd::ApplyAudio { quality, normalize } => {
                {
                    let mut c = s.cfg.lock().await;
                    c.quality = quality;
                    c.normalize = normalize;
                }
                // O player é recriado na próxima música com a configuração nova.
                let mut guard = s.audio.lock().await;
                if let Some(a) = guard.take() {
                    a.player.stop();
                    let cfg = *s.cfg.lock().await;
                    *guard = Some(make_player(&s.out, a.session, cfg));
                }
            }
            Cmd::SetLiked { id, liked } => {
                tokio::spawn(async move {
                    let Some(api) = s.api.lock().await.clone() else { return };
                    if let Err(e) = api.set_liked(&id, liked).await {
                        s.out.send(Ev::Liked(vec![(id, !liked)]));
                        s.out.send(Ev::Error(format!("Não consegui salvar a curtida. {e}")));
                    }
                });
            }
            Cmd::CheckLiked(ids) => {
                tokio::spawn(async move {
                    let Some(api) = s.api.lock().await.clone() else { return };
                    for chunk in ids.chunks(50) {
                        match api.contains(chunk).await {
                            Ok(flags) => {
                                let pairs = chunk.iter().cloned().zip(flags).collect();
                                s.out.send(Ev::Liked(pairs));
                            }
                            Err(e) => {
                                log::warn!("contains falhou: {e}");
                                break;
                            }
                        }
                    }
                });
            }
            Cmd::FetchImage { url, size } => {
                tokio::spawn(fetch_image(s, url, size));
            }
            Cmd::CheckUpdate { manual } => {
                tokio::spawn(async move {
                    match updater::check().await {
                        Ok(Some(info)) => s.out.send(Ev::Update(UpdateEv::Available(info))),
                        Ok(None) => s.out.send(Ev::Update(UpdateEv::UpToDate { manual })),
                        Err(e) => {
                            log::warn!("checagem de atualização: {e}");
                            if manual {
                                s.out.send(Ev::Update(UpdateEv::Failed(e)));
                            }
                        }
                    }
                });
            }
            Cmd::DownloadUpdate(info) => {
                tokio::spawn(async move {
                    let out = s.out.clone();
                    let mut last = -1.0f32;
                    let res = updater::download(&info, |p| {
                        if p - last >= 0.02 || p >= 1.0 {
                            last = p;
                            out.send(Ev::Update(UpdateEv::Progress(p)));
                        }
                    })
                    .await;
                    match res {
                        Ok(path) => {
                            *s.update_file.lock().await = Some(path);
                            s.out.send(Ev::Update(UpdateEv::Ready));
                        }
                        Err(e) => s.out.send(Ev::Update(UpdateEv::Failed(e))),
                    }
                });
            }
            Cmd::RestartForUpdate => {
                let path = s.update_file.lock().await.clone();
                match path {
                    Some(p) => {
                        if let Some(a) = s.audio.lock().await.as_ref() {
                            a.player.stop();
                        }
                        if let Err(e) = updater::install_and_restart(&p) {
                            s.out.send(Ev::Update(UpdateEv::Failed(e)));
                        }
                    }
                    None => s.out.send(Ev::Update(UpdateEv::Failed("A atualização ainda não foi baixada.".into()))),
                }
            }
        }
    }
}

async fn finish_login(sh: Arc<Shared>, tokens: auth::Tokens) {
    let api = Api::new(tokens);
    match api.me().await {
        Ok(user) => {
            *sh.api.lock().await = Some(api);
            log::info!("entrou como {}", user.id);
            sh.out.send(Ev::LoggedIn(user));
            tokio::spawn(load_home(sh.clone()));
            // Conecta o áudio já, pra primeira música tocar rápido.
            if let Err(e) = ensure_audio(&sh).await {
                log::warn!("áudio: {e}");
            }
        }
        Err(e) => {
            sh.out.send(Ev::NeedLogin);
            sh.out.send(Ev::Error(format!("Não consegui entrar. {e}")));
        }
    }
}

async fn load_home(sh: Arc<Shared>) {
    let Some(api) = sh.api.lock().await.clone() else { return };
    let (pl, al, ar) = tokio::join!(api.my_playlists(), api.saved_albums(), api.followed_artists());
    let playlists = pl.unwrap_or_else(|e| {
        sh.out.send(Ev::Error(format!("Não consegui carregar suas playlists. {e}")));
        Vec::new()
    });
    let albums = al.unwrap_or_else(|e| {
        log::warn!("álbuns: {e}");
        Vec::new()
    });
    let artists = ar.unwrap_or_else(|e| {
        log::warn!("artistas: {e}");
        Vec::new()
    });
    sh.out.send(Ev::Library { playlists, albums, artists });
    let (rec, top) = tokio::join!(api.recently_played(), api.top_artists());
    sh.out.send(Ev::Home {
        recent: rec.unwrap_or_else(|e| {
            log::warn!("recentes: {e}");
            Vec::new()
        }),
        top_artists: top.unwrap_or_else(|e| {
            log::warn!("top artistas: {e}");
            Vec::new()
        }),
    });
}

async fn open_list(sh: Arc<Shared>, key: ListKey) {
    let Some(api) = sh.api.lock().await.clone() else { return };
    let first = match &key {
        ListKey::Liked => api.liked_first().await,
        ListKey::Playlist(id) => api.playlist_first(id).await,
        ListKey::Album(id) => api.album_first(id).await,
        ListKey::Artist(id) => api.artist(id).await.map(|d| (d, None)),
    };
    let (data, mut next) = match first {
        Ok(v) => v,
        Err(e) => {
            sh.out.send(Ev::ListFailed { key, msg: e.to_string() });
            return;
        }
    };
    let album_info = match &key {
        ListKey::Album(_) => Some((
            data.title.clone(),
            data.tracks.first().and_then(|t| t.image_small.clone()),
            data.image.clone(),
        )),
        _ => None,
    };
    sh.out.send(Ev::List { key: key.clone(), data });
    let mut loaded = 0usize;
    while let Some(url) = next.take() {
        let album = album_info.as_ref().map(|(n, s, l)| (n.as_str(), s.clone(), l.clone()));
        match api.next_page(&url, album).await {
            Ok((tracks, n)) => {
                loaded += tracks.len();
                next = n.filter(|_| loaded < 10_000);
                sh.out.send(Ev::ListMore { key: key.clone(), tracks, complete: next.is_none() });
            }
            Err(e) => {
                log::warn!("página seguinte: {e}");
                sh.out.send(Ev::ListMore { key: key.clone(), tracks: Vec::new(), complete: true });
                break;
            }
        }
    }
}

async fn fetch_image(sh: Arc<Shared>, url: String, size: u32) {
    let key = format!("{size}:{url}");
    let Ok(_permit) = sh.images.acquire().await else { return };
    let bytes = match sh.http.get(&url).send().await {
        Ok(r) if r.status().is_success() => r.bytes().await.ok(),
        _ => None,
    };
    let image = bytes.and_then(|b| {
        tokio::task::block_in_place(|| {
            let img = image::load_from_memory(&b).ok()?;
            let img = if img.width() > size || img.height() > size { img.thumbnail(size, size) } else { img };
            let rgba = img.to_rgba8();
            Some(egui::ColorImage::from_rgba_unmultiplied(
                [rgba.width() as usize, rgba.height() as usize],
                rgba.as_raw(),
            ))
        })
    });
    sh.out.send(Ev::Image { key, image });
}

fn volume_u16(v: f32) -> u16 {
    (v.clamp(0.0, 1.0) * u16::MAX as f32) as u16
}

async fn ensure_audio(sh: &Arc<Shared>) -> Result<(), String> {
    let mut guard = sh.audio.lock().await;
    if let Some(a) = guard.as_ref() {
        if !a.session.is_invalid() && !a.player.is_invalid() {
            return Ok(());
        }
        log::info!("reconectando o áudio");
    }
    let api = sh.api.lock().await.clone().ok_or("Entre na sua conta primeiro.")?;
    let token = api.access_token().await.map_err(|e| e.to_string())?;
    let cache = Cache::new(
        Some(data_dir()),
        None,
        Some(data_dir().join("audio-cache")),
        Some(400 * 1024 * 1024),
    )
    .ok();
    let session = Session::new(SessionConfig::default(), cache);
    session
        .connect(Credentials::with_access_token(token), false)
        .await
        .map_err(|e| format!("Não consegui conectar o áudio ao Spotify ({e}). A conta precisa ser Premium."))?;
    let cfg = *sh.cfg.lock().await;
    *guard = Some(make_player(&sh.out, session, cfg));
    Ok(())
}

fn make_player(out: &Out, session: Session, cfg: AudioCfg) -> Audio {
    let mixer = Arc::new(SoftMixer::open(MixerConfig::default()).expect("mixer"));
    mixer.set_volume(volume_u16(cfg.volume));
    let player_cfg = PlayerConfig {
        bitrate: match cfg.quality {
            96 => Bitrate::Bitrate96,
            160 => Bitrate::Bitrate160,
            _ => Bitrate::Bitrate320,
        },
        normalisation: cfg.normalize,
        position_update_interval: Some(Duration::from_millis(1000)),
        ..PlayerConfig::default()
    };
    let backend = audio_backend::find(None).expect("saída de áudio");
    let player = Player::new(player_cfg, session.clone(), mixer.get_soft_volume(), move || {
        backend(None, AudioFormat::default())
    });
    let mut events = player.get_player_event_channel();
    let out = out.clone();
    tokio::spawn(async move {
        while let Some(ev) = events.recv().await {
            let uri = |id: &SpotifyUri| id.to_uri().unwrap_or_default();
            let mapped = match ev {
                PlayerEvent::Loading { track_id, .. } => Some(PlayerEv::Loading { uri: uri(&track_id) }),
                PlayerEvent::Playing { track_id, position_ms, .. } => Some(PlayerEv::Playing { uri: uri(&track_id), position_ms }),
                PlayerEvent::Paused { track_id, position_ms, .. } => Some(PlayerEv::Paused { uri: uri(&track_id), position_ms }),
                PlayerEvent::PositionChanged { track_id, position_ms, .. }
                | PlayerEvent::PositionCorrection { track_id, position_ms, .. }
                | PlayerEvent::Seeked { track_id, position_ms, .. } => Some(PlayerEv::Position { uri: uri(&track_id), position_ms }),
                PlayerEvent::EndOfTrack { track_id, .. } => Some(PlayerEv::EndOfTrack { uri: uri(&track_id) }),
                PlayerEvent::Unavailable { track_id, .. } => Some(PlayerEv::Unavailable { uri: uri(&track_id) }),
                PlayerEvent::TimeToPreloadNextTrack { .. } => Some(PlayerEv::PreloadNext),
                PlayerEvent::Stopped { .. } => Some(PlayerEv::Stopped),
                _ => None,
            };
            if let Some(m) = mapped {
                out.send(Ev::Player(m));
            }
        }
    });
    Audio { session, player, mixer }
}
