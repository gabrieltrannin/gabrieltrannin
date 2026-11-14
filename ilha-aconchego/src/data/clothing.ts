import { ACCESSORIES, BASE_ACCESSORIES, BASE_OUTFITS, DYE_COLORS, OUTFITS, type Accessory, type Outfit } from './appearance';
import type { ItemId } from './items';

/**
 * Stage 5: the wardrobe (docs/GAME_DESIGN.md, "Guarda-roupa com roupas que você mesmo costura e tinge").
 * Clothes sewn at the knitting table and the crystal tiara go into the wardrobe and become new pieces to
 * wear; dyes add their color to every top, trousers and pair of shoes.
 */

/** What each item becomes in the wardrobe. */
export const WEARABLE: Partial<Record<ItemId, { outfit: Outfit } | { accessory: Accessory }>> = {
  'cloth.sweater': { outfit: 'sweater' },
  'cloth.raincoat': { outfit: 'raincoat' },
  'cloth.apron': { outfit: 'apron' },
  'cloth.scarf': { accessory: 'scarf' },
  'cloth.beret': { accessory: 'beret' },
  'jewel.tiara': { accessory: 'tiara' },
};

/** The color each dye adds. */
export const DYES: Partial<Record<ItemId, (typeof DYE_COLORS)[number]>> = {
  'dye.red': '#B83A4B',
  'dye.yellow': '#FFE07A',
  'dye.pink': '#F7B6C8',
  'dye.green': '#9ADBB5',
  'dye.navy': '#2E3A6B',
  'dye.lilac': '#B9A1E6',
  'dye.orange': '#F28C38',
};

/** Pieces sewn later (not in the character creator). */
export const SEWN_OUTFITS: readonly Outfit[] = OUTFITS.filter(o => !(BASE_OUTFITS as readonly string[]).includes(o));
export const SEWN_ACCESSORIES: readonly Accessory[] = ACCESSORIES.filter(a => !(BASE_ACCESSORIES as readonly string[]).includes(a));

/** A visit to Pérola's salon. */
export const SALON_PRICE = 200;
