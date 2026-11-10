//! A interface do Vitral (egui).
#![allow(deprecated)]

use std::collections::HashMap;
use std::sync::mpsc::Receiver;
use std::time::{Duration, Instant};

use eframe::egui::{
    self, Align, Align2, Color32, CornerRadius, CursorIcon, Frame, Id, Key, Layout, Margin, Painter,
    Rect, Response, RichText, Sense, Stroke, StrokeKind, TextureHandle, TextureId, TextureOptions, Ui,
    UiBuilder, Vec2, pos2, vec2,
};
use eframe::egui::text::{LayoutJob, TextFormat, TextWrapping};
use tokio::sync::mpsc::UnboundedSender;

use crate::icons::{self, Icon};
use crate::model::*;
use crate::settings::{Settings, data_dir};
use crate::theme::{self, *};
use crate::{demo, updater};

// ---------------------------------------------------------------- estado

#[derive(Clone, Copy, PartialEq, Eq)]
enum Auth {
    Checking,
    NeedLogin,
    LoggingIn,
    In,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
enum View {
    Home,
    Search,
    List(ListKey),
    Settings,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Repeat {
    Off,
    All,
    One,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Sort {
    Custom,
    Title,
    Album,
    Added,
    Duration,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum SearchTab {
    All,
    Songs,
    Artists,
    Albums,
    Playlists,
}

enum Upd {
    Idle,
    Checking,
    UpToDate,
    Available(UpdateInfo),
    Downloading(UpdateInfo, f32),
    Ready(UpdateInfo),
    Failed(String),
}

enum Img {
    Pending,
    Ready(TextureHandle, u64),
    Failed,
}

pub struct VitralApp {
    cmd: Option<UnboundedSender<Cmd>>,
    rx: Receiver<Ev>,
    s: Settings,
    auth: Auth,
    user: Option<UserInfo>,
    demo: bool,

    view: View,
    hist: Vec<View>,
    fwd: Vec<View>,
    scroll_reset: bool,

    playlists: Vec<Collection>,
    albums: Vec<Collection>,
    artists: Vec<Collection>,
    lib_loaded: bool,
    lib_tab: Kind,
    lib_filter: String,
    lib_search: bool,
    recent: Vec<Track>,
    top_artists: Vec<Collection>,

    lists: HashMap<ListKey, ListData>,
    list_errors: HashMap<ListKey, String>,
    list_filter: String,
    sort: Sort,
    sort_asc: bool,

    query: String,
    query_edit: Option<Instant>,
    sent_query: String,
    results: Option<SearchResults>,
    searching: bool,
    search_tab: SearchTab,
    focus_search: bool,

    queue: Vec<Track>,
    original: Vec<Track>,
    qpos: usize,
    has_track: bool,
    ctx_key: Option<ListKey>,
    ctx_name: String,
    shuffle: bool,
    repeat: Repeat,
    playing: bool,
    loading: bool,
    pos_ms: u32,
    pos_at: Instant,
    muted_volume: Option<f32>,

    liked: HashMap<String, bool>,
    images: HashMap<String, Img>,
    frame_no: u64,
    toast: Option<(String, Instant, bool)>,
    update: Upd,
    upd_dialog: bool,
    rng: u64,
}

impl VitralApp {
    pub fn new(cc: &eframe::CreationContext<'_>, demo: bool) -> Self {
        theme::install(&cc.egui_ctx);
        let s = Settings::load();
        let (tx, rx) = std::sync::mpsc::channel();
        let cmd = if demo { None } else { Some(crate::backend::spawn(cc.egui_ctx.clone(), tx, &s)) };
        let mut app = Self {
            cmd,
            rx,
            s,
            auth: Auth::Checking,
            user: None,
            demo,
            view: View::Home,
            hist: Vec::new(),
            fwd: Vec::new(),
            scroll_reset: false,
            playlists: Vec::new(),
            albums: Vec::new(),
            artists: Vec::new(),
            lib_loaded: false,
            lib_tab: Kind::Playlist,
            lib_filter: String::new(),
            lib_search: false,
            recent: Vec::new(),
            top_artists: Vec::new(),
            lists: HashMap::new(),
            list_errors: HashMap::new(),
            list_filter: String::new(),
            sort: Sort::Custom,
            sort_asc: true,
            query: String::new(),
            query_edit: None,
            sent_query: String::new(),
            results: None,
            searching: false,
            search_tab: SearchTab::All,
            focus_search: false,
            queue: Vec::new(),
            original: Vec::new(),
            qpos: 0,
            has_track: false,
            ctx_key: None,
            ctx_name: String::new(),
            shuffle: false,
            repeat: Repeat::Off,
            playing: false,
            loading: false,
            pos_ms: 0,
            pos_at: Instant::now(),
            muted_volume: None,
            liked: HashMap::new(),
            images: HashMap::new(),
            frame_no: 0,
            toast: None,
            update: Upd::Idle,
            upd_dialog: false,
            rng: 0x9E37_79B9_7F4A_7C15
                ^ std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(1),
        };
        if demo {
            app.auth = Auth::In;
            app.user = Some(UserInfo { id: "demo".into(), name: "Gabriel".into() });
            app.playlists = demo::playlists();
            app.albums = demo::albums();
            app.artists = demo::artists();
            app.lib_loaded = true;
            app.recent = demo::tracks();
            app.top_artists = demo::artists();
            for t in demo::tracks().iter().step_by(2) {
                app.liked.insert(t.id.clone(), true);
            }
            let key = ListKey::Playlist("demo-pl-0".into());
            let data = demo::list(&key);
            app.queue = data.tracks.clone();
            app.original = app.queue.clone();
            app.qpos = 0;
            app.has_track = true;
            app.ctx_key = Some(key.clone());
            app.ctx_name = data.title.clone();
            app.pos_ms = 91_000;
            app.lists.insert(key.clone(), data);
            app.view = View::List(key);
        }
        app
    }

    fn send(&self, cmd: Cmd) {
        if let Some(c) = &self.cmd {
            let _ = c.send(cmd);
        }
    }

    fn accent(&self) -> Color32 {
        theme::accent(self.s.accent)
    }

    fn toast(&mut self, msg: impl Into<String>, error: bool) {
        self.toast = Some((msg.into(), Instant::now(), error));
    }

    fn rand(&mut self) -> u64 {
        self.rng ^= self.rng << 13;
        self.rng ^= self.rng >> 7;
        self.rng ^= self.rng << 17;
        self.rng
    }

    // ------------------------------------------------------------ navegação

    fn go(&mut self, view: View) {
        if view == self.view {
            return;
        }
        let old = std::mem::replace(&mut self.view, view.clone());
        self.hist.push(old);
        if self.hist.len() > 50 {
            self.hist.remove(0);
        }
        self.fwd.clear();
        self.enter(&view);
    }

    fn enter(&mut self, view: &View) {
        self.scroll_reset = true;
        if let View::List(key) = view {
            self.list_filter.clear();
            self.sort = Sort::Custom;
            self.sort_asc = true;
            if self.demo {
                self.lists.entry(key.clone()).or_insert_with(|| demo::list(key));
            } else {
                self.list_errors.remove(key);
                self.send(Cmd::OpenList(key.clone()));
            }
        }
    }

    fn back(&mut self) {
        if let Some(v) = self.hist.pop() {
            let cur = std::mem::replace(&mut self.view, v.clone());
            self.fwd.push(cur);
            self.enter(&v);
        }
    }

    fn forward(&mut self) {
        if let Some(v) = self.fwd.pop() {
            let cur = std::mem::replace(&mut self.view, v.clone());
            self.hist.push(cur);
            self.enter(&v);
        }
    }

    // ------------------------------------------------------------ reprodução

    fn current(&self) -> Option<&Track> {
        if self.has_track { self.queue.get(self.qpos) } else { None }
    }

    fn position_ms(&self) -> u32 {
        let dur = self.current().map(|t| t.duration_ms).unwrap_or(0);
        let p = if self.playing && !self.loading {
            self.pos_ms + self.pos_at.elapsed().as_millis() as u32
        } else {
            self.pos_ms
        };
        if dur > 0 { p.min(dur) } else { p }
    }

    fn play_tracks(&mut self, tracks: Vec<Track>, start: usize, key: Option<ListKey>, name: String) {
        if tracks.is_empty() {
            return;
        }
        let start = start.min(tracks.len() - 1);
        self.original = tracks.clone();
        self.queue = tracks;
        self.qpos = start;
        if self.shuffle {
            self.shuffle_rest();
        }
        self.ctx_key = key;
        self.ctx_name = name;
        self.load_current(true, 0);
    }

    fn shuffle_rest(&mut self) {
        let cur = self.queue[self.qpos].clone();
        let mut rest: Vec<Track> = self.queue.iter().enumerate().filter(|(i, _)| *i != self.qpos).map(|(_, t)| t.clone()).collect();
        for i in (1..rest.len()).rev() {
            let j = (self.rand() % (i as u64 + 1)) as usize;
            rest.swap(i, j);
        }
        self.queue = std::iter::once(cur).chain(rest).collect();
        self.qpos = 0;
    }

    fn load_current(&mut self, play: bool, position_ms: u32) {
        let Some(t) = self.queue.get(self.qpos).cloned() else { return };
        self.has_track = true;
        self.pos_ms = position_ms;
        self.pos_at = Instant::now();
        if self.demo {
            self.playing = play;
            self.loading = false;
        } else {
            self.loading = true;
            self.playing = play;
            self.send(Cmd::Load { uri: t.uri, play, position_ms });
        }
    }

    fn next(&mut self, auto: bool) {
        if !self.has_track || self.queue.is_empty() {
            return;
        }
        if auto && self.repeat == Repeat::One {
            self.load_current(true, 0);
            return;
        }
        if self.qpos + 1 < self.queue.len() {
            self.qpos += 1;
            self.load_current(true, 0);
        } else if self.repeat == Repeat::All || !auto {
            self.qpos = 0;
            self.load_current(auto || self.playing, 0);
        } else {
            self.qpos = 0;
            self.load_current(false, 0);
        }
    }

    fn prev(&mut self) {
        if !self.has_track {
            return;
        }
        if self.position_ms() > 3000 || self.qpos == 0 {
            self.seek(0);
        } else {
            self.qpos -= 1;
            self.load_current(true, 0);
        }
    }

    fn toggle_play(&mut self) {
        if !self.has_track {
            if let Some(View::List(key)) = Some(self.view.clone()) {
                if let Some(d) = self.lists.get(&key) {
                    let tracks = d.tracks.clone();
                    let name = d.title.clone();
                    self.play_tracks(tracks, 0, Some(key), name);
                }
            }
            return;
        }
        self.pos_ms = self.position_ms();
        self.pos_at = Instant::now();
        if self.playing {
            self.playing = false;
            self.send(Cmd::Pause);
        } else {
            self.playing = true;
            self.send(Cmd::Play);
        }
    }

    fn seek(&mut self, ms: u32) {
        self.pos_ms = ms;
        self.pos_at = Instant::now();
        self.send(Cmd::Seek(ms));
    }

    fn set_volume(&mut self, v: f32) {
        self.s.volume = v.clamp(0.0, 1.0);
        self.muted_volume = None;
        self.send(Cmd::Volume(self.s.volume));
    }

    fn toggle_shuffle(&mut self) {
        self.shuffle = !self.shuffle;
        if !self.has_track {
            return;
        }
        if self.shuffle {
            self.shuffle_rest();
        } else if let Some(cur) = self.current().cloned() {
            self.queue = self.original.clone();
            self.qpos = self.queue.iter().position(|t| t.id == cur.id).unwrap_or(0);
        }
    }

    fn toggle_like(&mut self, id: &str) {
        let now = !self.liked.get(id).copied().unwrap_or(false);
        self.liked.insert(id.to_string(), now);
        self.send(Cmd::SetLiked { id: id.to_string(), liked: now });
        self.toast(if now { "Adicionada às curtidas." } else { "Removida das curtidas." }, false);
    }

    fn check_liked(&self, tracks: &[Track]) {
        let ids: Vec<String> = tracks.iter().filter(|t| !self.liked.contains_key(&t.id)).map(|t| t.id.clone()).collect();
        if !ids.is_empty() {
            self.send(Cmd::CheckLiked(ids));
        }
    }

    // ------------------------------------------------------------ eventos

    fn process_events(&mut self, ctx: &egui::Context) {
        while let Ok(ev) = self.rx.try_recv() {
            match ev {
                Ev::NeedLogin => self.auth = Auth::NeedLogin,
                Ev::LoggingIn => self.auth = Auth::LoggingIn,
                Ev::LoggedIn(u) => {
                    self.auth = Auth::In;
                    self.user = Some(u);
                    self.send(Cmd::Volume(self.s.volume));
                    if self.s.check_updates {
                        self.send(Cmd::CheckUpdate { manual: false, token: self.s.github_token.clone() });
                    }
                }
                Ev::LoggedOut => {
                    self.auth = Auth::NeedLogin;
                    self.user = None;
                    self.playlists.clear();
                    self.albums.clear();
                    self.artists.clear();
                    self.lists.clear();
                    self.queue.clear();
                    self.has_track = false;
                    self.playing = false;
                    self.view = View::Home;
                    self.hist.clear();
                    self.fwd.clear();
                }
                Ev::Library { playlists, albums, artists } => {
                    self.playlists = playlists;
                    self.albums = albums;
                    self.artists = artists;
                    self.lib_loaded = true;
                }
                Ev::Home { recent, top_artists } => {
                    self.recent = recent;
                    self.top_artists = top_artists;
                }
                Ev::List { key, data } => {
                    if key == ListKey::Liked {
                        for t in &data.tracks {
                            self.liked.insert(t.id.clone(), true);
                        }
                    } else {
                        self.check_liked(&data.tracks);
                    }
                    self.lists.insert(key, data);
                }
                Ev::ListMore { key, tracks, complete } => {
                    if key == ListKey::Liked {
                        for t in &tracks {
                            self.liked.insert(t.id.clone(), true);
                        }
                    } else {
                        self.check_liked(&tracks);
                    }
                    if let Some(d) = self.lists.get_mut(&key) {
                        d.tracks.extend(tracks);
                        d.complete = complete;
                    }
                }
                Ev::ListFailed { key, msg } => {
                    self.list_errors.insert(key, msg.clone());
                    self.toast(format!("Não consegui abrir essa lista. {msg}"), true);
                }
                Ev::Search(r) => {
                    if r.query == self.sent_query {
                        self.check_liked(&r.tracks);
                        self.results = Some(r);
                        self.searching = false;
                    }
                }
                Ev::Liked(pairs) => {
                    for (id, v) in pairs {
                        self.liked.insert(id, v);
                    }
                }
                Ev::Image { key, image } => {
                    let entry = match image {
                        Some(img) => Img::Ready(ctx.load_texture(&key, img, TextureOptions::LINEAR), self.frame_no),
                        None => Img::Failed,
                    };
                    self.images.insert(key, entry);
                }
                Ev::Player(p) => self.on_player(p),
                Ev::Update(u) => self.on_update(u),
                Ev::Error(e) => self.toast(e, true),
            }
        }
    }

    fn is_current_uri(&self, uri: &str) -> bool {
        self.current().map(|t| t.uri == uri).unwrap_or(false)
    }

    fn on_player(&mut self, ev: PlayerEv) {
        match ev {
            PlayerEv::Loading { uri } => {
                if self.is_current_uri(&uri) {
                    self.loading = true;
                }
            }
            PlayerEv::Playing { uri, position_ms } => {
                if self.is_current_uri(&uri) {
                    self.playing = true;
                    self.loading = false;
                    self.pos_ms = position_ms;
                    self.pos_at = Instant::now();
                }
            }
            PlayerEv::Paused { uri, position_ms } => {
                if self.is_current_uri(&uri) {
                    self.playing = false;
                    self.loading = false;
                    self.pos_ms = position_ms;
                    self.pos_at = Instant::now();
                }
            }
            PlayerEv::Position { uri, position_ms } => {
                if self.is_current_uri(&uri) {
                    self.pos_ms = position_ms;
                    self.pos_at = Instant::now();
                }
            }
            PlayerEv::EndOfTrack { uri } => {
                if self.is_current_uri(&uri) {
                    self.next(true);
                }
            }
            PlayerEv::Unavailable { uri } => {
                if self.is_current_uri(&uri) {
                    self.toast("Essa música não está disponível. Pulando…", true);
                    self.next(true);
                }
            }
            PlayerEv::PreloadNext => {
                if self.repeat != Repeat::One {
                    if let Some(t) = self.queue.get(self.qpos + 1) {
                        self.send(Cmd::Preload(t.uri.clone()));
                    }
                }
            }
            PlayerEv::Stopped => {
                self.playing = false;
                self.loading = false;
            }
        }
    }

    fn on_update(&mut self, ev: UpdateEv) {
        match ev {
            UpdateEv::UpToDate { manual } => {
                self.update = Upd::UpToDate;
                if manual {
                    self.toast("Você já está na versão mais nova.", false);
                }
            }
            UpdateEv::Available(info) => {
                if self.s.update_mode == UpdateMode::Auto {
                    self.send(Cmd::DownloadUpdate { info: info.clone(), token: self.s.github_token.clone() });
                    self.update = Upd::Downloading(info, 0.0);
                } else {
                    let skipped = self.s.skipped_version.as_deref() == Some(info.version.as_str());
                    if !skipped || matches!(self.update, Upd::Checking) {
                        self.upd_dialog = true;
                    }
                    self.update = Upd::Available(info);
                }
            }
            UpdateEv::Progress(p) => {
                if let Upd::Downloading(_, prog) = &mut self.update {
                    *prog = p;
                }
            }
            UpdateEv::Ready => {
                let info = match std::mem::replace(&mut self.update, Upd::Idle) {
                    Upd::Downloading(i, _) | Upd::Available(i) | Upd::Ready(i) => Some(i),
                    _ => None,
                };
                if let Some(i) = info {
                    self.update = Upd::Ready(i);
                }
                if !self.upd_dialog {
                    self.toast("Atualização baixada. Reinicie quando quiser.", false);
                }
            }
            UpdateEv::Failed(e) => {
                self.update = Upd::Failed(e.clone());
                self.toast(e, true);
            }
        }
    }

    // ------------------------------------------------------------ busca

    fn tick_search(&mut self, ctx: &egui::Context) {
        let Some(at) = self.query_edit else { return };
        let q = self.query.trim().to_string();
        if q.is_empty() {
            self.query_edit = None;
            self.results = None;
            self.sent_query.clear();
            self.searching = false;
            return;
        }
        if at.elapsed() >= Duration::from_millis(350) {
            self.query_edit = None;
            if q != self.sent_query {
                self.sent_query = q.clone();
                if self.demo {
                    let f = fold(&q);
                    let tracks: Vec<Track> = demo::tracks()
                        .into_iter()
                        .filter(|t| fold(&format!("{} {} {}", t.name, t.artists, t.album)).contains(&f))
                        .collect();
                    self.results = Some(SearchResults { query: q, tracks, ..Default::default() });
                } else {
                    self.searching = true;
                    self.send(Cmd::Search(q));
                }
            }
        } else {
            ctx.request_repaint_after(Duration::from_millis(120));
        }
    }

    fn remember_search(&mut self) {
        let q = self.query.trim().to_string();
        if q.is_empty() {
            return;
        }
        self.s.recent_searches.retain(|x| !x.eq_ignore_ascii_case(&q));
        self.s.recent_searches.insert(0, q);
        self.s.recent_searches.truncate(8);
        self.s.save();
    }

    // ------------------------------------------------------------ imagens

    fn tex(&mut self, url: Option<&String>, size: u32) -> Option<TextureId> {
        let url = url?;
        let key = format!("{size}:{url}");
        match self.images.get_mut(&key) {
            Some(Img::Ready(t, used)) => {
                *used = self.frame_no;
                Some(t.id())
            }
            Some(_) => None,
            None => {
                self.images.insert(key, Img::Pending);
                self.send(Cmd::FetchImage { url: url.clone(), size });
                None
            }
        }
    }

    fn evict_images(&mut self) {
        if self.frame_no % 600 != 0 || self.images.len() < 250 {
            return;
        }
        let limit = self.frame_no.saturating_sub(1200);
        self.images.retain(|_, v| match v {
            Img::Ready(_, used) => *used >= limit,
            _ => true,
        });
    }

    fn cover(&mut self, ui: &Ui, rect: Rect, url: Option<&String>, size: u32, radius: u8, seed: &str) {
        if !ui.is_rect_visible(rect) {
            return;
        }
        match self.tex(url, size) {
            Some(id) => {
                egui::Image::new((id, rect.size())).corner_radius(radius).paint_at(ui, rect);
            }
            None => placeholder(ui.painter(), rect, radius, seed),
        }
    }

    fn liked_cover(&self, painter: &Painter, rect: Rect, radius: u8) {
        let a = self.accent();
        painter.rect_filled(rect, radius, a.gamma_multiply(0.85));
        painter.rect_filled(
            Rect::from_min_max(pos2(rect.left(), rect.center().y), rect.max),
            CornerRadius { nw: 0, ne: 0, sw: radius, se: radius },
            Color32::from_black_alpha(70),
        );
        let s = rect.width() * 0.42;
        icons::paint(painter, Rect::from_center_size(rect.center(), vec2(s, s)), Icon::HeartFilled, Color32::WHITE);
    }
}

// ---------------------------------------------------------------- desenho

impl eframe::App for VitralApp {
    fn ui(&mut self, ui: &mut Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        self.frame_no += 1;
        self.process_events(&ctx);
        self.tick_search(&ctx);
        if self.auth == Auth::In {
            self.shortcuts(&ctx);
        }
        if self.playing {
            ctx.request_repaint_after(Duration::from_millis(250));
            if self.demo {
                if let Some(t) = self.current() {
                    if self.position_ms() >= t.duration_ms {
                        self.next(true);
                    }
                }
            }
        }
        match self.auth {
            Auth::In => self.main_ui(ui),
            _ => self.login_ui(ui),
        }
        self.update_dialog(&ctx);
        self.toast_ui(&ctx);
        self.evict_images();
    }

    fn on_exit(&mut self, _gl: Option<&eframe::glow::Context>) {
        self.s.save();
    }
}

impl VitralApp {
    fn shortcuts(&mut self, ctx: &egui::Context) {
        let (ctrl_k, ctrl_l, ctrl_q, next, prev, up, down, space) = ctx.input_mut(|i| {
            let m = egui::Modifiers::COMMAND;
            (
                i.consume_key(m, Key::K),
                i.consume_key(m, Key::L),
                i.consume_key(m, Key::Q),
                i.consume_key(m, Key::ArrowRight),
                i.consume_key(m, Key::ArrowLeft),
                i.consume_key(m, Key::ArrowUp),
                i.consume_key(m, Key::ArrowDown),
                false,
            )
        });
        let space = space || (!ctx.egui_wants_keyboard_input() && ctx.input_mut(|i| i.consume_key(egui::Modifiers::NONE, Key::Space)));
        if ctrl_k {
            self.focus_search = true;
            self.go(View::Search);
        }
        if ctrl_l {
            if let Some(id) = self.current().map(|t| t.id.clone()) {
                self.toggle_like(&id);
            }
        }
        if ctrl_q {
            self.s.show_queue = !self.s.show_queue;
        }
        if next {
            self.next(false);
        }
        if prev {
            self.prev();
        }
        if up {
            self.set_volume(self.s.volume + 0.05);
        }
        if down {
            self.set_volume(self.s.volume - 0.05);
        }
        if space {
            self.toggle_play();
        }
    }

    // ------------------------------------------------------------ login

    fn login_ui(&mut self, ui: &mut Ui) {
        let accent = self.accent();
        egui::CentralPanel::default().frame(Frame::new().fill(MAIN)).show(ui, |ui| {
            let full = ui.max_rect();
            let card = Rect::from_center_size(full.center(), vec2(440.0, 400.0));
            ui.scope_builder(UiBuilder::new().max_rect(card), |ui| {
                ui.vertical_centered(|ui| {
                    let (r, _) = ui.allocate_exact_size(vec2(64.0, 64.0), Sense::hover());
                    icons::logo(ui.painter(), r, accent);
                    ui.add_space(18.0);
                    ui.label(RichText::new("Vitral").font(display(40.0)).color(TEXT));
                    ui.add_space(10.0);
                    match self.auth {
                        Auth::Checking => {
                            ui.label(RichText::new("Abrindo…").font(regular(15.0)).color(MUTED));
                        }
                        Auth::LoggingIn => {
                            ui.label(RichText::new("Entrando na sua conta…").font(semibold(16.0)).color(TEXT));
                            ui.add_space(8.0);
                            ui.label(
                                RichText::new("Se o navegador abriu, faça login lá e depois volte pra cá.")
                                    .font(regular(14.0))
                                    .color(MUTED),
                            );
                            ui.add_space(18.0);
                            ui.spinner();
                        }
                        _ => {
                            ui.label(
                                RichText::new("Entre com a sua conta do Spotify pra ouvir suas músicas e playlists.")
                                    .font(regular(15.0))
                                    .color(MUTED),
                            );
                            ui.add_space(4.0);
                            ui.label(RichText::new("Precisa ser uma conta Premium.").font(regular(13.0)).color(FAINT));
                            ui.add_space(26.0);
                            if pill_button(ui, "Entrar com o Spotify", accent, DARK_TEXT, vec2(260.0, 50.0)).clicked() {
                                self.send(Cmd::Login);
                            }
                            ui.add_space(14.0);
                            ui.label(
                                RichText::new("O login abre no seu navegador. O Vitral não vê a sua senha.")
                                    .font(regular(12.5))
                                    .color(FAINT),
                            );
                        }
                    }
                });
            });
        });
    }

    // ------------------------------------------------------------ estrutura

    fn main_ui(&mut self, ui: &mut Ui) {
        egui::Panel::bottom("player")
            .exact_size(96.0)
            .resizable(false)
            .show_separator_line(false)
            .frame(Frame::new().fill(BAR).inner_margin(Margin::symmetric(18, 10)))
            .show(ui, |ui| self.player_bar(ui));

        egui::Panel::left("side")
            .default_size(300.0)
            .size_range(230.0..=440.0)
            .resizable(true)
            .show_separator_line(false)
            .frame(Frame::new().fill(SIDE).inner_margin(Margin { left: 10, right: 8, top: 14, bottom: 6 }))
            .show(ui, |ui| self.sidebar(ui));

        if self.s.show_queue {
            egui::Panel::right("queue")
                .default_size(340.0)
                .size_range(280.0..=460.0)
                .resizable(true)
                .show_separator_line(false)
                .frame(Frame::new().fill(SIDE).inner_margin(Margin { left: 12, right: 10, top: 14, bottom: 6 }))
                .show(ui, |ui| self.queue_panel(ui));
        }

        egui::CentralPanel::default().frame(Frame::new().fill(MAIN)).show(ui, |ui| self.main_area(ui));

        let r = ui.ctx().content_rect();
        ui.painter().line_segment(
            [pos2(r.left(), r.bottom() - 96.0), pos2(r.right(), r.bottom() - 96.0)],
            Stroke::new(1.0, LINE),
        );
    }

    // ------------------------------------------------------------ lateral

    fn sidebar(&mut self, ui: &mut Ui) {
        ui.spacing_mut().item_spacing.y = 2.0;
        if nav_row(ui, Icon::Home, "Início", self.view == View::Home).clicked() {
            self.go(View::Home);
        }
        if nav_row(ui, Icon::Search, "Buscar", self.view == View::Search).clicked() {
            self.focus_search = true;
            self.go(View::Search);
        }
        ui.add_space(8.0);
        let (r, _) = ui.allocate_exact_size(vec2(ui.available_width(), 1.0), Sense::hover());
        ui.painter().rect_filled(r.shrink2(vec2(6.0, 0.0)), 0, LINE);
        ui.add_space(8.0);

        // Cabeçalho da biblioteca
        let row_h = 40.0;
        let (rect, _) = ui.allocate_exact_size(vec2(ui.available_width(), row_h), Sense::hover());
        icons::paint(ui.painter(), Rect::from_center_size(pos2(rect.left() + 24.0, rect.center().y), vec2(24.0, 24.0)), Icon::Library, MUTED);
        text_at(ui.painter(), pos2(rect.left() + 50.0, rect.center().y), "Sua biblioteca", bold(16.0), TEXT, rect.width() - 100.0, Align::Center);
        let btn = Rect::from_center_size(pos2(rect.right() - 22.0, rect.center().y), vec2(36.0, 36.0));
        let accent = self.accent();
        if icon_button_at(ui, btn, Id::new("libsearch"), Icon::Search, 18.0, self.lib_search, accent)
            .on_hover_text("Buscar na biblioteca")
            .clicked()
        {
            self.lib_search = !self.lib_search;
            self.lib_filter.clear();
        }

        ui.add_space(6.0);
        ui.horizontal_wrapped(|ui| {
            ui.add_space(4.0);
            ui.spacing_mut().item_spacing = vec2(8.0, 8.0);
            for (kind, label) in [(Kind::Playlist, "Playlists"), (Kind::Album, "Álbuns"), (Kind::Artist, "Artistas")] {
                if chip(ui, label, self.lib_tab == kind).clicked() {
                    self.lib_tab = kind;
                }
            }
        });
        ui.add_space(6.0);
        if self.lib_search {
            let w = ui.available_width() - 8.0;
            let (resp, _) = search_field(ui, &mut self.lib_filter, "Buscar na biblioteca", w, 36.0, Id::new("libfilter"), false, 8);
            if resp.gained_focus() || self.frame_no < 3 {
                // nada
            }
            ui.add_space(6.0);
        }

        let filter = fold(self.lib_filter.trim());
        egui::ScrollArea::vertical().id_salt("lib").auto_shrink([false, false]).show(ui, |ui| {
            ui.spacing_mut().item_spacing.y = 0.0;
            if !self.lib_loaded {
                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    ui.add_space(12.0);
                    ui.spinner();
                    ui.label(RichText::new("Carregando sua biblioteca…").color(MUTED));
                });
                return;
            }
            let mut shown = 0;
            match self.lib_tab {
                Kind::Playlist => {
                    if filter.is_empty() || fold("Músicas curtidas").contains(&filter) {
                        shown += 1;
                        let key = ListKey::Liked;
                        let n = self.lists.get(&key).map(|d| d.total).unwrap_or(0);
                        let sub = if n > 0 { format!("Playlist • {n} músicas") } else { "Playlist".into() };
                        let selected = self.view == View::List(key.clone());
                        let playing = self.ctx_key.as_ref() == Some(&key) && self.playing;
                        if self.lib_row(ui, None, "Músicas curtidas", &sub, false, selected, playing, true).clicked() {
                            self.go(View::List(key));
                        }
                    }
                    let items: Vec<Collection> = self.playlists.iter().filter(|p| filter.is_empty() || fold(&p.name).contains(&filter)).cloned().collect();
                    for p in items {
                        shown += 1;
                        let key = p.key();
                        let selected = self.view == View::List(key.clone());
                        let playing = self.ctx_key.as_ref() == Some(&key) && self.playing;
                        if self.lib_row(ui, p.image.as_ref(), &p.name, &p.subtitle, false, selected, playing, false).clicked() {
                            self.go(View::List(key));
                        }
                    }
                }
                Kind::Album | Kind::Artist => {
                    let src = if self.lib_tab == Kind::Album { &self.albums } else { &self.artists };
                    let items: Vec<Collection> = src.iter().filter(|p| filter.is_empty() || fold(&format!("{} {}", p.name, p.subtitle)).contains(&filter)).cloned().collect();
                    for p in items {
                        shown += 1;
                        let key = p.key();
                        let selected = self.view == View::List(key.clone());
                        let playing = self.ctx_key.as_ref() == Some(&key) && self.playing;
                        if self.lib_row(ui, p.image.as_ref(), &p.name, &p.subtitle, p.kind == Kind::Artist, selected, playing, false).clicked() {
                            self.go(View::List(key));
                        }
                    }
                }
            }
            if shown == 0 {
                ui.add_space(14.0);
                let msg = if !filter.is_empty() {
                    format!("Nada na biblioteca com “{}”.", self.lib_filter.trim())
                } else if self.lib_tab == Kind::Album {
                    "Você ainda não salvou nenhum álbum.".into()
                } else if self.lib_tab == Kind::Artist {
                    "Você ainda não segue nenhum artista.".into()
                } else {
                    "Nenhuma playlist ainda.".into()
                };
                ui.horizontal_wrapped(|ui| {
                    ui.add_space(12.0);
                    ui.label(RichText::new(msg).color(MUTED));
                });
            }
        });
    }

    #[allow(clippy::too_many_arguments)]
    fn lib_row(&mut self, ui: &mut Ui, image: Option<&String>, name: &str, sub: &str, round: bool, selected: bool, playing: bool, liked: bool) -> Response {
        let (rect, resp) = ui.allocate_exact_size(vec2(ui.available_width(), 68.0), Sense::click());
        if !ui.is_rect_visible(rect) {
            return resp;
        }
        let fill = if selected {
            active_fill()
        } else if resp.hovered() {
            hover_fill()
        } else {
            Color32::TRANSPARENT
        };
        ui.painter().rect_filled(rect, 8, fill);
        let c = Rect::from_min_size(pos2(rect.left() + 8.0, rect.top() + 8.0), vec2(52.0, 52.0));
        let radius = if round { 26 } else { 6 };
        if liked {
            self.liked_cover(ui.painter(), c, radius);
        } else {
            self.cover(ui, c, image, 96, radius, name);
        }
        let right_pad = if playing { 36.0 } else { 10.0 };
        let tx = c.right() + 12.0;
        let tw = rect.right() - tx - right_pad;
        let accent = self.accent();
        let name_color = if playing { accent } else { TEXT };
        text_at(ui.painter(), pos2(tx, rect.center().y - 10.0), name, semibold(15.0), name_color, tw, Align::Center);
        text_at(ui.painter(), pos2(tx, rect.center().y + 11.0), sub, regular(13.0), MUTED, tw, Align::Center);
        if playing {
            icons::paint(ui.painter(), Rect::from_center_size(pos2(rect.right() - 20.0, rect.center().y), vec2(18.0, 18.0)), Icon::Speaker, accent);
        }
        resp.on_hover_cursor(CursorIcon::PointingHand)
    }

    // ------------------------------------------------------------ área central

    fn main_area(&mut self, ui: &mut Ui) {
        ui.add_space(14.0);
        self.top_bar(ui);
        ui.add_space(8.0);
        let mut area = egui::ScrollArea::vertical().id_salt(("main", self.view.clone())).auto_shrink([false, false]);
        if self.scroll_reset {
            area = area.vertical_scroll_offset(0.0);
            self.scroll_reset = false;
        }
        area.show(ui, |ui| {
            Frame::new().inner_margin(Margin { left: 26, right: 26, top: 6, bottom: 30 }).show(ui, |ui| {
                ui.set_width(ui.available_width());
                match self.view.clone() {
                    View::Home => self.home_view(ui),
                    View::Search => self.search_view(ui),
                    View::List(key) => self.list_view(ui, &key),
                    View::Settings => self.settings_view(ui),
                }
            });
        });
    }

    fn top_bar(&mut self, ui: &mut Ui) {
        let accent = self.accent();
        let (bar, _) = ui.allocate_exact_size(vec2(ui.available_width(), 48.0), Sense::hover());
        let y = bar.center().y;
        let mut x = bar.left() + 22.0;
        let b = Rect::from_center_size(pos2(x + 20.0, y), vec2(40.0, 40.0));
        ui.painter().circle_filled(b.center(), 20.0, Color32::from_black_alpha(90));
        if icon_button_at(ui, b, Id::new("back"), Icon::Back, 20.0, false, accent).on_hover_text("Voltar").clicked() {
            self.back();
        }
        x += 48.0;
        let f = Rect::from_center_size(pos2(x + 20.0, y), vec2(40.0, 40.0));
        ui.painter().circle_filled(f.center(), 20.0, Color32::from_black_alpha(90));
        if icon_button_at(ui, f, Id::new("fwd"), Icon::Forward, 20.0, false, accent).on_hover_text("Avançar").clicked() {
            self.forward();
        }
        x += 56.0;

        // Lado direito: perfil, configurações, aviso de atualização.
        let mut rx = bar.right() - 22.0;
        let av = Rect::from_center_size(pos2(rx - 20.0, y), vec2(40.0, 40.0));
        let name = self.user.as_ref().map(|u| u.name.clone()).unwrap_or_default();
        let av_resp = ui.interact(av, Id::new("avatar"), Sense::click()).on_hover_text(if name.is_empty() { "Perfil".to_string() } else { name.clone() });
        ui.painter().circle_filled(av.center(), 20.0, Color32::from_rgb(0x2A, 0x2E, 0x36));
        ui.painter().circle_stroke(av.center(), 20.0, Stroke::new(3.0, Color32::from_black_alpha(120)));
        let initial = name.chars().next().map(|c| c.to_uppercase().to_string()).unwrap_or_else(|| "?".into());
        ui.painter().text(av.center(), Align2::CENTER_CENTER, initial, bold(16.0), TEXT);
        if av_resp.on_hover_cursor(CursorIcon::PointingHand).clicked() {
            self.go(View::Settings);
        }
        rx -= 50.0;
        let st = Rect::from_center_size(pos2(rx - 20.0, y), vec2(40.0, 40.0));
        if icon_button_at(ui, st, Id::new("settings"), Icon::Settings, 21.0, self.view == View::Settings, accent)
            .on_hover_text("Configurações")
            .clicked()
        {
            self.go(View::Settings);
        }
        rx -= 50.0;
        let pill_text = match &self.update {
            Upd::Available(_) => Some("Atualização disponível".to_string()),
            Upd::Downloading(_, p) => Some(format!("Baixando atualização · {:.0}%", p * 100.0)),
            Upd::Ready(_) => Some("Reiniciar para atualizar".to_string()),
            _ => None,
        };
        if let Some(t) = pill_text {
            let w = text_width(ui, &t, semibold(13.5)) + 40.0;
            let pr = Rect::from_center_size(pos2(rx - w / 2.0 - 4.0, y), vec2(w, 34.0));
            let resp = ui.interact(pr, Id::new("updpill"), Sense::click());
            ui.painter().rect_filled(pr, 17, theme::accent_soft(self.s.accent));
            ui.painter().circle_filled(pos2(pr.left() + 16.0, y), 4.0, accent);
            text_at(ui.painter(), pos2(pr.left() + 28.0, y), &t, semibold(13.5), accent, w, Align::Center);
            if resp.on_hover_cursor(CursorIcon::PointingHand).clicked() {
                self.upd_dialog = true;
            }
            rx = pr.left() - 8.0;
        }

        // Busca no meio.
        let avail = (rx - 12.0 - x).max(160.0);
        let w = avail.min(460.0);
        let sr = Rect::from_min_size(pos2(x, y - 23.0), vec2(w, 46.0));
        let focus = std::mem::take(&mut self.focus_search);
        let mut child = ui.new_child(UiBuilder::new().max_rect(sr));
        let (resp, cleared) = search_field(&mut child, &mut self.query, "O que você quer ouvir?", w, 46.0, Id::new("search"), focus, 23);
        if resp.changed() || cleared {
            self.query_edit = Some(Instant::now());
            if !self.query.trim().is_empty() && self.view != View::Search {
                self.go(View::Search);
            }
        }
        if resp.lost_focus() && ui.input(|i| i.key_pressed(Key::Enter)) {
            self.query_edit = Some(Instant::now() - Duration::from_secs(1));
            self.remember_search();
        }
    }

    // ------------------------------------------------------------ início

    fn home_view(&mut self, ui: &mut Ui) {
        let hour = local_hour();
        let greet = if hour < 5 {
            "Boa noite"
        } else if hour < 12 {
            "Bom dia"
        } else if hour < 18 {
            "Boa tarde"
        } else {
            "Boa noite"
        };
        let name = self.user.as_ref().map(|u| u.name.split_whitespace().next().unwrap_or("").to_string()).unwrap_or_default();
        let title = if name.is_empty() { greet.to_string() } else { format!("{greet}, {name}") };
        ui.label(RichText::new(title).font(display(30.0)).color(TEXT));
        ui.add_space(16.0);

        // Atalhos: curtidas + primeiras playlists.
        let mut tiles: Vec<(Option<Collection>, ListKey, String)> = vec![(None, ListKey::Liked, "Músicas curtidas".into())];
        for p in self.playlists.iter().take(5) {
            tiles.push((Some(p.clone()), p.key(), p.name.clone()));
        }
        let width = ui.available_width();
        let cols = ((width + 10.0) / 260.0).floor().clamp(1.0, 3.0) as usize;
        let tile_w = (width - 10.0 * (cols as f32 - 1.0)) / cols as f32;
        let rows = tiles.len().div_ceil(cols);
        let (area, _) = ui.allocate_exact_size(vec2(width, rows as f32 * 74.0 - 10.0), Sense::hover());
        let accent = self.accent();
        for (i, (col, key, name)) in tiles.into_iter().enumerate() {
            let r = Rect::from_min_size(
                pos2(area.left() + (i % cols) as f32 * (tile_w + 10.0), area.top() + (i / cols) as f32 * 74.0),
                vec2(tile_w, 64.0),
            );
            let resp = ui.interact(r, Id::new(("tile", i)), Sense::click());
            ui.painter().rect_filled(r, 8, if resp.hovered() { Color32::from_white_alpha(34) } else { Color32::from_white_alpha(18) });
            let c = Rect::from_min_size(r.min, vec2(64.0, 64.0));
            match &col {
                None => self.liked_cover(ui.painter(), c, 8),
                Some(p) => self.cover(ui, c, p.image.as_ref(), 96, 8, &p.name),
            }
            let playing = self.ctx_key.as_ref() == Some(&key) && self.playing;
            text_at(ui.painter(), pos2(c.right() + 14.0, r.center().y), &name, bold(15.0), if playing { accent } else { TEXT }, tile_w - 64.0 - 50.0, Align::Center);
            if playing {
                icons::paint(ui.painter(), Rect::from_center_size(pos2(r.right() - 22.0, r.center().y), vec2(18.0, 18.0)), Icon::Speaker, accent);
            }
            if resp.on_hover_cursor(CursorIcon::PointingHand).clicked() {
                self.go(View::List(key));
            }
        }

        if !self.recent.is_empty() {
            ui.add_space(30.0);
            ui.label(RichText::new("Tocadas recentemente").font(bold(22.0)).color(TEXT));
            ui.add_space(8.0);
            let tracks = self.recent.clone();
            let clicked = self.card_grid(ui, "recent", tracks.iter().map(|t| (t.image_large.clone(), t.name.clone(), t.artists.clone(), false)).collect(), 2);
            if let Some(i) = clicked {
                self.play_tracks(tracks, i, None, "Tocadas recentemente".into());
            }
        }
        if !self.top_artists.is_empty() {
            ui.add_space(26.0);
            ui.label(RichText::new("Seus artistas").font(bold(22.0)).color(TEXT));
            ui.add_space(8.0);
            let arts = self.top_artists.clone();
            let clicked = self.card_grid(ui, "artists", arts.iter().map(|a| (a.image.clone(), a.name.clone(), "Artista".to_string(), true)).collect(), 1);
            if let Some(i) = clicked {
                self.go(View::List(arts[i].key()));
            }
        }
        if !self.lib_loaded {
            ui.add_space(30.0);
            ui.horizontal(|ui| {
                ui.spinner();
                ui.label(RichText::new("Carregando…").color(MUTED));
            });
        }
    }

    /// Grade de cartões com capa. Retorna o índice clicado.
    fn card_grid(&mut self, ui: &mut Ui, id: &str, items: Vec<(Option<String>, String, String, bool)>, max_rows: usize) -> Option<usize> {
        let width = ui.available_width() + 24.0;
        let min_w = 172.0;
        let cols = ((width) / min_w).floor().max(1.0) as usize;
        let card_w = width / cols as f32;
        let n = items.len().min(cols * max_rows);
        let rows = n.div_ceil(cols);
        let card_h = card_w - 24.0 + 70.0;
        let (area, _) = ui.allocate_exact_size(vec2(width - 24.0, rows as f32 * card_h), Sense::hover());
        let accent = self.accent();
        let mut clicked = None;
        for (i, (img, title, sub, round)) in items.into_iter().take(n).enumerate() {
            let r = Rect::from_min_size(
                pos2(area.left() - 12.0 + (i % cols) as f32 * card_w, area.top() + (i / cols) as f32 * card_h),
                vec2(card_w, card_h),
            );
            let resp = ui.interact(r, Id::new((id, i)), Sense::click());
            if resp.hovered() {
                ui.painter().rect_filled(r, 10, Color32::from_white_alpha(14));
            }
            let side = card_w - 24.0;
            let c = Rect::from_min_size(pos2(r.left() + 12.0, r.top() + 12.0), vec2(side, side));
            self.cover(ui, c, img.as_ref(), 300, if round { (side / 2.0) as u8 } else { 6 }, &title);
            if resp.hovered() && !round {
                let pb = Rect::from_center_size(pos2(c.right() - 30.0, c.bottom() - 30.0), vec2(46.0, 46.0));
                ui.painter().circle_filled(pb.center(), 23.0, accent);
                icons::paint(ui.painter(), pb.shrink(13.0), Icon::Play, DARK_TEXT);
            }
            text_at(ui.painter(), pos2(c.left(), c.bottom() + 18.0), &title, bold(15.0), TEXT, side, Align::Center);
            text_at(ui.painter(), pos2(c.left(), c.bottom() + 40.0), &sub, regular(13.5), MUTED, side, Align::Center);
            if resp.on_hover_cursor(CursorIcon::PointingHand).clicked() {
                clicked = Some(i);
            }
        }
        clicked
    }

    // ------------------------------------------------------------ busca

    fn search_view(&mut self, ui: &mut Ui) {
        ui.horizontal_wrapped(|ui| {
            ui.spacing_mut().item_spacing = vec2(8.0, 8.0);
            for (tab, label) in [
                (SearchTab::All, "Tudo"),
                (SearchTab::Songs, "Músicas"),
                (SearchTab::Artists, "Artistas"),
                (SearchTab::Albums, "Álbuns"),
                (SearchTab::Playlists, "Playlists"),
            ] {
                if chip(ui, label, self.search_tab == tab).clicked() {
                    self.search_tab = tab;
                }
            }
        });
        ui.add_space(18.0);
        if self.query.trim().is_empty() {
            ui.label(RichText::new("Busque por músicas, artistas, álbuns ou playlists.").font(regular(15.0)).color(MUTED));
            if !self.s.recent_searches.is_empty() {
                ui.add_space(22.0);
                ui.label(RichText::new("Buscas recentes").font(bold(20.0)).color(TEXT));
                ui.add_space(10.0);
                let recent = self.s.recent_searches.clone();
                ui.horizontal_wrapped(|ui| {
                    ui.spacing_mut().item_spacing = vec2(8.0, 8.0);
                    for q in recent {
                        if chip(ui, &q, false).clicked() {
                            self.query = q;
                            self.query_edit = Some(Instant::now() - Duration::from_secs(1));
                        }
                    }
                });
            }
            return;
        }
        let Some(res) = self.results.clone() else {
            ui.horizontal(|ui| {
                ui.spinner();
                ui.label(RichText::new("Buscando…").color(MUTED));
            });
            return;
        };
        let tab = self.search_tab;
        let show = |t: SearchTab| tab == SearchTab::All || tab == t;
        let mut any = false;
        let width = ui.available_width();

        if show(SearchTab::Songs) && !res.tracks.is_empty() {
            any = true;
            let wide = width > 760.0 && tab == SearchTab::All;
            let list_n = if tab == SearchTab::All { 5 } else { res.tracks.len() };
            if wide {
                let top_w = (width * 0.38).min(420.0);
                let start = ui.cursor().min;
                ui.label(RichText::new("Melhor resultado").font(bold(20.0)).color(TEXT));
                ui.add_space(10.0);
                let (card, resp) = ui.allocate_exact_size(vec2(top_w, 236.0), Sense::click());
                let t = res.tracks[0].clone();
                ui.painter().rect_filled(card, 12, if resp.hovered() { Color32::from_white_alpha(26) } else { Color32::from_white_alpha(14) });
                let c = Rect::from_min_size(card.min + vec2(20.0, 20.0), vec2(104.0, 104.0));
                self.cover(ui, c, t.image_large.as_ref(), 300, 6, &t.name);
                text_at(ui.painter(), pos2(card.left() + 20.0, c.bottom() + 34.0), &t.name, display(28.0), TEXT, top_w - 40.0, Align::Center);
                text_at(ui.painter(), pos2(card.left() + 20.0, c.bottom() + 70.0), &format!("Música • {}", t.artists), regular(14.5), MUTED, top_w - 100.0, Align::Center);
                if resp.hovered() {
                    let pb = Rect::from_center_size(pos2(card.right() - 44.0, card.bottom() - 44.0), vec2(52.0, 52.0));
                    ui.painter().circle_filled(pb.center(), 26.0, self.accent());
                    icons::paint(ui.painter(), pb.shrink(15.0), Icon::Play, DARK_TEXT);
                }
                if resp.on_hover_cursor(CursorIcon::PointingHand).clicked() {
                    self.remember_search();
                    self.play_tracks(res.tracks.clone(), 0, None, format!("Busca: {}", res.query));
                }
                // Lista ao lado.
                let list_rect = Rect::from_min_max(pos2(start.x + top_w + 24.0, start.y), pos2(start.x + width, start.y + 280.0));
                let mut child = ui.new_child(UiBuilder::new().max_rect(list_rect));
                child.label(RichText::new("Músicas").font(bold(20.0)).color(TEXT));
                child.add_space(10.0);
                for i in 0..list_n.min(4) {
                    if self.compact_track(&mut child, &res.tracks[i], i) {
                        self.remember_search();
                        self.play_tracks(res.tracks.clone(), i, None, format!("Busca: {}", res.query));
                    }
                }
            } else {
                ui.label(RichText::new("Músicas").font(bold(20.0)).color(TEXT));
                ui.add_space(8.0);
                for i in 0..list_n.min(res.tracks.len()) {
                    if self.compact_track(ui, &res.tracks[i], i) {
                        self.remember_search();
                        self.play_tracks(res.tracks.clone(), i, None, format!("Busca: {}", res.query));
                    }
                }
            }
            ui.add_space(24.0);
        }
        for (t, title, items) in [
            (SearchTab::Artists, "Artistas", &res.artists),
            (SearchTab::Albums, "Álbuns", &res.albums),
            (SearchTab::Playlists, "Playlists", &res.playlists),
        ] {
            if show(t) && !items.is_empty() {
                any = true;
                ui.label(RichText::new(title).font(bold(20.0)).color(TEXT));
                ui.add_space(6.0);
                let rows = if tab == SearchTab::All { 1 } else { 4 };
                let list: Vec<Collection> = items.clone();
                let clicked = self.card_grid(
                    ui,
                    title,
                    list.iter().map(|c| (c.image.clone(), c.name.clone(), c.subtitle.clone(), c.kind == Kind::Artist)).collect(),
                    rows,
                );
                if let Some(i) = clicked {
                    self.remember_search();
                    self.go(View::List(list[i].key()));
                }
                ui.add_space(20.0);
            }
        }
        if !any && !self.searching {
            ui.add_space(40.0);
            ui.vertical_centered(|ui| {
                ui.label(RichText::new(format!("Nada encontrado para “{}”", res.query)).font(bold(22.0)).color(TEXT));
                ui.add_space(6.0);
                ui.label(RichText::new("Confira a grafia ou tente outro termo.").color(MUTED));
            });
        }
    }

    /// Linha simples de música (busca). Retorna true se clicou pra tocar.
    fn compact_track(&mut self, ui: &mut Ui, t: &Track, i: usize) -> bool {
        let (rect, resp) = ui.allocate_exact_size(vec2(ui.available_width(), 58.0), Sense::click());
        let hovered = ui.rect_contains_pointer(rect);
        if hovered {
            ui.painter().rect_filled(rect, 6, hover_fill());
        }
        let c = Rect::from_min_size(pos2(rect.left() + 8.0, rect.top() + 7.0), vec2(44.0, 44.0));
        self.cover(ui, c, t.image_small.as_ref(), 96, 4, &t.name);
        let is_cur = self.current().map(|c| c.id == t.id).unwrap_or(false);
        let accent = self.accent();
        let tw = rect.width() - 160.0;
        text_at(ui.painter(), pos2(c.right() + 12.0, rect.center().y - 10.0), &t.name, regular(15.5), if is_cur { accent } else { TEXT }, tw, Align::Center);
        text_at(ui.painter(), pos2(c.right() + 12.0, rect.center().y + 11.0), &t.artists, regular(13.5), MUTED, tw, Align::Center);
        ui.painter().text(pos2(rect.right() - 14.0, rect.center().y), Align2::RIGHT_CENTER, fmt_ms(t.duration_ms), regular(13.5), MUTED);
        let liked = self.liked.get(&t.id).copied().unwrap_or(false);
        let hr = Rect::from_center_size(pos2(rect.right() - 80.0, rect.center().y), vec2(36.0, 36.0));
        if liked || hovered {
            let h = icon_button_at(ui, hr, Id::new(("sh", i, &t.id)), if liked { Icon::HeartFilled } else { Icon::Heart }, 18.0, liked, accent);
            if h.clicked() {
                self.toggle_like(&t.id);
                return false;
            }
        }
        resp.on_hover_cursor(CursorIcon::PointingHand).clicked()
    }

    // ------------------------------------------------------------ lista

    fn list_order(&self, data: &ListData) -> Vec<usize> {
        let f = fold(self.list_filter.trim());
        let mut idx: Vec<usize> = (0..data.tracks.len())
            .filter(|&i| {
                if f.is_empty() {
                    return true;
                }
                let t = &data.tracks[i];
                fold(&format!("{} {} {}", t.name, t.artists, t.album)).contains(&f)
            })
            .collect();
        let tr = &data.tracks;
        match self.sort {
            Sort::Custom => {}
            Sort::Title => idx.sort_by_key(|&i| fold(&tr[i].name)),
            Sort::Album => idx.sort_by_key(|&i| fold(&tr[i].album)),
            Sort::Added => idx.sort_by(|&a, &b| tr[a].added_at.cmp(&tr[b].added_at)),
            Sort::Duration => idx.sort_by_key(|&i| tr[i].duration_ms),
        }
        if !self.sort_asc {
            idx.reverse();
        }
        idx
    }

    fn list_view(&mut self, ui: &mut Ui, key: &ListKey) {
        let Some(data) = self.lists.get(key) else {
            ui.add_space(30.0);
            if let Some(err) = self.list_errors.get(key).cloned() {
                ui.label(RichText::new("Não consegui abrir essa lista.").font(bold(20.0)).color(TEXT));
                ui.add_space(6.0);
                ui.label(RichText::new(err).color(MUTED));
                ui.add_space(12.0);
                if pill_button(ui, "Tentar de novo", Color32::from_white_alpha(30), TEXT, vec2(160.0, 40.0)).clicked() {
                    self.list_errors.remove(key);
                    self.send(Cmd::OpenList(key.clone()));
                }
            } else {
                ui.horizontal(|ui| {
                    ui.spinner();
                    ui.label(RichText::new("Carregando…").color(MUTED));
                });
            }
            return;
        };
        let title = data.title.clone();
        let kind = data.kind_label.clone();
        let owner = data.owner.clone();
        let desc = data.description.clone();
        let image = data.image.clone().or_else(|| data.tracks.first().and_then(|t| t.image_large.clone()));
        let count = data.total.max(data.tracks.len() as u32);
        let loaded_ms: u64 = data.tracks.iter().map(|t| t.duration_ms as u64).sum();
        let complete = data.complete;
        let order = self.list_order(data);
        let accent = self.accent();

        // Cabeçalho
        let width = ui.available_width();
        let head_h = 232.0;
        let (head, _) = ui.allocate_exact_size(vec2(width, head_h), Sense::hover());
        let c = Rect::from_min_size(pos2(head.left(), head.top() + 6.0), vec2(220.0, 220.0));
        ui.painter().rect_filled(c.translate(vec2(0.0, 10.0)).expand(4.0), 10, Color32::from_black_alpha(60));
        if *key == ListKey::Liked {
            self.liked_cover(ui.painter(), c, 6);
        } else {
            let round = matches!(key, ListKey::Artist(_));
            self.cover(ui, c, image.as_ref(), 300, if round { 110 } else { 6 }, &title);
        }
        let tx = c.right() + 28.0;
        let tw = head.right() - tx;
        let mut ty = c.bottom() - 6.0;
        let meta = format!(
            "{}{}{}{}",
            if owner.is_empty() { String::new() } else { format!("{owner} • ") },
            if count == 1 { "1 música".to_string() } else { format!("{count} músicas") },
            if complete { format!(", {}", fmt_total(loaded_ms)) } else { String::new() },
            if complete { "" } else { " (carregando…)" }
        );
        text_at(ui.painter(), pos2(tx, ty), &meta, regular(14.5), Color32::from_rgb(0xC6, 0xC8, 0xCC), tw, Align::BOTTOM);
        ty -= 26.0;
        if !desc.is_empty() {
            text_at(ui.painter(), pos2(tx, ty), &desc, regular(14.0), MUTED, tw, Align::BOTTOM);
            ty -= 24.0;
        }
        let size = if title.chars().count() > 24 { 46.0 } else { 70.0 };
        let size = fit_size(ui, &title, size, tw);
        text_at(ui.painter(), pos2(tx, ty), &title, display(size), TEXT, tw, Align::BOTTOM);
        ty -= size * 1.2;
        text_at(ui.painter(), pos2(tx, ty), &kind, semibold(14.0), TEXT, tw, Align::BOTTOM);

        ui.add_space(14.0);

        // Ações
        let (row, _) = ui.allocate_exact_size(vec2(width, 64.0), Sense::hover());
        let pb = Rect::from_center_size(pos2(row.left() + 32.0, row.center().y), vec2(60.0, 60.0));
        let this_playing = self.ctx_key.as_ref() == Some(key) && self.playing;
        let presp = ui.interact(pb, Id::new("listplay"), Sense::click()).on_hover_cursor(CursorIcon::PointingHand);
        let grow = if presp.hovered() { 1.0 } else { 0.0 };
        ui.painter().circle_filled(pb.center(), 30.0 + grow, accent);
        icons::paint(ui.painter(), pb.shrink(17.0), if this_playing { Icon::Pause } else { Icon::Play }, DARK_TEXT);
        if presp.on_hover_text(if this_playing { "Pausar" } else { "Tocar" }).clicked() {
            if self.ctx_key.as_ref() == Some(key) && self.has_track {
                self.toggle_play();
            } else if let Some(d) = self.lists.get(key) {
                let tracks: Vec<Track> = order.iter().map(|&i| d.tracks[i].clone()).collect();
                let start = if self.shuffle && !tracks.is_empty() { (self.rand() % tracks.len() as u64) as usize } else { 0 };
                self.play_tracks(tracks, start, Some(key.clone()), title.clone());
            }
        }
        let sb = Rect::from_center_size(pos2(pb.right() + 36.0, row.center().y), vec2(48.0, 48.0));
        if icon_button_at(ui, sb, Id::new("listshuffle"), Icon::Shuffle, 28.0, self.shuffle, accent)
            .on_hover_text("Ordem aleatória")
            .clicked()
        {
            self.toggle_shuffle();
        }
        let fw = (width * 0.32).clamp(180.0, 300.0);
        let fr = Rect::from_min_size(pos2(row.right() - fw, row.center().y - 21.0), vec2(fw, 42.0));
        let mut child = ui.new_child(UiBuilder::new().max_rect(fr));
        search_field(&mut child, &mut self.list_filter, "Filtrar", fw, 42.0, Id::new("listfilter"), false, 21);

        ui.add_space(10.0);

        // Tabela
        let show_album = width > 640.0;
        let show_added = width > 880.0 && order.iter().any(|&i| self.lists[key].tracks[i].added_at.is_some());
        let cols = Cols::new(width, show_album, show_added);
        let (hr, _) = ui.allocate_exact_size(vec2(width, 36.0), Sense::hover());
        ui.painter().line_segment([pos2(hr.left(), hr.bottom()), pos2(hr.right(), hr.bottom())], Stroke::new(1.0, LINE));
        let hy = hr.center().y;
        let head_font = semibold(12.5);
        ui.painter().text(pos2(hr.left() + cols.num_x, hy), Align2::CENTER_CENTER, "#", head_font.clone(), MUTED);
        let mut sort_btn = |ui: &mut Ui, x: f32, w: f32, label: &str, s: Sort, id: &str| {
            let arrow = if self.sort == s { if self.sort_asc { " ↑" } else { " ↓" } } else { "" };
            let text = format!("{}{arrow}", label.to_uppercase());
            let tw = text_width(ui, &text, head_font.clone());
            let r = Rect::from_min_size(pos2(hr.left() + x, hy - 12.0), vec2(tw.min(w) + 4.0, 24.0));
            let resp = ui.interact(r, Id::new(("sort", id)), Sense::click()).on_hover_cursor(CursorIcon::PointingHand);
            let color = if resp.hovered() || self.sort == s { TEXT } else { MUTED };
            text_at(ui.painter(), pos2(r.left(), hy), &text, head_font.clone(), color, w, Align::Center);
            if resp.clicked() {
                if self.sort != s {
                    self.sort = s;
                    self.sort_asc = true;
                } else if self.sort_asc {
                    self.sort_asc = false;
                } else {
                    self.sort = Sort::Custom;
                    self.sort_asc = true;
                }
            }
        };
        sort_btn(ui, cols.title_x, cols.title_w, "Título", Sort::Title, "t");
        if show_album {
            sort_btn(ui, cols.album_x, cols.album_w, "Álbum", Sort::Album, "a");
        }
        if show_added {
            sort_btn(ui, cols.added_x, cols.added_w, "Adicionada em", Sort::Added, "d");
        }
        {
            let r = Rect::from_center_size(pos2(hr.left() + cols.dur_x + 18.0, hy), vec2(44.0, 24.0));
            let resp = ui.interact(r, Id::new(("sort", "dur")), Sense::click()).on_hover_text("Ordenar por duração");
            let color = if resp.hovered() || self.sort == Sort::Duration { TEXT } else { MUTED };
            icons::paint(ui.painter(), Rect::from_center_size(r.center() + vec2(8.0, 0.0), vec2(17.0, 17.0)), Icon::Clock, color);
            if self.sort == Sort::Duration {
                ui.painter().text(r.center() - vec2(10.0, 0.0), Align2::CENTER_CENTER, if self.sort_asc { "↑" } else { "↓" }, head_font.clone(), TEXT);
            }
            if resp.clicked() {
                if self.sort != Sort::Duration {
                    self.sort = Sort::Duration;
                    self.sort_asc = true;
                } else if self.sort_asc {
                    self.sort_asc = false;
                } else {
                    self.sort = Sort::Custom;
                }
            }
        }
        ui.add_space(8.0);

        let cur_id = self.current().map(|t| t.id.clone());
        let mut play_at: Option<usize> = None;
        let mut like: Option<String> = None;
        for (row_i, &ti) in order.iter().enumerate() {
            let (rect, resp) = ui.allocate_exact_size(vec2(width, 62.0), Sense::click());
            if !ui.is_rect_visible(rect) {
                continue;
            }
            let t = self.lists[key].tracks[ti].clone();
            let hovered = ui.rect_contains_pointer(rect);
            if hovered {
                ui.painter().rect_filled(rect, 6, hover_fill());
            }
            let is_cur = cur_id.as_deref() == Some(t.id.as_str());
            let y = rect.center().y;
            let n = if self.sort == Sort::Custom && self.list_filter.trim().is_empty() { ti + 1 } else { row_i + 1 };
            if is_cur && self.playing && !hovered {
                icons::paint(ui.painter(), Rect::from_center_size(pos2(rect.left() + cols.num_x, y), vec2(17.0, 17.0)), Icon::Speaker, accent);
            } else if hovered {
                icons::paint(ui.painter(), Rect::from_center_size(pos2(rect.left() + cols.num_x, y), vec2(15.0, 15.0)), if is_cur && self.playing { Icon::Pause } else { Icon::Play }, TEXT);
            } else {
                let color = if is_cur { accent } else { MUTED };
                ui.painter().text(pos2(rect.left() + cols.num_x, y), Align2::CENTER_CENTER, n.to_string(), regular(14.5), color);
            }
            let c = Rect::from_min_size(pos2(rect.left() + cols.title_x, y - 23.0), vec2(46.0, 46.0));
            self.cover(ui, c, t.image_small.as_ref(), 96, 4, &t.album);
            let tw = cols.title_w - 60.0;
            text_at(ui.painter(), pos2(c.right() + 14.0, y - 10.0), &t.name, regular(15.5), if is_cur { accent } else { TEXT }, tw, Align::Center);
            text_at(ui.painter(), pos2(c.right() + 14.0, y + 11.0), &t.artists, regular(13.5), MUTED, tw, Align::Center);
            if cols.show_album {
                text_at(ui.painter(), pos2(rect.left() + cols.album_x, y), &t.album, regular(14.0), MUTED, cols.album_w - 16.0, Align::Center);
            }
            if cols.show_added {
                if let Some(d) = &t.added_at {
                    text_at(ui.painter(), pos2(rect.left() + cols.added_x, y), &fmt_date(d), regular(14.0), MUTED, cols.added_w - 10.0, Align::Center);
                }
            }
            ui.painter().text(pos2(rect.right() - 16.0, y), Align2::RIGHT_CENTER, fmt_ms(t.duration_ms), regular(14.0), MUTED);
            let liked = self.liked.get(&t.id).copied().unwrap_or(false);
            if liked || hovered {
                let hr = Rect::from_center_size(pos2(rect.left() + cols.heart_x, y), vec2(36.0, 36.0));
                if icon_button_at(ui, hr, Id::new(("heart", ti)), if liked { Icon::HeartFilled } else { Icon::Heart }, 18.0, liked, accent)
                    .on_hover_text(if liked { "Remover das curtidas" } else { "Curtir" })
                    .clicked()
                {
                    like = Some(t.id.clone());
                    continue;
                }
            }
            if resp.on_hover_cursor(CursorIcon::PointingHand).clicked() {
                play_at = Some(row_i);
            }
        }
        if order.is_empty() {
            ui.add_space(24.0);
            ui.vertical_centered(|ui| {
                let msg = if !self.list_filter.trim().is_empty() {
                    format!("Nada aqui combina com “{}”.", self.list_filter.trim())
                } else if *key == ListKey::Liked {
                    "Nenhuma música curtida ainda.".into()
                } else {
                    "Essa lista está vazia.".into()
                };
                ui.label(RichText::new(msg).color(MUTED));
            });
        }
        if let Some(id) = like {
            self.toggle_like(&id);
        }
        if let Some(i) = play_at {
            let tracks: Vec<Track> = order.iter().map(|&k| self.lists[key].tracks[k].clone()).collect();
            if self.ctx_key.as_ref() == Some(key) && self.current().map(|c| c.id == tracks[i].id).unwrap_or(false) {
                self.toggle_play();
            } else {
                self.play_tracks(tracks, i, Some(key.clone()), title);
            }
        }
    }

    // ------------------------------------------------------------ configurações

    fn settings_view(&mut self, ui: &mut Ui) {
        let accent = self.accent();
        ui.label(RichText::new("Configurações").font(display(30.0)).color(TEXT));
        ui.add_space(14.0);
        let width = ui.available_width().min(820.0);

        section(ui, "Aparência");
        setting_row(ui, width, "Cor de destaque", "Botão de tocar, música atual e ícones ativos.", |ui| {
            let mut changed = None;
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 12.0;
                for (rgb, name) in ACCENTS.iter().rev() {
                    let (r, resp) = ui.allocate_exact_size(vec2(34.0, 34.0), Sense::click());
                    ui.painter().circle_filled(r.center(), 15.0, theme::accent(*rgb));
                    if *rgb == self.s.accent {
                        ui.painter().circle_stroke(r.center(), 17.5, Stroke::new(2.0, TEXT));
                    }
                    if resp.on_hover_text(*name).on_hover_cursor(CursorIcon::PointingHand).clicked() {
                        changed = Some(*rgb);
                    }
                }
            });
            if let Some(rgb) = changed {
                self.s.accent = rgb;
                self.s.save();
            }
        });

