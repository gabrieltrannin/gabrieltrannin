import type { SeasonId } from '../data/calendar';
import { WEATHER_WEIGHTS, WEATHERS, type WeatherId } from '../data/weather';
import { nextRandom } from './rng';

export function isWeatherId(value: unknown): value is WeatherId {
  return typeof value === 'string' && (WEATHERS as readonly string[]).includes(value);
}

/** Picks the weather for a new day from the season weights, using the deterministic generator. */
export function rollWeather(rng: number, season: SeasonId): { weather: WeatherId; rng: number } {
  const weights = WEATHER_WEIGHTS[season];
  const entries = WEATHERS.map(id => [id, weights[id] ?? 0] as const).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const r = nextRandom(rng);
  let roll = r.value * total;
  for (const [id, w] of entries) {
    if (roll < w) return { weather: id, rng: r.state };
    roll -= w;
  }
  return { weather: entries[entries.length - 1]?.[0] ?? 'sun', rng: r.state };
}
