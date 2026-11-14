import { FESTIVALS, SEASONS } from '../data/calendar';
import { FESTIVAL_DEFS, type FestivalDef } from '../data/festivals';
import { MAX_MINE_FLOOR, MINE_D, MINE_START, MINE_W, CRYSTAL_ROCK_CHANCE } from '../data/mine';
import { REGIONS, type Loot, type PuzzleDef, type RegionId, type Shape } from '../data/regions';
import { hearts } from '../data/villagers';
import type { ItemId } from '../data/items';
import type { XZ } from '../data/map';
import type { GameState, PlayerState, PuzzleState } from './types';

/**
 * Stage 6 rules for exploring (pure, no Three.js): which regions are open, where you can walk there,
 * the mine floors (generated the same way everywhere from the seed, the floor and the day), the puzzles
 * and the festivals.
 */

// ---------- Seeded numbers that do not touch the state's generator ----------

/** A 32-bit hash of a text (FNV-1a). */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small generator (mulberry32) for layouts that must match on every device. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One roll for a key on a day (what a forage spot or a grass clump holds today). */
export const dailyRoll = (state: Readonly<GameState>, day: number, key: string): number => seeded(hash(`${state.seed}|${day}|${key}`))();

export function pickLoot(loot: Loot, r: number): { item: ItemId; qty: number } {
  const total = loot.reduce((s, [, , w]) => s + w, 0);
  let x = r * total;
  for (const [item, qty, w] of loot) {
    if (x < w) return { item, qty };
    x -= w;
  }
  const [item, qty] = loot[loot.length - 1]!;
  return { item, qty };
}

// ---------- Regions ----------

export function regionUnlocked(player: Readonly<PlayerState>, region: RegionId): boolean {
  return REGIONS[region].unlock.every(u =>
    (!u.hearts || hearts(player.friends[u.hearts.npc].points) >= u.hearts.hearts) && (!u.tool || player.toolLevels[u.tool.tool] >= u.tool.level));
}

function inShape(s: Shape, x: number, z: number, margin: number): boolean {
  if (s.kind === 'circle') return Math.hypot(x - s.x, z - s.z) <= s.r - margin;
  const x0 = s.x0 + margin, z0 = s.z0 + margin, x1 = s.x1 - margin, z1 = s.z1 - margin;
  if (x < x0 || x > x1 || z < z0 || z > z1) return false;
  const r = Math.max(0, s.r - margin);
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cz = Math.min(Math.max(z, z0 + r), z1 - r);
  return Math.hypot(x - cx, z - cz) <= r;
}

/** Ground height in a region where a character may stand (0), or null (sea, sky, lava edge). */
export function regionGround(region: RegionId, x: number, z: number, margin = 0.3): number | null {
  return REGIONS[region].land.some(s => inShape(s, x, z, margin)) ? 0 : null;
}

// ---------- Mines ----------

export interface MineRock {
  x: number;
  z: number;
  crystal: boolean;
}

export interface MineFloor {
  floor: number;
  /** Wall tiles (index z * MINE_W + x). */
  walls: boolean[];
  rocks: MineRock[];
  /** Index of the rock that hides the ladder down (-1 on the last floor). */
  ladder: number;
  creatures: XZ[];
  /** The treasure on the last floor. */
  treasure: XZ | null;
}

const floorCache = new Map<string, MineFloor>();

/**
 * A mine floor: rock walls around, pillars on a checker pattern (so every open tile stays reachable),
 * rocks to break, a ladder under one of them, and a few creatures far from the start.
 */
