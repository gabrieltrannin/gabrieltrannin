/**
 * Stage 5: emotes (key F) and the photo mode (docs/GAME_DESIGN.md, "Emotes para reagir com moradores e
 * amigos" and "Modo foto com filtros, poses e molduras"). Names are i18n `emote.<id>`, `photo.filter.<id>`
 * and `photo.frame.<id>`.
 */

export const EMOTES = ['wave', 'happy', 'love', 'dance', 'laugh', 'surprised', 'sad', 'sleepy'] as const;
export type EmoteId = (typeof EMOTES)[number];
export const isEmoteId = (v: unknown): v is EmoteId => typeof v === 'string' && (EMOTES as readonly string[]).includes(v);
export const EMOTE_ICONS: Record<EmoteId, string> = { wave: '👋', happy: '😊', love: '💗', dance: '💃', laugh: '😆', surprised: '😮', sad: '😢', sleepy: '💤' };
/** Friendship for greeting a villager with an emote, once a day. */
export const EMOTE_POINTS = 5;

/** Photo filters as CSS filters (applied to the picture). */
export const PHOTO_FILTERS = {
  natural: 'none',
  warm: 'sepia(0.25) saturate(1.2) brightness(1.04)',
  sepia: 'sepia(0.85) contrast(1.05)',
  mono: 'grayscale(1) contrast(1.1)',
  pastel: 'saturate(0.7) brightness(1.12) contrast(0.9)',
  vivid: 'saturate(1.6) contrast(1.08)',
  dream: 'saturate(1.2) brightness(1.08) hue-rotate(-12deg) blur(0.4px)',
} as const;
export type PhotoFilter = keyof typeof PHOTO_FILTERS;

export const PHOTO_FRAMES = ['none', 'polaroid', 'flowers', 'shells', 'stars', 'hearts'] as const;
export type PhotoFrame = (typeof PHOTO_FRAMES)[number];

/** Poses for the photo: the emotes that hold still well, plus standing still. */
export const PHOTO_POSES = ['none', 'wave', 'happy', 'love', 'dance', 'surprised', 'sleepy'] as const;
