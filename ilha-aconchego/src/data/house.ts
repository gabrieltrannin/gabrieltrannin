import type { DecorItem } from './decor';
import type { ItemId } from './items';
import type { XZ } from './map';

/**
 * Stage 5: the inside of the player's house (its own scene) and how it grows
 * (docs/GAME_DESIGN.md, "Casa que cresce"). Coordinates inside are local to each floor:
 * x from 0 to the width, z from 0 (back wall) to the depth (front wall, where the door is).
 */

export type FloorId = 'ground' | 'upper' | 'basement';
export const FLOORS: readonly FloorId[] = ['ground', 'upper', 'basement'];
export const isFloorId = (v: unknown): v is FloorId => typeof v === 'string' && (FLOORS as readonly string[]).includes(v);

export interface FloorShape {
  w: number;
  d: number;
}

/** Stairs: a block of 2 × 3 tiles (x, z is the back corner), and the floor it leads to. */
export interface Stairs {
  to: FloorId;
  x: number;
  z: number;
}

export interface HomeLevel {
  /** What this level adds (i18n `home.level.<n>`). */
  floors: Partial<Record<FloorId, FloorShape>>;
  /** Price of reaching this level (paid to Lino). */
  cost: { coins: number; items: readonly { item: ItemId; qty: number }[] } | null;
}

export const HOME_LEVELS: readonly HomeLevel[] = [
  { floors: { ground: { w: 7, d: 6 } }, cost: null },
  // A second room on the side.
  { floors: { ground: { w: 11, d: 6 } }, cost: { coins: 2500, items: [{ item: 'res.wood', qty: 40 }] } },
  // Stairs to a bedroom upstairs.
  { floors: { ground: { w: 11, d: 6 }, upper: { w: 9, d: 6 } }, cost: { coins: 6000, items: [{ item: 'res.wood', qty: 60 }, { item: 'res.stone', qty: 30 }] } },
  // And a cellar.
  { floors: { ground: { w: 11, d: 6 }, upper: { w: 9, d: 6 }, basement: { w: 9, d: 6 } }, cost: { coins: 10000, items: [{ item: 'res.stone', qty: 50 }, { item: 'res.copper', qty: 10 }] } },
];
export const MAX_HOME_LEVEL = HOME_LEVELS.length - 1;

export const floorShape = (level: number, floor: FloorId): FloorShape | null => HOME_LEVELS[Math.min(level, MAX_HOME_LEVEL)]!.floors[floor] ?? null;

export const STAIRS_DEPTH = 3;
/** Where the player stands to use the stairs. */
export const stairsSpot = (s: Stairs): XZ => [s.x + 1, s.z + STAIRS_DEPTH + 0.2];

/** Stairs on each floor (only once that floor and the one they lead to exist). */
export const STAIRS_ON: Record<FloorId, readonly Stairs[]> = {
  ground: [{ to: 'upper', x: 9, z: 0 }, { to: 'basement', x: 7, z: 0 }],
  upper: [{ to: 'ground', x: 0, z: 0 }],
  basement: [{ to: 'ground', x: 7, z: 0 }],
};

export function stairsOn(level: number, floor: FloorId): Stairs[] {
  if (!floorShape(level, floor)) return [];
  return STAIRS_ON[floor].filter(s => !!floorShape(level, s.to));
}

/** Where you stand after taking the stairs: in front of the stairs that lead back. */
export function arrivalSpot(level: number, floor: FloorId, from: FloorId): XZ {
  const back = stairsOn(level, floor).find(s => s.to === from);
  return back ? [back.x + 1, back.z + STAIRS_DEPTH + 0.5] : [1.5, 2.5];
}

/** The front door of the ground floor: the tile in front of it stays free. */
export const DOOR_TILE = { x: 3, z: 5 } as const;
export const DOOR_SPOT: XZ = [3.5, 5.6];
/** Where you appear when coming in. */
export const ENTRY_SPOT: XZ = [3.5, 4.9];
export const DOOR_REACH = 1.3;
export const STAIRS_REACH = 1.8;

/** Tiles that must stay free on a floor: the door, the stairs and the tiles in front of them. */
export function reservedTiles(level: number, floor: FloorId): XZ[] {
  const tiles: XZ[] = [];
  if (floor === 'ground') tiles.push([DOOR_TILE.x, DOOR_TILE.z]);
  for (const s of stairsOn(level, floor)) {
    for (let x = s.x; x < s.x + 2; x++) for (let z = s.z; z <= s.z + STAIRS_DEPTH; z++) tiles.push([x, z]);
  }
  return tiles;
}

/** What a new house has inside. */
export const STARTING_HOME: readonly { item: DecorItem; x: number; z: number; rot: number }[] = [
  { item: 'furn.bed', x: 0, z: 0, rot: 0 },
  { item: 'furn.wardrobe', x: 5, z: 0, rot: 0 },
  { item: 'furn.mirror', x: 4, z: 0, rot: 0 },
  { item: 'furn.rug', x: 2, z: 2, rot: 0 },
  { item: 'furn.table', x: 4, z: 2, rot: 1 },
  { item: 'furn.chair', x: 5, z: 3, rot: 3 },
  { item: 'furn.lamp', x: 0, z: 3, rot: 0 },
  { item: 'furn.plant', x: 6, z: 5, rot: 0 },
];

/** Outside, the house grows with its levels: assets placed around the hut (offsets from data/map HOUSE). */
export const HOUSE_GROWTH: readonly { asset: string; level: number; dx: number; dz: number; dy: number; ry: number }[] = [
  { asset: 'house.annex', level: 1, dx: -2.7, dz: -1.3, dy: 0, ry: 0.5 },
  { asset: 'house.loft', level: 2, dx: 0, dz: 1.75, dy: 3.3, ry: 0 },
  { asset: 'house.cellar', level: 3, dx: 2.1, dz: -0.5, dy: 0, ry: -0.3 },
];
