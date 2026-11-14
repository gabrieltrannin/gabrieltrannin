import { FARM_CROP_DEFS, isFarmCrop } from '../data/crops';
import { BUGS, FISH } from '../data/fish';
import { ITEMS, type ItemId } from '../data/items';
import type { XZ } from '../data/map';
import { FIRST_REQUEST, MAX_REQUESTS, REQUEST_DAYS } from '../data/community';
import { FRIEND_POINTS, homeOf, NPC_IDS, PLACES, villager, VILLAGERS, type NpcId, type PlaceId, type Routine, type VillagerDef } from '../data/villagers';
import type { WeatherId } from '../data/weather';
import { absoluteDay, seasonOf } from './clock';
import { pickWeighted, roll } from './rules';
import type { FriendState, GameState, GameTime, RequestState } from './types';

/** Pure rules about the villagers: where they are, what they think of a gift, the board's requests. */

export type Reaction = 'love' | 'like' | 'neutral' | 'dislike';

/** What a villager thinks of a gift. A specific item counts more than a whole kind. */
export function reactionTo(def: VillagerDef, item: ItemId): Reaction {
  if (def.gifts.love.includes(item)) return 'love';
  if (def.gifts.like.includes(item)) return 'like';
  if (def.gifts.dislike.includes(item)) return 'dislike';
  const kind = ITEMS[item].kind;
  if (def.gifts.like.includes(kind)) return 'like';
  if (def.gifts.dislike.includes(kind)) return 'dislike';
  return 'neutral';
}

export const isBirthday = (def: VillagerDef, time: GameTime): boolean => def.birthday.season === seasonOf(time) && def.birthday.day === time.day;

/** Points a gift is worth (double on their birthday). */
export function giftPoints(reaction: Reaction, birthday: boolean): number {
  const base = FRIEND_POINTS[reaction];
  return birthday && base > 0 ? base * FRIEND_POINTS.birthdayBonus : base;
}

export const newFriend = (): FriendState => ({ points: 0, talkedDay: -1, giftDay: -1, known: {}, lastGift: null, scene: 0, mailedTier: 0 });

/** The routine for today's weather. */
export const routineFor = (def: VillagerDef, weather: WeatherId): Routine => (weather === 'rain' || weather === 'storm' ? def.rain ?? def.routine : def.routine);

/** Where the routine says to be at a minute, and where they were before (they may still be walking). */
export function scheduleAt(routine: Routine, minute: number): { place: PlaceId; previous: PlaceId; since: number } {
  let index = 0;
  for (let i = 0; i < routine.length; i++) if (minute >= routine[i]![0]) index = i;
  const [since, place] = routine[index]!;
  const previous = routine[Math.max(0, index - 1)]![1];
  return { place, previous, since };
}

/** A place in the world; places that need an unlocked area fall back to a nearby one. */
export function placePoint(npc: NpcId, place: PlaceId, opened: { bridge: boolean }): XZ {
  if (place === 'home') return homeOf(npc);
  if ((place === 'wood' || place === 'woodGrove') && !opened.bridge) return PLACES.beachWest;
  return PLACES[place];
}

/** Where a villager should be right now (by the clock, the weather and what is open). */
export function villagerSpot(state: Readonly<GameState>, npc: NpcId): { at: XZ; previous: XZ; place: PlaceId } {
  const def = villager(npc);
  const s = scheduleAt(routineFor(def, state.weather), state.time.minuteOfDay);
  const opened = { bridge: state.projects.bridge?.done ?? false };
  return { at: placePoint(npc, s.place, opened), previous: placePoint(npc, s.previous, opened), place: s.place };
}

/** True while a villager stands at their shop counter, so the shop is open. */
export function shopOpen(state: Readonly<GameState>, shop: NonNullable<VillagerDef['shop']>): boolean {
  const def = VILLAGERS.find(v => v.shop === shop);
  if (!def) return true;
  const place = scheduleAt(routineFor(def, state.weather), state.time.minuteOfDay).place;
  const counter: Record<string, PlaceId> = { bread: 'stall.bread', honey: 'stall.honey', flowers: 'stall.flowers', seeds: 'seeds', smithy: 'forge' };
  return place === counter[shop];
}

// ---------- Notice board requests ----------

export function firstRequest(): RequestState {
  return { id: 1, npc: FIRST_REQUEST.npc, item: FIRST_REQUEST.item, qty: FIRST_REQUEST.qty, reward: FIRST_REQUEST.reward, until: -1, done: false };
}

/** Can the player get this item right now (crops in season, fish and bugs of the season, the native fruit)? */
function obtainable(state: Readonly<GameState>, item: ItemId): boolean {
  const season = seasonOf(state.time);
  if (item.startsWith('crop.')) {
    const crop = item.slice(5);
    return isFarmCrop(crop) && (FARM_CROP_DEFS[crop].seasons.includes(season) || state.greenhouse);
  }
  if (item.startsWith('fruit.')) return item === `fruit.${state.island.nativeFruit}` || (state.projects.bridge?.done ?? false);
  if (item.startsWith('fish.')) return FISH.some(f => f.item === item && f.seasons.includes(season));
  if (item.startsWith('bug.')) return BUGS.some(b => b.item === item && b.seasons.includes(season));
  if (item === 'res.fossil') return true;
  return true;
}

/** Morning step: old requests leave the board and new ones are pinned (up to three). */
export function refreshRequests(state: GameState): boolean {
  const today = absoluteDay(state.time);
  const before = state.requests.length;
  state.requests = state.requests.filter(r => !r.done && (r.until < 0 || r.until >= today));
  let changed = state.requests.length !== before;
  let tries = 0;
  while (state.requests.length < MAX_REQUESTS && tries++ < 12) {
    const npc = NPC_IDS[Math.floor(roll(state) * NPC_IDS.length)]!;
    if (state.requests.some(r => r.npc === npc)) continue;
    const options = villager(npc).asks.filter(item => obtainable(state, item));
    const item = pickWeighted(state, options.map(i => [i, 1] as const));
    if (!item) continue;
    const price = ITEMS[item].sell;
    const qty = price >= 120 ? 1 : price >= 60 ? 1 + Math.floor(roll(state) * 2) : 2 + Math.floor(roll(state) * 3);
    const reward = Math.round((price * qty * 2.2 + 60) / 10) * 10;
    state.requestSeq += 1;
    state.requests.push({ id: state.requestSeq, npc, item, qty, reward, until: today + REQUEST_DAYS, done: false });
    changed = true;
  }
  return changed;
}

export { villager };