export function mineFloor(seed: number, floor: number, day: number): MineFloor {
  const key = `${seed}|${floor}|${day}`;
  const cached = floorCache.get(key);
  if (cached) return cached;
  const rnd = seeded(hash(`mine|${key}`));
  const walls = new Array<boolean>(MINE_W * MINE_D).fill(false);
  const sx = Math.floor(MINE_START[0]), sz = Math.floor(MINE_START[1]);
  const nearStart = (x: number, z: number) => Math.abs(x - sx) <= 1 && Math.abs(z - sz) <= 1;
  for (let z = 0; z < MINE_D; z++) {
    for (let x = 0; x < MINE_W; x++) {
      const border = x === 0 || z === 0 || x === MINE_W - 1 || z === MINE_D - 1;
      const pillar = x % 2 === 0 && z % 2 === 0 && !nearStart(x, z) && rnd() < 0.45;
      walls[z * MINE_W + x] = border || pillar;
    }
  }
  const free: XZ[] = [];
  for (let z = 1; z < MINE_D - 1; z++) for (let x = 1; x < MINE_W - 1; x++) if (!walls[z * MINE_W + x] && !nearStart(x, z)) free.push([x, z]);
  const take = (): XZ => free.splice(Math.floor(rnd() * free.length), 1)[0]!;
  const last = floor >= MAX_MINE_FLOOR;
  const treasure = last ? take() : null;
  const count = Math.min(free.length - 4, 8 + (floor % 5) + Math.floor(floor / 6));
  const rocks: MineRock[] = Array.from({ length: count }, () => {
    const [x, z] = take();
    return { x, z, crystal: rnd() < CRYSTAL_ROCK_CHANCE + floor * 0.004 };
  });
  const ladder = last ? -1 : Math.floor(rnd() * rocks.length);
  const creatures: XZ[] = [];
  const far = free.filter(([x, z]) => Math.hypot(x - sx, z - sz) > 5);
  for (let i = 0; i < Math.min(3, 1 + Math.floor(floor / 7)) && far.length; i++) creatures.push(far.splice(Math.floor(rnd() * far.length), 1)[0]!);
  const result = { floor, walls, rocks, ladder, creatures, treasure };
  if (floorCache.size > 64) floorCache.clear();
  floorCache.set(key, result);
  return result;
}

export const mineWall = (f: MineFloor, x: number, z: number): boolean => {
  const tx = Math.floor(x), tz = Math.floor(z);
  return tx < 0 || tz < 0 || tx >= MINE_W || tz >= MINE_D || f.walls[tz * MINE_W + tx]!;
};

/** Ground in a mine floor (0) or null on walls. */
export const mineGround = (f: MineFloor, x: number, z: number, margin = 0.25): number | null =>
  [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]].every(([dx, dz]) => !mineWall(f, x + dx!, z + dz!)) ? 0 : null;

// ---------- Puzzles ----------

export function newPuzzle(def: PuzzleDef): PuzzleState {
  return { blocks: def.kind === 'push' ? def.blocks.map(([x, z]) => [x, z]) : [], pressed: [], solved: false };
}

export const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] } as const;
export type Dir = keyof typeof DIRS;

/** Where a pushed block ends up, or null if it cannot move there. */
export function pushTarget(def: PuzzleDef, p: PuzzleState, block: number, dir: Dir): XZ | null {
  if (def.kind !== 'push' || p.solved) return null;
  const from = p.blocks[block];
  if (!from) return null;
  const [dx, dz] = DIRS[dir];
  const to: XZ = [from[0] + dx, from[1] + dz];
  const b = def.bounds;
  if (to[0] < b.x0 || to[1] < b.z0 || to[0] >= b.x1 || to[1] >= b.z1) return null;
  if (p.blocks.some(([x, z], i) => i !== block && x === to[0] && z === to[1])) return null;
  return to;
}

export const pushSolved = (def: PuzzleDef, p: PuzzleState): boolean =>
  def.kind === 'push' && def.plates.every(([px, pz]) => p.blocks.some(([x, z]) => x === px && z === pz));

// ---------- Festivals ----------

/** Today's festival (all day long), if there is one. */
export function festivalToday(state: Readonly<GameState>): FestivalDef | null {
  const season = SEASONS[state.time.seasonIndex];
  const f = FESTIVALS.find(x => x.season === season && x.day === state.time.day);
  return f ? FESTIVAL_DEFS[f.id] : null;
}

/** The festival is on: the villagers are gathered in the square and the game can be played. */
export function festivalActive(state: Readonly<GameState>): FestivalDef | null {
  const f = festivalToday(state);
  return f && state.time.minuteOfDay >= f.hours[0] && state.time.minuteOfDay < f.hours[1] ? f : null;
}

export const festivalKey = (state: Readonly<GameState>, f: FestivalDef): string => `${f.id}:${state.time.year}`;
