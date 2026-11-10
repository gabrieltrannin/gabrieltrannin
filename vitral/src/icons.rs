//! Ícones desenhados com linhas e formas (sem arquivos de imagem).

use std::f32::consts::{PI, TAU};

use eframe::egui::{Color32, CornerRadius, Painter, Pos2, Rect, Shape, Stroke, pos2};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Icon {
    Home,
    Search,
    Library,
    Play,
    Pause,
    Next,
    Prev,
    Shuffle,
    Repeat,
    RepeatOne,
    Heart,
    HeartFilled,
    Queue,
    Volume,
    VolumeMute,
    Settings,
    Back,
    Forward,
    Close,
    Clock,
    Download,
    Speaker,
}

/// Desenha `icon` dentro de `rect` (pensado numa grade 24×24).
pub fn paint(painter: &Painter, rect: Rect, icon: Icon, color: Color32) {
    let s = rect.width().min(rect.height()) / 24.0;
    let o = rect.center() - eframe::egui::vec2(12.0 * s, 12.0 * s);
    let p = |x: f32, y: f32| pos2(o.x + x * s, o.y + y * s);
    let st = Stroke::new((1.8 * s).max(1.2), color);
    let line = |pts: &[(f32, f32)]| {
        painter.add(Shape::line(pts.iter().map(|&(x, y)| p(x, y)).collect(), st));
    };
    let fill = |pts: &[(f32, f32)]| {
        painter.add(Shape::convex_polygon(pts.iter().map(|&(x, y)| p(x, y)).collect(), color, Stroke::NONE));
    };
    let arc = |cx: f32, cy: f32, r: f32, a0: f32, a1: f32| {
        let n = 14;
        let pts: Vec<Pos2> = (0..=n)
            .map(|i| {
                let a = a0 + (a1 - a0) * i as f32 / n as f32;
                p(cx + r * a.cos(), cy + r * a.sin())
            })
            .collect();
        painter.add(Shape::line(pts, st));
    };

    match icon {
        Icon::Home => {
            line(&[(3.5, 10.5), (12.0, 3.5), (20.5, 10.5)]);
            line(&[(5.5, 9.0), (5.5, 20.0), (10.0, 20.0), (10.0, 14.0), (14.0, 14.0), (14.0, 20.0), (18.5, 20.0), (18.5, 9.0)]);
        }
        Icon::Search => {
            painter.circle_stroke(p(11.0, 11.0), 6.5 * s, st);
            line(&[(15.8, 15.8), (20.0, 20.0)]);
        }
        Icon::Library => {
            line(&[(5.0, 4.0), (5.0, 20.0)]);
            line(&[(10.0, 4.0), (10.0, 20.0)]);
            line(&[(14.5, 4.6), (19.3, 19.4)]);
        }
        Icon::Play => fill(&[(8.0, 5.0), (19.5, 12.0), (8.0, 19.0)]),
        Icon::Pause => {
            painter.rect_filled(Rect::from_min_max(p(6.5, 5.0), p(10.5, 19.0)), CornerRadius::same((1.2 * s) as u8), color);
            painter.rect_filled(Rect::from_min_max(p(13.5, 5.0), p(17.5, 19.0)), CornerRadius::same((1.2 * s) as u8), color);
        }
        Icon::Next => {
            fill(&[(6.0, 6.0), (15.5, 12.0), (6.0, 18.0)]);
            painter.rect_filled(Rect::from_min_max(p(16.6, 5.5), p(18.8, 18.5)), CornerRadius::same(1), color);
        }
        Icon::Prev => {
            fill(&[(18.0, 6.0), (8.5, 12.0), (18.0, 18.0)]);
            painter.rect_filled(Rect::from_min_max(p(5.2, 5.5), p(7.4, 18.5)), CornerRadius::same(1), color);
        }
        Icon::Shuffle => {
            line(&[(3.0, 7.0), (6.5, 7.0), (8.8, 8.0), (10.5, 10.0), (13.5, 14.0), (15.2, 16.0), (17.5, 17.0), (21.0, 17.0)]);
            line(&[(3.0, 17.0), (6.5, 17.0), (8.6, 16.1)]);
            line(&[(15.4, 7.9), (17.5, 7.0), (21.0, 7.0)]);
            line(&[(18.5, 4.5), (21.0, 7.0), (18.5, 9.5)]);
            line(&[(18.5, 14.5), (21.0, 17.0), (18.5, 19.5)]);
        }
        Icon::Repeat | Icon::RepeatOne => {
            line(&[(4.0, 11.5), (4.0, 9.5), (4.6, 8.0), (6.0, 6.9), (8.0, 6.5), (20.0, 6.5)]);
            line(&[(17.0, 3.5), (20.0, 6.5), (17.0, 9.5)]);
            line(&[(20.0, 12.5), (20.0, 14.5), (19.4, 16.0), (18.0, 17.1), (16.0, 17.5), (4.0, 17.5)]);
            line(&[(7.0, 20.5), (4.0, 17.5), (7.0, 14.5)]);
            if icon == Icon::RepeatOne {
                line(&[(11.0, 10.6), (12.4, 9.6), (12.4, 14.4)]);
            }
        }
        Icon::Heart => {
            let pts: Vec<Pos2> = (0..48)
                .map(|i| {
                    let t = i as f32 / 48.0 * TAU;
                    let x = 16.0 * t.sin().powi(3);
                    let y = -(13.0 * t.cos() - 5.0 * (2.0 * t).cos() - 2.0 * (3.0 * t).cos() - (4.0 * t).cos());
                    p(12.0 + x * 0.5, 12.0 + (y - 2.5) * 0.5)
                })
                .collect();
            painter.add(Shape::closed_line(pts, st));
        }
        Icon::HeartFilled => {
            painter.circle_filled(p(8.1, 9.0), 4.25 * s, color);
            painter.circle_filled(p(15.9, 9.0), 4.25 * s, color);
            fill(&[(4.1, 10.4), (12.0, 7.8), (19.9, 10.4), (12.0, 19.6)]);
        }
        Icon::Queue => {
            line(&[(4.0, 6.0), (20.0, 6.0)]);
            line(&[(4.0, 11.0), (20.0, 11.0)]);
            line(&[(4.0, 16.0), (11.5, 16.0)]);
            fill(&[(15.0, 13.5), (21.0, 17.0), (15.0, 20.5)]);
        }
        Icon::Volume | Icon::VolumeMute | Icon::Speaker => {
            painter.add(Shape::closed_line(
                [(4.5, 9.5), (8.0, 9.5), (12.5, 5.5), (12.5, 18.5), (8.0, 14.5), (4.5, 14.5)]
                    .iter()
                    .map(|&(x, y)| p(x, y))
                    .collect(),
                st,
            ));
            if icon == Icon::VolumeMute {
                line(&[(16.5, 9.5), (21.5, 14.5)]);
                line(&[(21.5, 9.5), (16.5, 14.5)]);
            } else {
                arc(12.5, 12.0, 4.0, -PI / 3.6, PI / 3.6);
                arc(12.5, 12.0, 7.3, -PI / 3.2, PI / 3.2);
            }
        }
        Icon::Settings => {
            painter.circle_stroke(p(12.0, 12.0), 3.0 * s, st);
            painter.circle_stroke(p(12.0, 12.0), 7.0 * s, st);
            for k in 0..8 {
                let a = k as f32 * TAU / 8.0;
                line(&[(12.0 + 7.0 * a.cos(), 12.0 + 7.0 * a.sin()), (12.0 + 9.6 * a.cos(), 12.0 + 9.6 * a.sin())]);
            }
        }
        Icon::Back => line(&[(14.5, 18.0), (8.5, 12.0), (14.5, 6.0)]),
        Icon::Forward => line(&[(9.5, 18.0), (15.5, 12.0), (9.5, 6.0)]),
        Icon::Close => {
            line(&[(6.5, 6.5), (17.5, 17.5)]);
            line(&[(17.5, 6.5), (6.5, 17.5)]);
        }
        Icon::Clock => {
            painter.circle_stroke(p(12.0, 12.0), 8.5 * s, st);
            line(&[(12.0, 7.5), (12.0, 12.0), (15.0, 14.0)]);
        }
        Icon::Download => {
            line(&[(12.0, 4.0), (12.0, 15.0)]);
            line(&[(7.0, 10.5), (12.0, 15.5), (17.0, 10.5)]);
            line(&[(5.0, 19.5), (19.0, 19.5)]);
        }
    }
}

/// O logotipo: quatro peças de vitral.
pub fn logo(painter: &Painter, rect: Rect, accent: Color32) {
    let gap = rect.width() * 0.12;
    let cell = (rect.width() - gap) / 2.0;
    let colors = [
        accent,
        Color32::from_white_alpha(140),
        Color32::from_white_alpha(64),
        accent.gamma_multiply(0.55),
    ];
    for (i, c) in colors.iter().enumerate() {
        let x = rect.left() + (i % 2) as f32 * (cell + gap);
        let y = rect.top() + (i / 2) as f32 * (cell + gap);
        let r = Rect::from_min_size(pos2(x, y), eframe::egui::vec2(cell, cell));
        painter.rect_filled(r, CornerRadius::same((cell * 0.28) as u8), *c);
    }
}