        section(ui, "Reprodução");
        let mut audio_changed = false;
        setting_row(ui, width, "Qualidade do streaming", "Mais alta = som melhor, usa mais internet.", |ui| {
            let opts = [(96u16, "Normal"), (160, "Alta"), (320, "Muito alta")];
            if let Some(q) = segmented(ui, &opts.map(|(q, l)| (q, l)), self.s.quality, accent) {
                self.s.quality = q;
                audio_changed = true;
            }
        });
        setting_row(ui, width, "Normalização de volume", "Deixa todas as músicas no mesmo volume.", |ui| {
            if switch(ui, self.s.normalize, accent).clicked() {
                self.s.normalize = !self.s.normalize;
                audio_changed = true;
            }
        });
        if audio_changed {
            self.s.save();
            self.send(Cmd::ApplyAudio { quality: self.s.quality, normalize: self.s.normalize });
            if let Some(t) = self.current().cloned() {
                let pos = self.position_ms();
                let play = self.playing;
                self.send(Cmd::Load { uri: t.uri, play, position_ms: pos });
            }
            self.toast("Configuração de áudio aplicada.", false);
        }

        section(ui, "Atualizações");
        let status = match &self.update {
            Upd::Idle | Upd::UpToDate => format!("Vitral {} · está atualizado", env!("CARGO_PKG_VERSION")),
            Upd::Checking => "Procurando versão nova…".to_string(),
            Upd::Available(i) => format!("Vitral {} · a versão {} já saiu", env!("CARGO_PKG_VERSION"), i.version),
            Upd::Downloading(i, p) => format!("Baixando a versão {} · {:.0}%", i.version, p * 100.0),
            Upd::Ready(i) => format!("Versão {} baixada · reinicie pra usar", i.version),
            Upd::Failed(e) => format!("Vitral {} · {e}", env!("CARGO_PKG_VERSION")),
        };
        setting_row(ui, width, "Versão instalada", &status, |ui| {
            let label = match &self.update {
                Upd::Checking => "Procurando…",
                Upd::Available(_) | Upd::Ready(_) => "Ver atualização",
                Upd::Downloading(..) => "Baixando…",
                _ => "Procurar agora",
            };
            if outline_button(ui, label, vec2(150.0, 36.0)).clicked() {
                match &self.update {
                    Upd::Available(_) | Upd::Ready(_) | Upd::Downloading(..) => self.upd_dialog = true,
                    Upd::Checking => {}
                    _ => {
                        self.update = Upd::Checking;
                        if self.demo {
                            self.update = Upd::UpToDate;
                            self.toast("Você já está na versão mais nova.", false);
                        } else {
                            self.send(Cmd::CheckUpdate { manual: true, token: self.s.github_token.clone() });
                        }
                    }
                }
            }
        });
        setting_row(ui, width, "Procurar atualizações ao abrir o app", "Só confere se saiu versão nova.", |ui| {
            if switch(ui, self.s.check_updates, accent).clicked() {
                self.s.check_updates = !self.s.check_updates;
                self.s.save();
            }
        });
        let hint = if self.s.update_mode == UpdateMode::Ask {
            "O app pergunta: atualizar agora, sim ou não?"
        } else {
            "Baixa sozinho e só pede pra reiniciar quando estiver pronto."
        };
        setting_row(ui, width, "Quando sair versão nova", hint, |ui| {
            let opts = [(UpdateMode::Ask, "Perguntar antes"), (UpdateMode::Auto, "Instalar sozinho")];
            if let Some(m) = segmented(ui, &opts, self.s.update_mode, accent) {
                self.s.update_mode = m;
                self.s.save();
            }
        });

