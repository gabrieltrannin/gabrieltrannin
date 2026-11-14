import { ACHIEVEMENTS, type AchievementDef, type StatId } from '../data/achievements';
import { STATIONS } from '../data/decor';
import { ITEMS, type ItemId } from '../data/items';
import { RECIPES, STATION_SKILL, type Recipe } from '../data/recipes';
import { hearts } from '../data/villagers';
import type { GameEvent } from './commands';
import { collectionDone } from './rating';
import { levelOf } from './rules';
import type { GameState, PlacedDecor, PlayerState } from './types';

/** Stage 5: recipes known, counters, collections and achievements (pure rules). */

export const knowsRecipe = (player: PlayerState, recipe: Recipe): boolean =>
  recipe.learn ? player.recipes.includes(recipe.id) : levelOf(player, STATION_SKILL[recipe.station]) >= recipe.level;

export const knownRecipes = (player: PlayerState): Recipe[] => RECIPES.filter(r => knowsRecipe(player, r));

export function bump(player: PlayerState, stat: StatId | `station.${string}`, amount = 1): void {
  player.stats[stat] = (player.stats[stat] ?? 0) + amount;
}

/** Everything this player has placed (outside on the island and at home). */
const placedBy = (state: Readonly<GameState>, player: PlayerState): PlacedDecor[] => [...state.decor, ...Object.values(player.home.floors).flat()];

/** The number an achievement watches. */
export function measure(state: Readonly<GameState>, player: PlayerState, a: AchievementDef): number {
  const m = a.metric;
  if ('stat' in m) return player.stats[m.stat] ?? 0;
  if ('collection' in m) return collectionDone(placedBy(state, player), m.collection) ? 1 : 0;
  switch (m.of) {
    case 'stars': return state.stars;
    case 'homeLevel': return player.home.level;
    case 'bestHearts': return Math.max(0, ...Object.values(player.friends).map(f => hearts(f.points)));
    case 'friends3': return Object.values(player.friends).filter(f => hearts(f.points) >= 3).length;
    case 'museum': return state.museum.length;
    case 'recipes': return knownRecipes(player).length;
    case 'sewn': return player.wardrobe.outfits.length + player.wardrobe.accessories.length;
    case 'dyes': return player.wardrobe.colors.length;
    case 'talents': return player.talents.length;
    case 'stations': return STATIONS.filter(s => (player.stats[`station.${s}`] ?? 0) > 0).length;
  }
}

/** Notes new items in the collections and unlocks reached achievements. */
export function checkProgress(state: GameState, player: PlayerState): GameEvent[] {
  const events: GameEvent[] = [];
  const seen = new Set(player.discovered);
  for (const slot of player.inventory) {
    if (slot && !seen.has(slot.item)) {
      seen.add(slot.item);
      player.discovered.push(slot.item);
    }
  }
  for (const a of ACHIEVEMENTS) {
    if (player.achievements.includes(a.id)) continue;
    if (measure(state, player, a) >= a.goal) {
      player.achievements.push(a.id);
      events.push({ type: 'achievement', playerId: player.id, id: a.id });
    }
  }
  return events;
}

/** Item groups shown as collections on the profile. */
export const COLLECTION_GROUPS: readonly { id: string; items: readonly ItemId[] }[] = [
  { id: 'fish', items: (Object.keys(ITEMS) as ItemId[]).filter(i => ITEMS[i].kind === 'fish') },
  { id: 'bug', items: (Object.keys(ITEMS) as ItemId[]).filter(i => ITEMS[i].kind === 'bug') },
  { id: 'crop', items: (Object.keys(ITEMS) as ItemId[]).filter(i => ITEMS[i].kind === 'crop' || ITEMS[i].kind === 'fruit') },
  { id: 'dish', items: (Object.keys(ITEMS) as ItemId[]).filter(i => ITEMS[i].kind === 'dish') },
  { id: 'furniture', items: (Object.keys(ITEMS) as ItemId[]).filter(i => ITEMS[i].kind === 'furniture') },
  { id: 'clothing', items: (Object.keys(ITEMS) as ItemId[]).filter(i => ITEMS[i].kind === 'clothing' || i === 'jewel.tiara') },
  { id: 'jewelry', items: (Object.keys(ITEMS) as ItemId[]).filter(i => ITEMS[i].kind === 'jewelry') },
  { id: 'dye', items: (Object.keys(ITEMS) as ItemId[]).filter(i => ITEMS[i].kind === 'dye') },
];
