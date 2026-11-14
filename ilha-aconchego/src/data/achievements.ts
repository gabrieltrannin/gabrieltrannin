import type { CollectionId } from './decor';

/**
 * Stage 5: achievements, collections and titles for the profile (docs/GAME_DESIGN.md, "Conquistas,
 * coleções e títulos"). Each achievement watches one number (core/achievements.ts measures it) and
 * unlocks when it reaches `goal`. Some give a title to show on the profile (i18n `title.<id>`).
 */

/** Counters kept per player (PlayerState.stats). */
export type StatId =
  | 'harvested' | 'fished' | 'bugs' | 'ores' | 'cooked' | 'crafted' | 'decorPlaced' | 'gifts' | 'requests'
  | 'photos' | 'emotes' | 'petFinds' | 'stallSold' | 'earned' | 'experiments'
  // Stage 6.
  | 'calmed' | 'puzzles';

export type Metric =
  | { stat: StatId }
  | { of: 'stars' | 'homeLevel' | 'bestHearts' | 'friends3' | 'museum' | 'recipes' | 'sewn' | 'dyes' | 'talents' | 'stations' | 'regions' | 'deepest' | 'festivals' }
  | { collection: CollectionId };

export interface AchievementDef {
  id: string;
  icon: string;
  metric: Metric;
  goal: number;
  /** Unlocks the title `title.<id>`. */
  title?: boolean;
}

const a = (id: string, icon: string, metric: Metric, goal: number, title = false): AchievementDef => ({ id, icon, metric, goal, ...(title ? { title } : {}) });

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  a('firstHarvest', '🌱', { stat: 'harvested' }, 1),
  a('harvest100', '🧺', { stat: 'harvested' }, 100, true),
  a('fish25', '🎣', { stat: 'fished' }, 25, true),
  a('bugs15', '🦋', { stat: 'bugs' }, 15, true),
  a('ores50', '⛏️', { stat: 'ores' }, 50, true),
  a('cook20', '🍳', { stat: 'cooked' }, 20, true),
  a('craft20', '🔨', { stat: 'crafted' }, 20, true),
  a('allStations', '🧰', { of: 'stations' }, 5, true),
  a('experiment', '🧪', { stat: 'experiments' }, 1),
  a('recipes25', '📖', { of: 'recipes' }, 25, true),
  a('decor10', '🪴', { stat: 'decorPlaced' }, 10),
  a('decor50', '🛋️', { stat: 'decorPlaced' }, 50, true),
  a('beach', '🏖️', { collection: 'beach' }, 1, true),
  a('farm', '🌾', { collection: 'farm' }, 1, true),
  a('market', '🎏', { collection: 'market' }, 1, true),
  a('stars3', '⭐', { of: 'stars' }, 3, true),
  a('stars5', '🌟', { of: 'stars' }, 5, true),
  a('home1', '🏠', { of: 'homeLevel' }, 1),
  a('home3', '🏡', { of: 'homeLevel' }, 3, true),
  a('friend5', '💗', { of: 'bestHearts' }, 5),
  a('friend10', '💞', { of: 'bestHearts' }, 10, true),
  a('everyone3', '🤝', { of: 'friends3' }, 12, true),
  a('gifts30', '🎁', { stat: 'gifts' }, 30),
  a('requests10', '📌', { stat: 'requests' }, 10, true),
  a('museum10', '🏛️', { of: 'museum' }, 10, true),
  a('sewn3', '🧵', { of: 'sewn' }, 3, true),
  a('dyes5', '🎨', { of: 'dyes' }, 5, true),
  a('talents5', '🌳', { of: 'talents' }, 5),
  a('photo', '📷', { stat: 'photos' }, 1, true),
  a('emotes10', '😊', { stat: 'emotes' }, 10),
  a('petFinds5', '🐰', { stat: 'petFinds' }, 5, true),
  a('stall10', '🧺', { stat: 'stallSold' }, 10, true),
  a('earned10k', '🪙', { stat: 'earned' }, 10000, true),
  // Stage 6.
  a('regions1', '⛵', { of: 'regions' }, 1),
  a('regions4', '🗺️', { of: 'regions' }, 4, true),
  a('mine10', '🪜', { of: 'deepest' }, 10),
  a('mine30', '💎', { of: 'deepest' }, 30, true),
  a('calm20', '🫧', { stat: 'calmed' }, 20, true),
  a('puzzles4', '🧩', { stat: 'puzzles' }, 4, true),
  a('festival1', '🎉', { of: 'festivals' }, 1),
  a('festival4', '🎊', { of: 'festivals' }, 4, true),
  a('museum30', '🦴', { of: 'museum' }, 30, true),
];
export const achievementById = (id: unknown): AchievementDef | undefined => ACHIEVEMENTS.find(x => x.id === id);
export const TITLE_IDS: readonly string[] = ACHIEVEMENTS.filter(x => x.title).map(x => x.id);