        let token_hint = if self.s.github_token.trim().is_empty() {
            "O repositório das versões é privado. Cole aqui um token de leitura do GitHub."
        } else {
            "Token salvo neste computador."
        };
        setting_row(ui, width, "Token do GitHub", token_hint, |ui| {
            let (rect, _) = ui.allocate_exact_size(vec2(280.0, 40.0), Sense::hover());
            ui.painter().rect_filled(rect, 8, Color32::from_white_alpha(20));
            let te = egui::TextEdit::singleline(&mut self.s.github_token)
                .password(true)
                .frame(Frame::NONE)
                .hint_text(RichText::new("github_pat_…").color(MUTED))
                .font(regular(13.5))
                .text_color(TEXT)
                .margin(Margin::ZERO)
                .align(Align2::LEFT_CENTER)
                .desired_width(rect.width() - 24.0);
            let resp = ui.put(rect.shrink2(vec2(12.0, 0.0)), te);
            if resp.lost_focus() {
                self.s.github_token = self.s.github_token.trim().to_string();
                self.s.save();
            }
        });
        ui.label(
            RichText::new(format!(
                "Como criar: github.com → Settings → Developer settings → Fine-grained tokens → Generate new token. \
Em “Repository access” escolha só {}, e em “Permissions” dê Contents: Read-only.",
                updater::REPO
            ))
            .font(regular(12.5))
            .color(MUTED),
        );

