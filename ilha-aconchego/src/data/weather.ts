import type { SeasonId } from './calendar';

/** Weather of the day (docs/GAME_DESIGN.md: sol, chuva, tempestade, neve e arco-íris). */
export const WEATHERS = ['sun', 'rain', 'storm', 'snow', 'rainbow'] as const;
export type WeatherId = (typeof WEATHERS)[number];

/**
 * Chance (in weight points) of each weather when a new day starts, per season.
 * Snow only falls in winter; rainbows only appear in the warm seasons.
 */
export const WEATHER_WEIGHTS: Record<SeasonId, Partial<Record<WeatherId, number>>> = {
  spring: { sun: 55, rain: 28, storm: 5, rainbow: 12 },
  summer: { sun: 65, rain: 14, storm: 14, rainbow: 7 },
  autumn: { sun: 50, rain: 35, storm: 10, rainbow: 5 },
  winter: { sun: 45, snow: 50, storm: 5 },
};

/** The first day of a new island is always sunny. */
export const FIRST_DAY_WEATHER: WeatherId = 'sun';
