import { collectionItems, DECOR, isDecorItem, THEMED, type CollectionId, type DecorItem } from '../data/decor';
import { PROJECT_IDS } from '../data/community';
import { NEWCOMER_STARS, RATING, starsFor } from '../data/rating';
import { villager, type NpcId } from '../data/villagers';
import { absoluteDay } from './clock';
import type { GameEvent } from './commands';
import type { GameState, PlacedDecor, PlayerState } from './types';

/** Stage 5: the island rating, as a pure count of what is on the island (data/rating.ts has the weights). */

export interface Score {
  total: number;
  parts: { outside: number; inside: number; variety: number; collections: number; home: number; village: number; farm: number };
}

const beauty = (list: readonly PlacedDecor[]) => list.reduce((sum, p) => sum + (isDecorItem(p.item) ? DECOR[p.item].beauty : 0), 0);
const homeDecor = (player: PlayerState): PlacedDecor[] => Object.values(player.home.floors).flat();

/** Every decoration placed anywhere: outside, and in every house. */
export function allPlaced(state: Readonly<GameState>): PlacedDecor[] {
  return [...state.decor, ...Object.values(state.players).flatMap(homeDecor)];
}

/** A themed collection counts as finished when every piece of it stands somewhere on the island. */
export function collectionDone(placed: readonly PlacedDecor[], c: CollectionId): boolean {
  const have = new Set(placed.map(p => p.item));
  return collectionItems(c).every(i => have.has(i));
}

export function islandScore(state: Readonly<GameState>): Score {
  const placed = allPlaced(state);
  const outside = Math.min(RATING.outsideMax, beauty(state.decor));
  const inside = Math.min(RATING.insideMax, Object.values(state.players).reduce((s, p) => s + beauty(homeDecor(p)), 0) * RATING.insideFactor);
  const variety = Math.min(RATING.varietyMax, new Set(placed.map(p => p.item)).size * RATING.variety);
  const collections = THEMED.filter(c => collectionDone(placed, c)).length * RATING.collection;
  const home = Object.values(state.players).reduce((s, p) => s + p.home.level, 0) * RATING.homeLevel;
  const village = PROJECT_IDS.filter(id => state.projects[id].done).length * RATING.project + state.museum.length * RATING.museum;
  const farm = Math.min(RATING.cropMax, Object.values(state.plots).filter(p => p.crop).length * RATING.crop);
  const parts = { outside, inside, variety, collections, home, village, farm };
  const total = Math.round(Object.values(parts).reduce((a, b) => a + b, 0));
  return { total, parts };
}

/**
 * Counts the stars again. During the day they only go up (`allowDown` is the morning recount).
 * New stars may bring a newcomer, who writes to everyone.
 */
export function updateStars(state: GameState, allowDown = false): GameEvent[] {
  const stars = starsFor(islandScore(state).total);
  const events: GameEvent[] = [];
  if (stars > state.stars) events.push({ type: 'stars.up', stars });
  if (stars > state.stars || allowDown) state.stars = stars;
  for (const [npc, need] of Object.entries(NEWCOMER_STARS) as [NpcId, number][]) {
    if (state.stars < need || state.arrived.includes(npc)) continue;
    state.arrived.push(npc);
    for (const p of Object.values(state.players)) {
      p.mailSeq += 1;
      p.mail.push({ id: p.mailSeq, from: npc, key: 'mail.newcomer', params: { name: villager(npc).name }, taken: false, read: false, day: absoluteDay(state.time) });
      events.push({ type: 'mail.changed', playerId: p.id });
    }
    events.push({ type: 'npc.arrived', npc });
  }
  return events;
}

export type { DecorItem };