        section(ui, "Conta");
        let who = self.user.as_ref().map(|u| format!("Conectado como {}", u.name)).unwrap_or_default();
        setting_row(ui, width, "Spotify", &who, |ui| {
            if outline_button(ui, "Sair da conta", vec2(150.0, 36.0)).clicked() {
                self.send(Cmd::Logout);
            }
        });

        section(ui, "Atalhos de teclado");
        for (label, keys) in [
            ("Tocar / pausar", "Espaço"),
            ("Próxima música", "Ctrl + →"),
            ("Música anterior", "Ctrl + ←"),
            ("Buscar", "Ctrl + K"),
            ("Curtir a música atual", "Ctrl + L"),
            ("Mostrar / esconder a fila", "Ctrl + Q"),
            ("Volume", "Ctrl + ↑ / ↓"),
        ] {
            let (r, _) = ui.allocate_exact_size(vec2(width, 42.0), Sense::hover());
            text_at(ui.painter(), pos2(r.left(), r.center().y), label, regular(14.5), TEXT, width - 160.0, Align::Center);
            let kw = text_width(ui, keys, semibold(12.5)) + 20.0;
            let kr = Rect::from_center_size(pos2(r.right() - kw / 2.0, r.center().y), vec2(kw, 26.0));
            ui.painter().rect_filled(kr, 6, Color32::from_white_alpha(18));
            ui.painter().rect_stroke(kr, 6, Stroke::new(1.0, Color32::from_white_alpha(36)), StrokeKind::Inside);
            ui.painter().text(kr.center(), Align2::CENTER_CENTER, keys, semibold(12.5), TEXT);
            ui.painter().line_segment([pos2(r.left(), r.bottom()), pos2(r.right(), r.bottom())], Stroke::new(1.0, Color32::from_white_alpha(10)));
        }

