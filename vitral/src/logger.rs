//! Log simples em arquivo (%APPDATA%\Vitral\vitral.log), útil pra descobrir problemas.

use std::fs::{File, OpenOptions};
use std::io::Write;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use log::{Level, LevelFilter, Metadata, Record};

struct FileLogger {
    file: Mutex<Option<File>>,
}

impl log::Log for FileLogger {
    fn enabled(&self, m: &Metadata) -> bool {
        if m.target().starts_with("vitral") {
            m.level() <= Level::Info
        } else if m.target().starts_with("librespot") {
            m.level() <= Level::Info
        } else {
            m.level() <= Level::Warn
        }
    }

    fn log(&self, r: &Record) {
        if !self.enabled(r.metadata()) {
            return;
        }
        let secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let line = format!("[{secs}] {:<5} {}: {}\n", r.level(), r.target(), r.args());
        if cfg!(debug_assertions) {
            eprint!("{line}");
        }
        if let Ok(mut guard) = self.file.lock() {
            if let Some(f) = guard.as_mut() {
                let _ = f.write_all(line.as_bytes());
            }
        }
    }

    fn flush(&self) {
        if let Ok(mut guard) = self.file.lock() {
            if let Some(f) = guard.as_mut() {
                let _ = f.flush();
            }
        }
    }
}

pub fn init() {
    let path = crate::settings::data_dir().join("vitral.log");
    // Recomeça o arquivo quando ele passa de 2 MB.
    let too_big = std::fs::metadata(&path).map(|m| m.len() > 2_000_000).unwrap_or(false);
    let file = OpenOptions::new()
        .create(true)
        .append(!too_big)
        .write(true)
        .truncate(too_big)
        .open(&path)
        .ok();
    let logger = Box::new(FileLogger { file: Mutex::new(file) });
    if log::set_boxed_logger(logger).is_ok() {
        log::set_max_level(LevelFilter::Info);
    }
}
