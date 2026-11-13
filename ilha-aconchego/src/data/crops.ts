import type { SeasonId } from './calendar';
import type { Bed } from './map';

/**
 * Crops shown in the farm beds. In stage 1 they are decoration that changes with the season;
 * stage 3 turns them into real planting, watering and harvesting.
 */
export const CROPS = ['strawberry', 'lettuce', 'sprout', 'carrot', 'tomato', 'wheatGreen', 'wheat', 'corn', 'pumpkin', 'cabbage', 'kale', 'resting'] as const;
export type CropId = (typeof CROPS)[number];

/** Icon drawn on the bed sign (emoji, drawn on a canvas). */
export const CROP_ICONS: Record<CropId, string> = {
  strawberry: '🍓',
  lettuce: '🥬',
  sprout: '🌱',
  carrot: '🥕',
  tomato: '🍅',
  wheatGreen: '🌾',
  wheat: '🌾',
  corn: '🌽',
  pumpkin: '🎃',
  cabbage: '🥬',
  kale: '🥬',
  resting: '❄️',
};

export const BED_CROPS_BY_SEASON: Record<SeasonId, Record<Bed['id'], CropId>> = {
  spring: { NW: 'strawberry', NE: 'lettuce', SW: 'sprout', SE: 'carrot' },
  summer: { NW: 'wheatGreen', NE: 'tomato', SW: 'corn', SE: 'carrot' },
  autumn: { NW: 'wheat', NE: 'tomato', SW: 'pumpkin', SE: 'cabbage' },
  winter: { NW: 'resting', NE: 'resting', SW: 'resting', SE: 'kale' },
};

/**
 * Crops the player can plant (docs/GAME_DESIGN.md, "Fazenda e natureza"). `days` is how many watered
 * days a seed needs to ripen; crops with `regrow` keep producing every that many days after a harvest.
 * `visual` is the asset drawn when ripe.
 */
export const FARM_CROPS = ['strawberry', 'lettuce', 'carrot', 'wheat', 'tomato', 'corn', 'pumpkin', 'cabbage', 'kale'] as const;
export type FarmCropId = (typeof FARM_CROPS)[number];

export interface FarmCropDef {
  seasons: readonly SeasonId[];
  days: number;
  regrow?: number;
  xp: number;
  visual: CropId;
}

export const FARM_CROP_DEFS: Record<FarmCropId, FarmCropDef> = {
  strawberry: { seasons: ['spring'], days: 6, regrow: 3, xp: 10, visual: 'strawberry' },
  lettuce: { seasons: ['spring'], days: 4, xp: 8, visual: 'lettuce' },
  carrot: { seasons: ['spring'], days: 5, xp: 9, visual: 'carrot' },
  wheat: { seasons: ['summer', 'autumn'], days: 4, xp: 6, visual: 'wheat' },
  tomato: { seasons: ['summer'], days: 7, regrow: 3, xp: 11, visual: 'tomato' },
  corn: { seasons: ['summer', 'autumn'], days: 8, regrow: 4, xp: 12, visual: 'corn' },
  pumpkin: { seasons: ['autumn'], days: 9, xp: 22, visual: 'pumpkin' },
  cabbage: { seasons: ['autumn'], days: 6, xp: 16, visual: 'cabbage' },
  kale: { seasons: ['winter'], days: 5, xp: 14, visual: 'kale' },
};

export function isFarmCrop(value: unknown): value is FarmCropId {
  return typeof value === 'string' && (FARM_CROPS as readonly string[]).includes(value);
}

/** Visual growth stage from 0 (seed) to 4 (ripe). */
export function growthStage(crop: FarmCropId, growth: number, ripe: boolean): number {
  if (ripe) return 4;
  const f = growth / FARM_CROP_DEFS[crop].days;
  return f <= 0 ? 0 : f < 0.34 ? 1 : f < 0.67 ? 2 : 3;
}
