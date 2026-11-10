// No Windows, abre sem a janela preta do terminal.
#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

mod app;
mod auth;
mod backend;
mod demo;
mod icons;
mod logger;
mod model;
mod settings;
mod spotify;
mod theme;
mod updater;

use std::sync::Arc;

use eframe::egui;

fn main() -> eframe::Result {
    if std::env::args().any(|a| a == "--version") {
        println!("Vitral {}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    logger::init();
    std::panic::set_hook(Box::new(|info| {
        log::error!("erro inesperado: {info}");
    }));
    log::info!("Vitral {} iniciando", env!("CARGO_PKG_VERSION"));
    let demo = std::env::args().any(|a| a == "--demo");

    // No Windows tenta primeiro o DirectX/Vulkan (wgpu); se a placa de vídeo não aceitar, usa OpenGL.
    let first = if cfg!(windows) { eframe::Renderer::Wgpu } else { eframe::Renderer::Glow };
    match run(first, demo) {
        Err(e) if first == eframe::Renderer::Wgpu => {
            log::warn!("wgpu não abriu ({e}); tentando OpenGL");
            run(eframe::Renderer::Glow, demo)
        }
        other => other,
    }
}

fn run(renderer: eframe::Renderer, demo: bool) -> eframe::Result {
    let viewport = egui::ViewportBuilder::default()
        .with_title("Vitral")
        .with_app_id("vitral")
        .with_inner_size([1360.0, 860.0])
        .with_min_inner_size([960.0, 600.0])
        .with_icon(Arc::new(window_icon()));
    let options = eframe::NativeOptions { viewport, renderer, ..Default::default() };
    eframe::run_native("Vitral", options, Box::new(move |cc| Ok(Box::new(app::VitralApp::new(cc, demo)))))
}

/// Ícone da janela: as quatro peças de vitral.
fn window_icon() -> egui::IconData {
    let size = 64usize;
    let mut rgba = vec![0u8; size * size * 4];
    let colors: [[u8; 4]; 4] = [[0x36, 0xD6, 0x7A, 255], [0xC8, 0xCA, 0xCF, 255], [0x5A, 0x5E, 0x66, 255], [0x1F, 0x7A, 0x47, 255]];
    let cell = 28usize;
    let gap = 4usize;
    let radius = 7.0f32;
    for (i, c) in colors.iter().enumerate() {
        let ox = 2 + (i % 2) * (cell + gap);
        let oy = 2 + (i / 2) * (cell + gap);
        for y in 0..cell {
            for x in 0..cell {
                // cantos arredondados
                let dx = (x as f32 + 0.5).min(cell as f32 - x as f32 - 0.5);
                let dy = (y as f32 + 0.5).min(cell as f32 - y as f32 - 0.5);
                if dx < radius && dy < radius {
                    let d = ((radius - dx).powi(2) + (radius - dy).powi(2)).sqrt();
                    if d > radius {
                        continue;
                    }
                }
                let idx = ((oy + y) * size + (ox + x)) * 4;
                rgba[idx..idx + 4].copy_from_slice(c);
            }
        }
    }
    egui::IconData { rgba, width: size as u32, height: size as u32 }
}