        section(ui, "Sobre");
        let dir = data_dir();
        setting_row(ui, width, &format!("Vitral {}", env!("CARGO_PKG_VERSION")), &format!("Configurações, login e registro de erros ficam em {}", dir.display()), |ui| {
            if outline_button(ui, "Abrir pasta", vec2(130.0, 36.0)).clicked() {
                open_folder(&dir);
            }
        });
        ui.add_space(6.0);
        ui.label(
            RichText::new(format!(
                "Atualizações vêm de github.com/{} (aba Releases). App pessoal, sem ligação oficial com o Spotify.",
                updater::REPO
            ))
            .font(regular(12.5))
            .color(FAINT),
        );
    }

    // ------------------------------------------------------------ fila

    fn queue_panel(&mut self, ui: &mut Ui) {
        let accent = self.accent();
        let (hr, _) = ui.allocate_exact_size(vec2(ui.available_width(), 40.0), Sense::hover());
        text_at(ui.painter(), pos2(hr.left() + 8.0, hr.center().y), "Fila", bold(20.0), TEXT, 200.0, Align::Center);
        let cb = Rect::from_center_size(pos2(hr.right() - 20.0, hr.center().y), vec2(36.0, 36.0));
        if icon_button_at(ui, cb, Id::new("closeq"), Icon::Close, 18.0, false, accent).on_hover_text("Fechar a fila").clicked() {
            self.s.show_queue = false;
        }
        ui.add_space(6.0);
        if !self.has_track {
            ui.add_space(20.0);
            ui.horizontal_wrapped(|ui| {
                ui.add_space(8.0);
                ui.label(RichText::new("Nada tocando ainda. Escolha uma música pra começar.").color(MUTED));
            });
            return;
        }
        egui::ScrollArea::vertical().id_salt("queue").auto_shrink([false, false]).show(ui, |ui| {
            ui.spacing_mut().item_spacing.y = 0.0;
            ui.label(RichText::new("Tocando agora").font(bold(15.5)).color(TEXT));
            ui.add_space(6.0);
            let cur = self.queue[self.qpos].clone();
            if self.queue_row(ui, &cur, true, usize::MAX) {
                self.toggle_play();
            }
            ui.add_space(18.0);
            let (r, _) = ui.allocate_exact_size(vec2(ui.available_width(), 24.0), Sense::hover());
            text_at(ui.painter(), pos2(r.left(), r.center().y), "A seguir", bold(15.5), TEXT, 120.0, Align::Center);
            if !self.ctx_name.is_empty() {
                let label = format!("de {}{}", self.ctx_name, if self.shuffle { " · aleatório" } else { "" });
                text_at(ui.painter(), pos2(r.left() + 84.0, r.center().y), &label, regular(12.5), MUTED, r.width() - 90.0, Align::Center);
            }
            ui.add_space(6.0);
            let end = (self.qpos + 1 + 100).min(self.queue.len());
            let mut jump = None;
            for i in self.qpos + 1..end {
                let t = self.queue[i].clone();
                if self.queue_row(ui, &t, false, i) {
                    jump = Some(i);
                }
            }
            if self.qpos + 1 >= self.queue.len() {
                ui.add_space(6.0);
                ui.label(RichText::new(if self.repeat == Repeat::All { "A lista recomeça depois desta." } else { "Fim da fila." }).color(MUTED));
            }
            if let Some(i) = jump {
                self.qpos = i;
                self.load_current(true, 0);
            }
        });
    }

