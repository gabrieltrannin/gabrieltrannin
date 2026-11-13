import { isValidAppearance, NAME_MAX_LENGTH } from '../data/appearance';
import { DAYS_PER_SEASON, SEASONS } from '../data/calendar';
import { FRUITS } from '../data/defaults';
import { HOTBAR_SIZE, INVENTORY_SIZE, isItemId, ITEMS, MAX_ENERGY } from '../data/items';
import { isWeatherId } from './weather';
import { SAVE_VERSION } from './state';
import type { GameState, Inventory, PlayerState } from './types';

/** What goes into storage: the state plus when it was saved and why. */
export interface SaveFile {
  version: number;
  savedAt: number;
  /** "sleep" is the day's real save; "resume" keeps the spot when the page closes. */
  reason: 'sleep' | 'resume';
  state: GameState;
}

export function toSaveFile(state: GameState, reason: SaveFile['reason'], savedAt: number): SaveFile {
  return { version: SAVE_VERSION, savedAt, reason, state: structuredClone(state) };
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isName = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= NAME_MAX_LENGTH;

function validInventory(inv: unknown): inv is Inventory {
  if (!Array.isArray(inv) || inv.length !== INVENTORY_SIZE) return false;
  return inv.every(slot => slot === null || (isObj(slot) && isItemId(slot.item) && isInt(slot.qty) && slot.qty >= 1 && slot.qty <= ITEMS[slot.item].maxStack));
}

function validPlayer(id: string, p: unknown): p is PlayerState {
  if (!isObj(p) || p.id !== id || !isName(p.name) || !isValidAppearance(p.appearance)) return false;
  const pos = p.position;
  if (!isObj(pos) || !isNum(pos.x) || !isNum(pos.z) || !isNum(pos.facing)) return false;
  if (!isInt(p.coins) || p.coins < 0) return false;
  if (!isNum(p.energy) || p.energy < 0 || p.energy > MAX_ENERGY) return false;
  if (!isInt(p.activeSlot) || p.activeSlot < 0 || p.activeSlot >= HOTBAR_SIZE) return false;
  return validInventory(p.inventory);
}

/** Checks every field of a loaded state. Anything unexpected means the save is not used. */
export function isValidState(s: unknown): s is GameState {
  if (!isObj(s) || s.version !== SAVE_VERSION || !isInt(s.seed) || !isInt(s.rng)) return false;
  const t = s.time;
  if (!isObj(t) || !isInt(t.year) || t.year < 1 || !isInt(t.seasonIndex) || t.seasonIndex < 0 || t.seasonIndex >= SEASONS.length) return false;
  if (!isInt(t.day) || t.day < 1 || t.day > DAYS_PER_SEASON || !isInt(t.minuteOfDay) || t.minuteOfDay < 0 || t.minuteOfDay >= 30 * 60 || typeof t.dayEnded !== 'boolean') return false;
  if (!isWeatherId(s.weather)) return false;
  if (!isObj(s.island) || !isName(s.island.name) || !(FRUITS as readonly unknown[]).includes(s.island.nativeFruit)) return false;
  if (!isObj(s.players) || Object.keys(s.players).length === 0) return false;
  if (!Object.entries(s.players).every(([id, p]) => validPlayer(id, p))) return false;
  if (!Array.isArray(s.quests) || !s.quests.every(q => isObj(q) && q.id === 'tour' && Array.isArray(q.visited) && q.visited.every(v => typeof v === 'string') && typeof q.done === 'boolean')) return false;
  if (!isObj(s.trees) || !Object.values(s.trees).every(v => isObj(v) && isInt(v.shakenDay))) return false;
  return true;
}

/** Reads a stored save. Returns null for anything missing, old or damaged. */
export function readSaveFile(data: unknown): SaveFile | null {
  if (!isObj(data) || data.version !== SAVE_VERSION || !isNum(data.savedAt)) return null;
  if (data.reason !== 'sleep' && data.reason !== 'resume') return null;
  return isValidState(data.state) ? (data as unknown as SaveFile) : null;
}
