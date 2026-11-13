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