    fn queue_row(&mut self, ui: &mut Ui, t: &Track, current: bool, i: usize) -> bool {
        let (rect, resp) = ui.allocate_exact_size(vec2(ui.available_width(), 62.0), Sense::click());
        if !ui.is_rect_visible(rect) {
            return false;
        }
        let hovered = ui.rect_contains_pointer(rect);
        if hovered {
            ui.painter().rect_filled(rect, 6, hover_fill());
        }
        let accent = self.accent();
        let c = Rect::from_min_size(pos2(rect.left() + 6.0, rect.top() + 7.0), vec2(48.0, 48.0));
        self.cover(ui, c, t.image_small.as_ref(), 96, 4, &t.album);
        let tw = rect.width() - 48.0 - 110.0;
        text_at(ui.painter(), pos2(c.right() + 12.0, rect.center().y - 10.0), &t.name, regular(15.5), if current { accent } else { TEXT }, tw, Align::Center);
        text_at(ui.painter(), pos2(c.right() + 12.0, rect.center().y + 11.0), &t.artists, regular(13.5), MUTED, tw, Align::Center);
        ui.painter().text(pos2(rect.right() - 8.0, rect.center().y), Align2::RIGHT_CENTER, fmt_ms(t.duration_ms), regular(13.5), MUTED);
        let liked = self.liked.get(&t.id).copied().unwrap_or(false);
        if liked || hovered {
            let hr = Rect::from_center_size(pos2(rect.right() - 70.0, rect.center().y), vec2(34.0, 34.0));
            if icon_button_at(ui, hr, Id::new(("qh", i, &t.id)), if liked { Icon::HeartFilled } else { Icon::Heart }, 18.0, liked, accent).clicked() {
                self.toggle_like(&t.id);
                return false;
            }
        }
        resp.on_hover_cursor(CursorIcon::PointingHand).clicked()
    }

    // ------------------------------------------------------------ player

