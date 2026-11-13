import type { XZ } from '../data/map';
import type { SkillId } from '../data/skills';
import { ITEMS, type ItemId, type Quality } from '../data/items';
import { absoluteDay } from './clock';
import type { Command, CommandError, GameEvent } from './commands';
import { spaceFor } from './inventory';
import { addXp } from './rules';
import type { Actor, GameState, Inventory, PlayerState, Role } from './types';

/** Shared pieces for the command handlers (kept apart from commands.ts so handler files can use them). */
export interface Handler<C extends Command> {
  /** Roles allowed to send this command. */
  roles: readonly Role[];
  /** Must not change the state. Returns an error code or null. */
  validate(state: Readonly<GameState>, cmd: C, actor: Actor): CommandError | null;
  /** Changes the state in place and returns what happened. Only called after `validate` passed. */
  apply(state: GameState, cmd: C, actor: Actor): GameEvent[];
}

export type HandlersFor<T extends Command['type']> = { [K in T]: Handler<Extract<Command, { type: K }>> };

export const PLAYERS: readonly Role[] = ['host', 'resident', 'visitor'];
/** Farm work, animals and machines belong to the people who live on the island. */
export const RESIDENTS: readonly Role[] = ['host', 'resident'];

export const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
export const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export const has = (obj: object, key: unknown): boolean => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);

export const playerOf = (state: Readonly<GameState>, actor: Actor): PlayerState | undefined =>
  has(state.players, actor.id) ? state.players[actor.id] : undefined;
export const distance = (p: PlayerState, [x, z]: XZ) => Math.hypot(p.position.x - x, p.position.z - z);
export const near = (p: PlayerState, at: XZ, reach: number) => distance(p, at) <= reach;

/** Room for one more of `item` whatever quality it turns out to be. */
export function hasRoom(inv: Inventory, item: ItemId, qty = 1): boolean {
  if (inv.some(s => s === null)) return true;
  return ([0, 1, 2] as Quality[]).every(q => spaceFor(inv, item, q) >= qty);
}

export const hasItem = (inv: Inventory, item: ItemId): boolean => inv.some(s => s?.item === item);

/** Absolute game minute, to time machines across days. */
export const nowMinute = (state: Readonly<GameState>): number => absoluteDay(state.time) * 1440 + state.time.minuteOfDay;

/** Gives experience and returns the events (a level-up event when it happens). */
export function xp(player: PlayerState, skill: SkillId, amount: number): GameEvent[] {
  const level = addXp(player, skill, amount);
  return level === null ? [] : [{ type: 'skill.up', playerId: player.id, skill, level }];
}

export const gained = (playerId: string, item: ItemId, qty: number, q: Quality = 0): GameEvent => ({ type: 'item.gained', playerId, item, qty, q });
export const changed = (playerId: string): GameEvent[] => [{ type: 'inventory.changed', playerId }, { type: 'player.changed', playerId }];
export const sellable = (item: ItemId): boolean => ITEMS[item].sell > 0;
