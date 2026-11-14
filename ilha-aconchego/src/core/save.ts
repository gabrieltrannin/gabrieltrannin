import { ANIMAL_KINDS } from '../data/animals';
import { isValidAppearance, NAME_MAX_LENGTH } from '../data/appearance';
import { isFarmCrop } from '../data/crops';
import { DAYS_PER_SEASON, SEASONS } from '../data/calendar';
import { FRUITS } from '../data/defaults';
import { HOTBAR_SIZE, INVENTORY_SIZE, isItemId, ITEMS, MAX_ENERGY } from '../data/items';
import { isWeatherId } from './weather';
import { SKILLS } from '../data/skills';
import { MAX_TOOL_LEVEL, TOOLS } from '../data/tools';
import { newIslandProgress, newIslandVillage, newPlayerProgress, newPlayerVillage, SAVE_VERSION } from './state';
import { NPC_IDS } from '../data/villagers';
import { PROJECT_IDS } from '../data/community';
import type { GameState, Inventory, ItemStack, PlayerState } from './types';

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

const validStack = (slot: unknown): slot is ItemStack =>
  isObj(slot) && isItemId(slot.item) && isInt(slot.qty) && slot.qty >= 1 && (slot.q === undefined || slot.q === 1 || slot.q === 2);

function validInventory(inv: unknown): inv is Inventory {
  if (!Array.isArray(inv) || inv.length !== INVENTORY_SIZE) return false;
  return inv.every(slot => slot === null || (validStack(slot) && slot.qty <= ITEMS[slot.item].maxStack));
}

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const allValues = (v: unknown, check: (x: unknown) => boolean) => isObj(v) && Object.values(v).every(check);

function validPlayer(id: string, p: unknown): p is PlayerState {
  if (!isObj(p) || p.id !== id || !isName(p.name) || !isValidAppearance(p.appearance)) return false;
  const pos = p.position;
  if (!isObj(pos) || !isNum(pos.x) || !isNum(pos.z) || !isNum(pos.facing)) return false;
  if (!isInt(p.coins) || p.coins < 0) return false;
  if (!isNum(p.energy) || p.energy < 0 || p.energy > MAX_ENERGY) return false;
  if (!isInt(p.activeSlot) || p.activeSlot < 0 || p.activeSlot >= HOTBAR_SIZE) return false;
  if (!isObj(p.toolLevels) || !TOOLS.every(t => isInt((p.toolLevels as Record<string, unknown>)[t]) && ((p.toolLevels as Record<string, number>)[t]! >= 1) && (p.toolLevels as Record<string, number>)[t]! <= MAX_TOOL_LEVEL)) return false;
  if (!isObj(p.skills) || !SKILLS.every(k => isNum((p.skills as Record<string, unknown>)[k]) && ((p.skills as Record<string, number>)[k]! >= 0))) return false;
  if (p.buff !== null && typeof p.buff !== 'string') return false;
  if (p.fishing !== null && !(isObj(p.fishing) && isItemId(p.fishing.item))) return false;
  if (!isObj(p.friends) || !NPC_IDS.every(id => validFriend((p.friends as Record<string, unknown>)[id]))) return false;
  if (!Array.isArray(p.mail) || !p.mail.every(validMail) || !isInt(p.mailSeq)) return false;
  return validInventory(p.inventory);
}

function validFriend(f: unknown): boolean {
  return isObj(f) && isNum(f.points) && isInt(f.talkedDay) && isInt(f.giftDay) && isObj(f.known) && isInt(f.scene) && isInt(f.mailedTier)
    && (f.lastGift === null || (isObj(f.lastGift) && isItemId(f.lastGift.item) && isInt(f.lastGift.day)));
}

function validMail(m: unknown): boolean {
  return isObj(m) && isInt(m.id) && typeof m.from === 'string' && typeof m.key === 'string' && isObj(m.params) && isBool(m.taken) && isBool(m.read) && isInt(m.day)
    && (m.item === undefined || (isItemId(m.item) && isInt(m.qty)));
}