    fn player_bar(&mut self, ui: &mut Ui) {
        let accent = self.accent();
        let full = ui.max_rect();
        let cy = full.center().y;
        let cur = self.current().cloned();

        // Esquerda: música atual.
        let left_w = (full.width() * 0.3).min(400.0);
        if let Some(t) = &cur {
            let c = Rect::from_min_size(pos2(full.left(), cy - 32.0), vec2(64.0, 64.0));
            self.cover(ui, c, t.image_small.as_ref(), 128, 6, &t.album);
            let tw = left_w - 64.0 - 70.0;
            let name_w = text_width(ui, &t.name, semibold(15.0)).min(tw);
            let art_w = text_width(ui, &t.artists, regular(13.5)).min(tw);
            text_at(ui.painter(), pos2(c.right() + 14.0, cy - 10.0), &t.name, semibold(15.0), TEXT, tw, Align::Center);
            text_at(ui.painter(), pos2(c.right() + 14.0, cy + 12.0), &t.artists, regular(13.5), MUTED, tw, Align::Center);
            let liked = self.liked.get(&t.id).copied().unwrap_or(false);
            let hx = c.right() + 14.0 + name_w.max(art_w) + 26.0;
            let hr = Rect::from_center_size(pos2(hx, cy), vec2(36.0, 36.0));
            if icon_button_at(ui, hr, Id::new("barlike"), if liked { Icon::HeartFilled } else { Icon::Heart }, 20.0, liked, accent)
                .on_hover_text(if liked { "Remover das curtidas" } else { "Curtir" })
                .clicked()
            {
                let id = t.id.clone();
                self.toggle_like(&id);
            }
        }

        // Centro: controles e progresso.
        let cx = full.center().x;
        let by = full.top() + 22.0;
        let shuffle_r = Rect::from_center_size(pos2(cx - 100.0, by), vec2(36.0, 36.0));
        if icon_button_at(ui, shuffle_r, Id::new("shuf"), Icon::Shuffle, 19.0, self.shuffle, accent).on_hover_text("Ordem aleatória").clicked() {
            self.toggle_shuffle();
        }
        if self.shuffle {
            ui.painter().circle_filled(pos2(shuffle_r.center().x, shuffle_r.bottom() - 1.0), 2.0, accent);
        }
        let prev_r = Rect::from_center_size(pos2(cx - 52.0, by), vec2(36.0, 36.0));
        if icon_button_at(ui, prev_r, Id::new("prev"), Icon::Prev, 20.0, false, accent).on_hover_text("Anterior").clicked() {
            self.prev();
        }
        let play_r = Rect::from_center_size(pos2(cx, by), vec2(42.0, 42.0));
        let presp = ui.interact(play_r, Id::new("play"), Sense::click()).on_hover_cursor(CursorIcon::PointingHand);
        ui.painter().circle_filled(play_r.center(), if presp.hovered() { 22.0 } else { 21.0 }, TEXT);
        if self.loading && self.playing {
            let t = ui.input(|i| i.time) as f32;
            let a0 = t * 5.0;
            let pts: Vec<egui::Pos2> = (0..=20).map(|k| {
                let a = a0 + k as f32 / 20.0 * 4.0;
                play_r.center() + vec2(a.cos(), a.sin()) * 9.0
            }).collect();
            ui.painter().add(egui::Shape::line(pts, Stroke::new(2.4, DARK_TEXT)));
            ui.ctx().request_repaint();
        } else {
            icons::paint(ui.painter(), play_r.shrink(11.0), if self.playing { Icon::Pause } else { Icon::Play }, DARK_TEXT);
        }
        if presp.on_hover_text(if self.playing { "Pausar (Espaço)" } else { "Tocar (Espaço)" }).clicked() {
            self.toggle_play();
        }
        let next_r = Rect::from_center_size(pos2(cx + 52.0, by), vec2(36.0, 36.0));
        if icon_button_at(ui, next_r, Id::new("next"), Icon::Next, 20.0, false, accent).on_hover_text("Próxima").clicked() {
            self.next(false);
        }
        let rep_r = Rect::from_center_size(pos2(cx + 100.0, by), vec2(36.0, 36.0));
        let rep_icon = if self.repeat == Repeat::One { Icon::RepeatOne } else { Icon::Repeat };
        let rep_tip = match self.repeat {
            Repeat::Off => "Repetir",
            Repeat::All => "Repetindo a lista",
            Repeat::One => "Repetindo esta música",
        };
        if icon_button_at(ui, rep_r, Id::new("rep"), rep_icon, 19.0, self.repeat != Repeat::Off, accent).on_hover_text(rep_tip).clicked() {
            self.repeat = match self.repeat {
                Repeat::Off => Repeat::All,
                Repeat::All => Repeat::One,
                Repeat::One => Repeat::Off,
            };
        }
        if self.repeat != Repeat::Off {
            ui.painter().circle_filled(pos2(rep_r.center().x, rep_r.bottom() - 1.0), 2.0, accent);
        }

        let bar_w = (full.width() * 0.4).clamp(220.0, 620.0);
        let py = full.bottom() - 16.0;
        let br = Rect::from_center_size(pos2(cx, py), vec2(bar_w, 12.0));
        let dur = cur.as_ref().map(|t| t.duration_ms).unwrap_or(0);
        let pos = self.position_ms();
        let frac = if dur > 0 { pos as f32 / dur as f32 } else { 0.0 };
        let (sresp, shown) = slider(ui, br, Id::new("seek"), frac, TEXT, accent);
        let shown_ms = (shown * dur as f32) as u32;
        ui.painter().text(pos2(br.left() - 12.0, py), Align2::RIGHT_CENTER, fmt_ms(if sresp.dragged() { shown_ms } else { pos }), regular(12.5), MUTED);
        ui.painter().text(pos2(br.right() + 12.0, py), Align2::LEFT_CENTER, fmt_ms(dur), regular(12.5), MUTED);
        if (sresp.drag_stopped() || sresp.clicked()) && dur > 0 {
            self.seek(shown_ms);
        }

        // Direita: qualidade, fila, volume.
        let mut x = full.right();
        let vol_w = 110.0;
        let vr = Rect::from_min_size(pos2(x - vol_w, cy - 6.0), vec2(vol_w, 12.0));
        let (vresp, v) = slider(ui, vr, Id::new("vol"), self.s.volume, TEXT, accent);
        if vresp.dragged() || vresp.clicked() {
            self.set_volume(v);
        }
        if vresp.drag_stopped() {
            self.s.save();
        }
        x = vr.left() - 10.0;
        let mr = Rect::from_center_size(pos2(x - 18.0, cy), vec2(36.0, 36.0));
        let vol_icon = if self.s.volume <= 0.001 { Icon::VolumeMute } else { Icon::Volume };
        if icon_button_at(ui, mr, Id::new("mute"), vol_icon, 20.0, false, accent).on_hover_text("Silenciar").clicked() {
            if let Some(prev) = self.muted_volume.take() {
                self.set_volume(prev);
            } else {
                let prev = self.s.volume;
                self.set_volume(0.0);
                self.muted_volume = Some(prev.max(0.05));
            }
        }
        x = mr.left() - 6.0;
        let qr = Rect::from_center_size(pos2(x - 18.0, cy), vec2(36.0, 36.0));
        if icon_button_at(ui, qr, Id::new("queue"), Icon::Queue, 20.0, self.s.show_queue, accent).on_hover_text("Fila (Ctrl+Q)").clicked() {
            self.s.show_queue = !self.s.show_queue;
            self.s.save();
        }
        x = qr.left() - 10.0;
        if full.width() > 900.0 {
            let label = format!("{} kbps", self.s.quality);
            let w = text_width(ui, &label, semibold(11.5)) + 18.0;
            let kr = Rect::from_center_size(pos2(x - w / 2.0, cy), vec2(w, 24.0));
            let kresp = ui.interact(kr, Id::new("quality"), Sense::click()).on_hover_text("Qualidade do áudio. Clique pra mudar.");
            ui.painter().rect_stroke(kr, 6, Stroke::new(1.0, if kresp.hovered() { TEXT } else { Color32::from_white_alpha(60) }), StrokeKind::Inside);
            ui.painter().text(kr.center(), Align2::CENTER_CENTER, label, semibold(11.5), MUTED);
            if kresp.on_hover_cursor(CursorIcon::PointingHand).clicked() {
                self.go(View::Settings);
            }
        }
    }

    // ------------------------------------------------------------ avisos

    fn toast_ui(&mut self, ctx: &egui::Context) {
        let Some((msg, at, error)) = self.toast.clone() else { return };
        let life = if error { 6.0 } else { 3.5 };
        if at.elapsed().as_secs_f32() > life {
            self.toast = None;
            return;
        }
        ctx.request_repaint_after(Duration::from_millis(200));
        egui::Area::new(Id::new("toast"))
            .anchor(Align2::CENTER_BOTTOM, vec2(0.0, -116.0))
            .order(egui::Order::Foreground)
            .interactable(false)
            .show(ctx, |ui| {
                let fill = if error { Color32::from_rgb(0xE5, 0x6B, 0x6B) } else { TEXT };
                Frame::new()
                    .fill(fill)
                    .corner_radius(10)
                    .inner_margin(Margin::symmetric(18, 11))
                    .show(ui, |ui| {
                        ui.set_max_width(520.0);
                        ui.label(RichText::new(msg).font(semibold(14.0)).color(DARK_TEXT));
                    });
            });
    }

    fn update_dialog(&mut self, ctx: &egui::Context) {
        if !self.upd_dialog {
            return;
        }
        let accent = self.accent();
        let mut close = false;
        let mut action: Option<Cmd> = None;
        let mut new_state: Option<Upd> = None;
        let resp = egui::Modal::new(Id::new("update-modal"))
            .backdrop_color(Color32::from_black_alpha(150))
            .frame(Frame::new().fill(CARD).corner_radius(16).inner_margin(Margin::same(26)).stroke(Stroke::new(1.0, LINE)))
            .show(ctx, |ui| {
                ui.set_width(420.0);
                let (title, version) = match &self.update {
                    Upd::Downloading(i, _) => ("Atualizando", i.version.clone()),
                    Upd::Ready(i) => ("Pronto pra instalar", i.version.clone()),
                    Upd::Available(i) => ("Nova versão disponível", i.version.clone()),
                    _ => ("Atualizações", String::new()),
                };
                ui.horizontal(|ui| {
                    let (r, _) = ui.allocate_exact_size(vec2(48.0, 48.0), Sense::hover());
                    ui.painter().circle_filled(r.center(), 24.0, theme::accent_soft(self.s.accent));
                    icons::paint(ui.painter(), r.shrink(12.0), Icon::Download, accent);
                    ui.add_space(6.0);
                    ui.vertical(|ui| {
                        ui.label(RichText::new(title).font(bold(20.0)).color(TEXT));
                        if !version.is_empty() {
                            ui.label(RichText::new(format!("Vitral {version} · você está na {}", env!("CARGO_PKG_VERSION"))).font(regular(13.5)).color(MUTED));
                        }
                    });
                });
                ui.add_space(16.0);
                match &self.update {
                    Upd::Available(info) => {
                        if !info.notes.is_empty() {
                            ui.label(RichText::new("O que mudou").font(semibold(14.5)).color(TEXT));
                            ui.add_space(4.0);
                            egui::ScrollArea::vertical().max_height(180.0).show(ui, |ui| {
                                ui.label(RichText::new(&info.notes).font(regular(14.0)).color(Color32::from_rgb(0xD0, 0xD2, 0xD6)));
                            });
                            ui.add_space(8.0);
                        }
                        ui.label(RichText::new("Suas playlists, curtidas e configurações continuam do jeito que estão.").font(regular(13.0)).color(MUTED));
                        ui.add_space(18.0);
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            if pill_button(ui, "Atualizar agora", accent, DARK_TEXT, vec2(160.0, 44.0)).clicked() {
                                action = Some(Cmd::DownloadUpdate { info: info.clone(), token: self.s.github_token.clone() });
                                new_state = Some(Upd::Downloading(info.clone(), 0.0));
                            }
                            ui.add_space(8.0);
                            if outline_button(ui, "Agora não", vec2(120.0, 44.0)).clicked() {
                                self.s.skipped_version = Some(info.version.clone());
                                self.s.save();
                                close = true;
                                self.toast = Some(("Tudo bem. Dá pra atualizar depois pelo aviso lá em cima ou nas Configurações.".into(), Instant::now(), false));
                            }
                        });
                    }
                    Upd::Downloading(_, p) => {
                        ui.horizontal(|ui| {
                            ui.label(RichText::new("Baixando a atualização…").color(TEXT));
                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                ui.label(RichText::new(format!("{:.0}%", p * 100.0)).color(TEXT));
                            });
                        });
                        ui.add_space(6.0);
                        let (r, _) = ui.allocate_exact_size(vec2(ui.available_width(), 6.0), Sense::hover());
                        ui.painter().rect_filled(r, 3, Color32::from_white_alpha(30));
                        ui.painter().rect_filled(Rect::from_min_size(r.min, vec2(r.width() * p, 6.0)), 3, accent);
                        ui.add_space(6.0);
                        ui.label(RichText::new("Pode continuar ouvindo música enquanto isso.").font(regular(13.0)).color(MUTED));
                        ui.add_space(16.0);
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            if outline_button(ui, "Continuar em segundo plano", vec2(230.0, 44.0)).clicked() {
                                close = true;
                            }
                        });
                    }
                    Upd::Ready(_) => {
                        ui.label(RichText::new("Tudo baixado. O Vitral fecha e abre de novo em poucos segundos.").color(TEXT));
                        ui.add_space(18.0);
                        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                            if pill_button(ui, "Reiniciar agora", accent, DARK_TEXT, vec2(160.0, 44.0)).clicked() {
                                action = Some(Cmd::RestartForUpdate);
                            }
                            ui.add_space(8.0);
                            if outline_button(ui, "Depois", vec2(110.0, 44.0)).clicked() {
                                close = true;
                            }
                        });
                    }
                    _ => {
                        ui.label(RichText::new("Nenhuma atualização no momento.").color(MUTED));
                        ui.add_space(14.0);
                        if outline_button(ui, "Fechar", vec2(100.0, 40.0)).clicked() {
                            close = true;
                        }
                    }
                }
            });
        if resp.should_close() {
            close = true;
        }
        if let Some(s) = new_state {
            self.update = s;
        }
        if let Some(c) = action {
            self.send(c);
        }
        if close {
            self.upd_dialog = false;
        }
    }
}

// ---------------------------------------------------------------- colunas da tabela

struct Cols {
    num_x: f32,
    title_x: f32,
    title_w: f32,
    album_x: f32,
    album_w: f32,
    added_x: f32,
    added_w: f32,
    heart_x: f32,
    dur_x: f32,
    show_album: bool,
    show_added: bool,
}

impl Cols {
    fn new(width: f32, show_album: bool, show_added: bool) -> Self {
        let num_w = 44.0;
        let right = 44.0 + 72.0;
        let flex = (width - num_w - right).max(100.0);
        let (tw, aw, dw) = match (show_album, show_added) {
            (true, true) => (flex * 0.45, flex * 0.33, flex * 0.22),
            (true, false) => (flex * 0.58, flex * 0.42, 0.0),
            _ => (flex, 0.0, 0.0),
        };
        Self {
            num_x: num_w / 2.0 + 4.0,
            title_x: num_w,
            title_w: tw,
            album_x: num_w + tw,
            album_w: aw,
            added_x: num_w + tw + aw,
            added_w: dw,
            heart_x: width - right + 22.0,
            dur_x: width - 72.0,
            show_album,
            show_added,
        }
    }
}

// ---------------------------------------------------------------- componentes

