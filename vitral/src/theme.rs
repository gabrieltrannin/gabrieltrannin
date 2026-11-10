//! Cores, fontes e estilo geral (visual escuro do protótipo).

use std::sync::Arc;

use eframe::egui::{
    self, Color32, CornerRadius, FontData, FontDefinitions, FontFamily, FontId, Stroke, Visuals,
};

pub const SIDE: Color32 = Color32::from_rgb(0x11, 0x13, 0x16);
pub const MAIN: Color32 = Color32::from_rgb(0x16, 0x18, 0x1C);
pub const BAR: Color32 = Color32::from_rgb(0x0C, 0x0D, 0x10);
pub const CARD: Color32 = Color32::from_rgb(0x1E, 0x21, 0x26);
pub const TEXT: Color32 = Color32::from_rgb(0xF2, 0xF3, 0xF5);
pub const MUTED: Color32 = Color32::from_rgb(0xA2, 0xA5, 0xAB);
pub const FAINT: Color32 = Color32::from_rgb(0x6E, 0x72, 0x7A);
pub const LINE: Color32 = Color32::from_rgb(0x26, 0x29, 0x2F);
pub const DARK_TEXT: Color32 = Color32::from_rgb(0x0B, 0x0C, 0x0E);

pub fn hover_fill() -> Color32 {
    Color32::from_white_alpha(14)
}

pub fn active_fill() -> Color32 {
    Color32::from_white_alpha(24)
}

pub fn chip_fill() -> Color32 {
    Color32::from_white_alpha(20)
}

pub fn accent(rgb: [u8; 3]) -> Color32 {
    Color32::from_rgb(rgb[0], rgb[1], rgb[2])
}

pub fn accent_soft(rgb: [u8; 3]) -> Color32 {
    Color32::from_rgba_unmultiplied(rgb[0], rgb[1], rgb[2], 38)
}

pub const ACCENTS: &[([u8; 3], &str)] = &[
    ([0x36, 0xD6, 0x7A], "Verde"),
    ([0x9B, 0x8C, 0xFF], "Lilás"),
    ([0x5C, 0xC8, 0xFF], "Azul"),
    ([0xFF, 0x8A, 0x65], "Coral"),
    ([0xF5, 0xC4, 0x51], "Âmbar"),
];

pub fn regular(size: f32) -> FontId {
    FontId::new(size, FontFamily::Proportional)
}

pub fn semibold(size: f32) -> FontId {
    FontId::new(size, FontFamily::Name("semibold".into()))
}

pub fn bold(size: f32) -> FontId {
    FontId::new(size, FontFamily::Name("bold".into()))
}

pub fn display(size: f32) -> FontId {
    FontId::new(size, FontFamily::Name("display".into()))
}

pub fn install(ctx: &egui::Context) {
    let mut fonts = FontDefinitions::default();
    let add = |fonts: &mut FontDefinitions, name: &str, bytes: &'static [u8]| {
        fonts.font_data.insert(name.to_owned(), Arc::new(FontData::from_static(bytes)));
    };
    add(&mut fonts, "inter", include_bytes!("../assets/fonts/Inter-Regular.ttf"));
    add(&mut fonts, "inter-semibold", include_bytes!("../assets/fonts/Inter-SemiBold.ttf"));
    add(&mut fonts, "inter-bold", include_bytes!("../assets/fonts/Inter-Bold.ttf"));
    add(&mut fonts, "inter-display", include_bytes!("../assets/fonts/InterDisplay-ExtraBold.ttf"));

    let fallback: Vec<String> = fonts.families.get(&FontFamily::Proportional).cloned().unwrap_or_default();
    let with = |first: &str| {
        let mut v = vec![first.to_owned()];
        v.extend(fallback.iter().cloned());
        v
    };
    fonts.families.insert(FontFamily::Proportional, with("inter"));
    fonts.families.insert(FontFamily::Name("semibold".into()), with("inter-semibold"));
    fonts.families.insert(FontFamily::Name("bold".into()), with("inter-bold"));
    fonts.families.insert(FontFamily::Name("display".into()), with("inter-display"));
    ctx.set_fonts(fonts);

    let mut visuals = Visuals::dark();
    visuals.panel_fill = MAIN;
    visuals.window_fill = CARD;
    visuals.extreme_bg_color = Color32::from_rgb(0x22, 0x25, 0x2B);
    visuals.faint_bg_color = SIDE;
    visuals.override_text_color = Some(TEXT);
    visuals.window_corner_radius = CornerRadius::same(14);
    visuals.window_stroke = Stroke::new(1.0, LINE);
    visuals.selection.bg_fill = Color32::from_rgb(0x2E, 0x6B, 0x4A);
    visuals.selection.stroke = Stroke::new(1.0, TEXT);
    visuals.text_cursor.stroke = Stroke::new(2.0, TEXT);
    visuals.widgets.noninteractive.bg_stroke = Stroke::new(1.0, LINE);
    for w in [
        &mut visuals.widgets.inactive,
        &mut visuals.widgets.hovered,
        &mut visuals.widgets.active,
        &mut visuals.widgets.open,
    ] {
        w.corner_radius = CornerRadius::same(8);
    }
    visuals.widgets.inactive.weak_bg_fill = Color32::from_white_alpha(16);
    visuals.widgets.inactive.bg_fill = Color32::from_white_alpha(16);
    visuals.widgets.hovered.weak_bg_fill = Color32::from_white_alpha(28);
    visuals.widgets.hovered.bg_fill = Color32::from_white_alpha(28);
    visuals.widgets.hovered.bg_stroke = Stroke::NONE;
    visuals.widgets.inactive.bg_stroke = Stroke::NONE;

    ctx.set_visuals(visuals);
    ctx.all_styles_mut(|style| {
        style.spacing.item_spacing = egui::vec2(8.0, 6.0);
        style.spacing.button_padding = egui::vec2(12.0, 6.0);
        style.spacing.scroll.bar_width = 8.0;
        style.spacing.scroll.floating = true;
        style.text_styles.insert(egui::TextStyle::Body, regular(14.0));
        style.text_styles.insert(egui::TextStyle::Button, semibold(14.0));
        style.text_styles.insert(egui::TextStyle::Small, regular(12.0));
        style.text_styles.insert(egui::TextStyle::Heading, bold(22.0));
    });
}
