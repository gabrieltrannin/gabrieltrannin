import type { SeasonId } from './calendar';
import type { ItemId } from './items';
import type { WeatherId } from './weather';

/** Where a line can go in: off the pier, from the beach, or in the pond and its creek. */
export const FISH_SPOTS = ['pier', 'beach', 'river'] as const;
export type FishSpot = (typeof FISH_SPOTS)[number];

export interface FishDef {
  item: ItemId;
  spots: readonly FishSpot[];
  seasons: readonly SeasonId[];
  /** Hours of the day it bites, [from, to) in minutes since midnight (to may pass 1440). */
  hours: readonly [number, number];
  /** Only in this weather (rain covers storm too). */
  weather?: 'rain';
  /** 1 easy to 5 hard: how hard it pulls in the tension minigame. */
  difficulty: number;
  /** Relative chance among the fish available. */
  weight: number;
}

const ALL: readonly SeasonId[] = ['spring', 'summer', 'autumn', 'winter'];
const DAY: readonly [number, number] = [360, 1560];

export const FISH: readonly FishDef[] = [
  { item: 'fish.sardine', spots: ['pier', 'beach'], seasons: ALL, hours: DAY, difficulty: 1, weight: 30 },
  { item: 'fish.seabass', spots: ['pier', 'beach'], seasons: ['spring', 'autumn', 'winter'], hours: DAY, difficulty: 2, weight: 18 },
  { item: 'fish.squid', spots: ['pier'], seasons: ['winter', 'autumn'], hours: [1080, 1560], difficulty: 3, weight: 12 },
  { item: 'fish.crab', spots: ['beach', 'pier'], seasons: ALL, hours: DAY, difficulty: 1, weight: 14 },
  { item: 'fish.puffer', spots: ['pier'], seasons: ['summer'], hours: [720, 960], difficulty: 4, weight: 6 },
  { item: 'fish.moonfish', spots: ['pier'], seasons: ALL, hours: [1140, 1560], difficulty: 5, weight: 3 },
  { item: 'fish.lambari', spots: ['river'], seasons: ALL, hours: DAY, difficulty: 1, weight: 30 },
  { item: 'fish.tilapia', spots: ['river'], seasons: ['spring', 'summer'], hours: DAY, difficulty: 2, weight: 18 },
  { item: 'fish.trout', spots: ['river'], seasons: ['spring', 'autumn', 'winter'], hours: [360, 1080], difficulty: 3, weight: 12 },
  { item: 'fish.carp', spots: ['river'], seasons: ALL, hours: DAY, difficulty: 2, weight: 16 },
  { item: 'fish.catfish', spots: ['river'], seasons: ['spring', 'summer', 'autumn'], hours: DAY, weather: 'rain', difficulty: 4, weight: 10 },
  { item: 'fish.goldfish', spots: ['river'], seasons: ALL, hours: [960, 1320], difficulty: 5, weight: 2 },
];

export interface BugDef {
  item: ItemId;
  seasons: readonly SeasonId[];
  hours: readonly [number, number];
  weather?: 'rain' | 'dry';
  /** Where it likes to show up. */
  near: 'flowers' | 'grass' | 'trees' | 'water' | 'hives';
}

export const BUGS: readonly BugDef[] = [
  { item: 'bug.butterfly', seasons: ['spring', 'summer'], hours: [420, 1080], weather: 'dry', near: 'flowers' },
  { item: 'bug.ladybug', seasons: ['spring', 'summer', 'autumn'], hours: [480, 1020], weather: 'dry', near: 'flowers' },
  { item: 'bug.bee', seasons: ['spring', 'summer'], hours: [480, 1020], weather: 'dry', near: 'hives' },
  { item: 'bug.grasshopper', seasons: ['summer', 'autumn'], hours: [480, 1080], weather: 'dry', near: 'grass' },
  { item: 'bug.snail', seasons: ['spring', 'summer', 'autumn'], hours: DAY, weather: 'rain', near: 'grass' },
  { item: 'bug.firefly', seasons: ['summer'], hours: [1140, 1500], weather: 'dry', near: 'water' },
  { item: 'bug.caterpillar', seasons: ['spring', 'autumn'], hours: [420, 1080], near: 'trees' },
  { item: 'bug.beetle', seasons: ['summer', 'autumn'], hours: [1080, 1500], near: 'trees' },
];

export const inHours = ([from, to]: readonly [number, number], minute: number): boolean => minute >= from && minute < to;
export const isRainy = (w: WeatherId): boolean => w === 'rain' || w === 'storm';