fn text_at(painter: &Painter, pos: egui::Pos2, text: &str, font: egui::FontId, color: Color32, max_w: f32, valign: Align) -> Rect {
    let mut job = LayoutJob::single_section(text.to_owned(), TextFormat::simple(font, color));
    job.wrap = TextWrapping::truncate_at_width(max_w.max(8.0));
    let galley = painter.layout_job(job);
    let h = galley.size().y;
    let y = match valign {
        Align::Min => pos.y,
        Align::Center => pos.y - h / 2.0,
        Align::Max => pos.y - h,
    };
    let p = pos2(pos.x, y);
    let r = Rect::from_min_size(p, galley.size());
    painter.galley(p, galley, color);
    r
}

fn text_width(ui: &Ui, text: &str, font: egui::FontId) -> f32 {
    let job = LayoutJob::single_section(text.to_owned(), TextFormat::simple(font, TEXT));
    ui.painter().layout_job(job).size().x
}

/// Diminui o tamanho do título até caber na largura.
fn fit_size(ui: &Ui, text: &str, start: f32, max_w: f32) -> f32 {
    let mut size = start;
    while size > 28.0 && text_width(ui, text, display(size)) > max_w {
        size -= 4.0;
    }
    size
}

fn placeholder(painter: &Painter, rect: Rect, radius: u8, seed: &str) {
    let mut h: u32 = 2166136261;
    for b in seed.bytes() {
        h = (h ^ b as u32).wrapping_mul(16777619);
    }
    let hue = (h % 360) as f32 / 360.0;
    let base: Color32 = egui::ecolor::Hsva::new(hue, 0.45, 0.32, 1.0).into();
    let light: Color32 = egui::ecolor::Hsva::new((hue + 0.08) % 1.0, 0.5, 0.55, 1.0).into();
    painter.rect_filled(rect, radius, base);
    let c = rect.left_top() + vec2(rect.width() * 0.7, rect.height() * 0.32);
    let clip = painter.with_clip_rect(rect.shrink(1.0));
    clip.circle_filled(c, rect.width() * 0.2, light);
    painter.rect_filled(
        Rect::from_min_max(pos2(rect.left(), rect.top() + rect.height() * 0.62), rect.max),
        CornerRadius { nw: 0, ne: 0, sw: radius, se: radius },
        Color32::from_black_alpha(60),
    );
}

fn icon_button_at(ui: &Ui, rect: Rect, id: Id, icon: Icon, icon_size: f32, active: bool, accent: Color32) -> Response {
    let resp = ui.interact(rect, id, Sense::click());
    if resp.hovered() {
        ui.painter().circle_filled(rect.center(), rect.width() / 2.0, Color32::from_white_alpha(18));
    }
    let color = if active {
        accent
    } else if resp.hovered() {
        TEXT
    } else {
        MUTED
    };
    icons::paint(ui.painter(), Rect::from_center_size(rect.center(), vec2(icon_size, icon_size)), icon, color);
    resp.on_hover_cursor(CursorIcon::PointingHand)
}

fn nav_row(ui: &mut Ui, icon: Icon, label: &str, selected: bool) -> Response {
    let (rect, resp) = ui.allocate_exact_size(vec2(ui.available_width(), 48.0), Sense::click());
    let color = if selected || resp.hovered() { TEXT } else { MUTED };
    icons::paint(ui.painter(), Rect::from_center_size(pos2(rect.left() + 26.0, rect.center().y), vec2(26.0, 26.0)), icon, color);
    text_at(ui.painter(), pos2(rect.left() + 56.0, rect.center().y), label, bold(16.0), color, rect.width() - 60.0, Align::Center);
    resp.on_hover_cursor(CursorIcon::PointingHand)
}

fn chip(ui: &mut Ui, label: &str, selected: bool) -> Response {
    let w = text_width(ui, label, semibold(14.0)) + 30.0;
    let (rect, resp) = ui.allocate_exact_size(vec2(w, 34.0), Sense::click());
    let fill = if selected {
        TEXT
    } else if resp.hovered() {
        Color32::from_white_alpha(34)
    } else {
        chip_fill()
    };
    ui.painter().rect_filled(rect, 17, fill);
    ui.painter().text(rect.center(), Align2::CENTER_CENTER, label, semibold(14.0), if selected { DARK_TEXT } else { TEXT });
    resp.on_hover_cursor(CursorIcon::PointingHand)
}

fn pill_button(ui: &mut Ui, label: &str, fill: Color32, text: Color32, size: Vec2) -> Response {
    let (rect, resp) = ui.allocate_exact_size(size, Sense::click());
    let f = if resp.hovered() { fill.gamma_multiply(1.12) } else { fill };
    let rect = if resp.hovered() { rect.expand(1.0) } else { rect };
    ui.painter().rect_filled(rect, (size.y / 2.0) as u8, f);
    ui.painter().text(rect.center(), Align2::CENTER_CENTER, label, bold(15.0), text);
    resp.on_hover_cursor(CursorIcon::PointingHand)
}

fn outline_button(ui: &mut Ui, label: &str, size: Vec2) -> Response {
    let w = size.x.max(text_width(ui, label, bold(14.0)) + 36.0);
    let (rect, resp) = ui.allocate_exact_size(vec2(w, size.y), Sense::click());
    let stroke = if resp.hovered() { TEXT } else { Color32::from_white_alpha(90) };
    ui.painter().rect_stroke(rect, (size.y / 2.0) as u8, Stroke::new(1.0, stroke), StrokeKind::Inside);
    ui.painter().text(rect.center(), Align2::CENTER_CENTER, label, bold(14.0), TEXT);
    resp.on_hover_cursor(CursorIcon::PointingHand)
}

fn switch(ui: &mut Ui, on: bool, accent: Color32) -> Response {
    let (rect, resp) = ui.allocate_exact_size(vec2(46.0, 28.0), Sense::click());
    let t = ui.ctx().animate_bool(resp.id, on);
    let fill = if on { accent } else { Color32::from_white_alpha(50) };
    ui.painter().rect_filled(rect, 14, fill);
    let x = egui::lerp(rect.left() + 14.0..=rect.right() - 14.0, t);
    ui.painter().circle_filled(pos2(x, rect.center().y), 10.0, if on { DARK_TEXT } else { TEXT });
    resp.on_hover_cursor(CursorIcon::PointingHand)
}

fn segmented<T: Copy + PartialEq>(ui: &mut Ui, opts: &[(T, &str)], current: T, _accent: Color32) -> Option<T> {
    let mut out = None;
    let widths: Vec<f32> = opts.iter().map(|(_, l)| text_width(ui, l, semibold(13.5)) + 30.0).collect();
    let total: f32 = widths.iter().sum::<f32>() + 8.0 + 4.0 * (opts.len() as f32 - 1.0);
    let (rect, _) = ui.allocate_exact_size(vec2(total, 42.0), Sense::hover());
    ui.painter().rect_filled(rect, 10, Color32::from_white_alpha(14));
    let mut x = rect.left() + 4.0;
    for (i, (v, label)) in opts.iter().enumerate() {
        let r = Rect::from_min_size(pos2(x, rect.top() + 4.0), vec2(widths[i], 34.0));
        let resp = ui.interact(r, ui.id().with(("seg", i, *label)), Sense::click()).on_hover_cursor(CursorIcon::PointingHand);
        let sel = *v == current;
        if sel {
            ui.painter().rect_filled(r, 8, Color32::from_white_alpha(40));
        } else if resp.hovered() {
            ui.painter().rect_filled(r, 8, Color32::from_white_alpha(16));
        }
        ui.painter().text(r.center(), Align2::CENTER_CENTER, *label, semibold(13.5), if sel || resp.hovered() { TEXT } else { MUTED });
        if resp.clicked() && !sel {
            out = Some(*v);
        }
        x += widths[i] + 4.0;
    }
    out
}

/// Barra deslizante (progresso, volume). Retorna a resposta e o valor mostrado.
fn slider(ui: &Ui, rect: Rect, id: Id, value: f32, fill: Color32, hover_fill: Color32) -> (Response, f32) {
    let resp = ui.interact(rect.expand2(vec2(4.0, 6.0)), id, Sense::click_and_drag());
    let mut v = value.clamp(0.0, 1.0);
    if resp.dragged() || resp.clicked() || resp.drag_stopped() {
        if let Some(p) = resp.interact_pointer_pos() {
            v = ((p.x - rect.left()) / rect.width()).clamp(0.0, 1.0);
        }
    }
    let active = resp.hovered() || resp.dragged();
    let y = rect.center().y;
    let track = Rect::from_min_max(pos2(rect.left(), y - 2.0), pos2(rect.right(), y + 2.0));
    ui.painter().rect_filled(track, 2, Color32::from_white_alpha(50));
    let x = rect.left() + rect.width() * v;
    ui.painter().rect_filled(Rect::from_min_max(track.min, pos2(x, track.bottom())), 2, if active { hover_fill } else { fill });
    if active {
        ui.painter().circle_filled(pos2(x, y), 6.5, TEXT);
    }
    (resp.on_hover_cursor(CursorIcon::PointingHand), v)
}

fn search_field(ui: &mut Ui, text: &mut String, hint: &str, width: f32, height: f32, id: Id, focus: bool, radius: u8) -> (Response, bool) {
    let (rect, _) = ui.allocate_exact_size(vec2(width, height), Sense::hover());
    let has_focus = ui.memory(|m| m.has_focus(id));
    let hovered = ui.rect_contains_pointer(rect);
    let fill = if has_focus || hovered { Color32::from_white_alpha(30) } else { Color32::from_white_alpha(20) };
    ui.painter().rect_filled(rect, radius, fill);
    if has_focus {
        ui.painter().rect_stroke(rect, radius, Stroke::new(1.0, Color32::from_white_alpha(150)), StrokeKind::Inside);
    }
    let ic = (height * 0.45).min(20.0);
    icons::paint(ui.painter(), Rect::from_center_size(pos2(rect.left() + 12.0 + ic / 2.0, rect.center().y), vec2(ic, ic)), Icon::Search, MUTED);
    let clear_w = if text.is_empty() { 0.0 } else { 34.0 };
    let te_rect = Rect::from_min_max(pos2(rect.left() + 20.0 + ic, rect.top()), pos2(rect.right() - 10.0 - clear_w, rect.bottom()));
    let font = regular(if height > 40.0 { 15.0 } else { 13.5 });
    let te = egui::TextEdit::singleline(text)
        .id(id)
        .frame(Frame::NONE)
        .hint_text(RichText::new(hint).color(MUTED).font(font.clone()))
        .font(font)
        .text_color(TEXT)
        .margin(Margin::ZERO)
        .align(Align2::LEFT_CENTER)
        .desired_width(te_rect.width());
    let resp = ui.put(te_rect, te);
    if focus {
        resp.request_focus();
    }
    let mut cleared = false;
    if !text.is_empty() {
        let cr = Rect::from_center_size(pos2(rect.right() - 8.0 - clear_w / 2.0, rect.center().y), vec2(30.0, 30.0));
        if icon_button_at(ui, cr, id.with("clear"), Icon::Close, 15.0, false, TEXT).on_hover_text("Limpar").clicked() {
            text.clear();
            cleared = true;
            resp.request_focus();
        }
    }
    (resp, cleared)
}

fn section(ui: &mut Ui, title: &str) {
    ui.add_space(22.0);
    ui.label(RichText::new(title).font(bold(18.0)).color(TEXT));
    ui.add_space(2.0);
}

fn setting_row(ui: &mut Ui, width: f32, label: &str, desc: &str, control: impl FnOnce(&mut Ui)) {
    let top = ui.cursor().min;
    let row = Rect::from_min_size(top, vec2(width, 70.0));
    let text_w = width - 280.0;
    text_at(ui.painter(), pos2(row.left(), row.center().y - 10.0), label, semibold(15.0), TEXT, text_w.max(200.0), Align::Center);
    text_at(ui.painter(), pos2(row.left(), row.center().y + 12.0), desc, regular(13.5), MUTED, text_w.max(200.0), Align::Center);
    let ctrl = Rect::from_min_max(pos2(row.right() - 300.0, row.top()), row.max);
    let mut child = ui.new_child(UiBuilder::new().max_rect(ctrl).layout(Layout::right_to_left(Align::Center)));
    control(&mut child);
    ui.allocate_rect(row, Sense::hover());
    ui.painter().line_segment([pos2(row.left(), row.bottom()), pos2(row.right(), row.bottom())], Stroke::new(1.0, Color32::from_white_alpha(10)));
}

// ---------------------------------------------------------------- utilidades

/// Minúsculas e sem acento, pra comparar textos.
pub fn fold(s: &str) -> String {
    s.chars()
        .flat_map(|c| c.to_lowercase())
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            'ñ' => 'n',
            other => other,
        })
        .collect()
}

fn fmt_ms(ms: u32) -> String {
    let s = ms / 1000;
    format!("{}:{:02}", s / 60, s % 60)
}

fn fmt_total(ms: u64) -> String {
    let m = (ms / 60_000) as u32;
    if m >= 60 { format!("{} h {} min", m / 60, m % 60) } else { format!("{m} min") }
}

fn fmt_date(iso: &str) -> String {
    const M: [&str; 12] = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    let parts: Vec<&str> = iso.split('-').collect();
    if parts.len() == 3 {
        if let (Ok(m), Ok(d)) = (parts[1].parse::<usize>(), parts[2].parse::<u32>()) {
            if (1..=12).contains(&m) {
                return format!("{d} {} {}", M[m - 1], parts[0]);
            }
        }
    }
    iso.to_string()
}

fn local_hour() -> u32 {
    // Sem biblioteca de fuso: usa o horário de Brasília (UTC-3).
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    (((secs / 3600) + 24 - 3) % 24) as u32
}

fn open_folder(dir: &std::path::Path) {
    let program = if cfg!(windows) { "explorer" } else { "xdg-open" };
    let _ = std::process::Command::new(program).arg(dir).spawn();
}
