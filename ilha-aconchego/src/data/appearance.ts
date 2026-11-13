/**
 * Character creator options (docs/GAME_DESIGN.md, "Personagem"). Pure data plus validation,
 * shared by the creator, the 3D avatar, saves and (later) the multiplayer server.
 */

export const SPECIES = ['human', 'elf', 'cat', 'bunny'] as const;
export const SKIN_TONES = ['#F8D9C0', '#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#5C3A21'] as const;
export const EYES = ['dot', 'round', 'sparkle', 'sleepy', 'happy'] as const;
export const EYE_COLORS = ['#2B2B2B', '#5A3B22', '#2F6FB0', '#3E8E5A', '#8A4FBF', '#C0392B'] as const;
export const MOUTHS = ['smile', 'laugh', 'cat', 'calm'] as const;
export const HAIR_STYLES = ['short', 'bun', 'ponytail', 'long', 'bob', 'spiky'] as const;
export const HAIR_COLORS = ['#3B2A20', '#7A4A2A', '#C98A4B', '#F2D27A', '#E8708F', '#7FB7E6', '#9ADBB5', '#B9A1E6', '#EDEDED'] as const;
export const OUTFITS = ['tshirt', 'dress', 'overalls', 'hoodie'] as const;
export const TOP_COLORS = ['#7C4DA6', '#3FA7A0', '#E8708F', '#F2C14E', '#5B8DD9', '#F4F1EA', '#E5484D', '#6B8E4E'] as const;
export const BOTTOM_COLORS = ['#3E5C8A', '#4A4A52', '#8A6A4A', '#E8708F', '#F4F1EA', '#5E8F5A'] as const;
export const SHOE_COLORS = ['#5A3B2E', '#2B2B2B', '#F4F1EA', '#E5484D', '#5B8DD9'] as const;
export const ACCESSORIES = ['none', 'strawHat', 'beanie', 'bow', 'flowerCrown', 'sprout'] as const;

export type Species = (typeof SPECIES)[number];
export type EyeStyle = (typeof EYES)[number];
export type MouthStyle = (typeof MOUTHS)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type Outfit = (typeof OUTFITS)[number];
export type Accessory = (typeof ACCESSORIES)[number];

export interface Appearance {
  species: Species;
  skin: string;
  eyes: EyeStyle;
  eyeColor: string;
  mouth: MouthStyle;
  blush: boolean;
  hairStyle: HairStyle;
  hairColor: string;
  outfit: Outfit;
  topColor: string;
  bottomColor: string;
  shoes: string;
  accessory: Accessory;
}

/** Ana, the default and test character. */
export const DEFAULT_APPEARANCE: Readonly<Appearance> = {
  species: 'human',
  skin: '#F8D9C0',
  eyes: 'sparkle',
  eyeColor: '#5A3B22',
  mouth: 'smile',
  blush: true,
  hairStyle: 'bun',
  hairColor: '#E8708F',
  outfit: 'dress',
  topColor: '#7C4DA6',
  bottomColor: '#3E5C8A',
  shoes: '#5A3B2E',
  accessory: 'none',
};

/** Which option list each field picks from. `blush` is a yes/no switch. */
export const APPEARANCE_OPTIONS = {
  species: SPECIES,
  skin: SKIN_TONES,
  eyes: EYES,
  eyeColor: EYE_COLORS,
  mouth: MOUTHS,
  hairStyle: HAIR_STYLES,
  hairColor: HAIR_COLORS,
  outfit: OUTFITS,
  topColor: TOP_COLORS,
  bottomColor: BOTTOM_COLORS,
  shoes: SHOE_COLORS,
  accessory: ACCESSORIES,
} as const satisfies Record<Exclude<keyof Appearance, 'blush'>, readonly string[]>;

export const NAME_MAX_LENGTH = 14;

/** Checks a value that came from a save file or the network. */
export function isValidAppearance(value: unknown): value is Appearance {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  if (typeof a.blush !== 'boolean') return false;
  return (Object.keys(APPEARANCE_OPTIONS) as (keyof typeof APPEARANCE_OPTIONS)[]).every(key => (APPEARANCE_OPTIONS[key] as readonly unknown[]).includes(a[key]));
}

/** "Sortear visual": a random look, keeping nothing from before. */
export function randomAppearance(random: () => number): Appearance {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
  return {
    species: pick(SPECIES),
    skin: pick(SKIN_TONES),
    eyes: pick(EYES),
    eyeColor: pick(EYE_COLORS),
    mouth: pick(MOUTHS),
    blush: random() < 0.6,
    hairStyle: pick(HAIR_STYLES),
    hairColor: pick(HAIR_COLORS),
    outfit: pick(OUTFITS),
    topColor: pick(TOP_COLORS),
    bottomColor: pick(BOTTOM_COLORS),
    shoes: pick(SHOE_COLORS),
    accessory: pick(ACCESSORIES),
  };
}

/** Trims and limits a typed name; falls back when empty. */
export function cleanName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const name = value.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_LENGTH);
  return name || fallback;
}