function validPlot(v: unknown): boolean {
  if (!isObj(v)) return false;
  return isBool(v.tilled) && (v.crop === null || isFarmCrop(v.crop)) && isInt(v.growth) && isBool(v.ripe) && isBool(v.watered) && isBool(v.sprinkler)
    && (v.fertilizer === null || v.fertilizer === 'fertilizer' || v.fertilizer === 'growth');
}

function validIsland(s: Record<string, unknown>): boolean {
  if (!isWeatherId(s.forecast) || !isBool(s.greenhouse)) return false;
  if (!allValues(s.plots, validPlot)) return false;
  if (!Array.isArray(s.animals) || !s.animals.every(a => isObj(a) && typeof a.id === 'string' && (ANIMAL_KINDS as readonly unknown[]).includes(a.kind) && isNum(a.friendship) && isBool(a.ready) && isBool(a.fedToday) && isBool(a.pettedToday) && isInt(a.lastProduct))) return false;
  if (!allValues(s.machines, m => isObj(m) && typeof m.kind === 'string' && (m.output === null || isItemId(m.output)) && isNum(m.readyAt))) return false;
  if (!allValues(s.nodes, n => isObj(n) && (n.ore === null || typeof n.ore === 'string') && isInt(n.back))) return false;
  if (!allValues(s.stumps, isInt) || !allValues(s.grass, isInt) || !allValues(s.hives, isInt)) return false;
  if (!allValues(s.shipping, list => Array.isArray(list) && list.every(validStack))) return false;
  if (!Array.isArray(s.requests) || !s.requests.every(r => isObj(r) && isInt(r.id) && typeof r.npc === 'string' && isItemId(r.item) && isInt(r.qty) && isInt(r.reward) && isInt(r.until) && isBool(r.done))) return false;
  if (!isInt(s.requestSeq) || !isObj(s.projects) || !PROJECT_IDS.every(id => { const p = (s.projects as Record<string, unknown>)[id]; return isObj(p) && isObj(p.given) && isInt(p.coins) && isBool(p.done); })) return false;
  return Array.isArray(s.museum) && s.museum.every(isItemId);
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
  return validIsland(s);
}

/**
 * Brings a save from an older version up to date (stage 2 saves have no farm, animals or skills yet).
 * Returns the same object changed in place, or null if the version is unknown.
 */
export function migrateSave(data: Record<string, unknown>): Record<string, unknown> | null {
  if (data.version === SAVE_VERSION) return data;
  if ((data.version !== 2 && data.version !== 3) || !isObj(data.state)) return null;
  const state = data.state as Record<string, unknown>;
  if (!isObj(state.time) || !isInt(state.rng)) return null;
  const players = isObj(state.players) ? Object.values(state.players).filter(isObj) : [];
  if (data.version === 2) {
    // Stage 3: farm, animals, skills and tool levels.
    Object.assign(state, newIslandProgress(state.time as unknown as GameState['time'], state.rng));
    for (const p of players) Object.assign(p, newPlayerProgress());
  }
  // Stage 4: villagers, the notice board, projects, museum and mail.
  Object.assign(state, newIslandVillage());
  for (const p of players) Object.assign(p, newPlayerVillage());
  state.version = SAVE_VERSION;
  data.version = SAVE_VERSION;
  return data;
}

/** Reads a stored save. Returns null for anything missing, old or damaged. */
export function readSaveFile(raw: unknown): SaveFile | null {
  if (!isObj(raw)) return null;
  const data = migrateSave(raw);
  if (!data || data.version !== SAVE_VERSION || !isNum(data.savedAt)) return null;
  if (data.reason !== 'sleep' && data.reason !== 'resume') return null;
  return isValidState(data.state) ? (data as unknown as SaveFile) : null;
}
