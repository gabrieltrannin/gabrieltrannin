import { DECOR, decorDef, footprintSize, isDecorItem, type DecorItem, type DecorUse, type StationId } from '../data/decor';
import { floorShape, reservedTiles, type FloorId } from '../data/house';
import {
  BENTO_SPOT, GREENHOUSE, HIVES, HOUSE_DOOR, KITCHEN, MACHINE_PADS, MAILBOX, MINE_NODES, PEN, PIER, RAMP, SHIPPING_BIN, STAIRS, STALLS, STUMPS, TALL_GRASS,
  WORKBENCH, type XZ,
} from '../data/map';
import { PATH_EDGES, PATH_NODES } from '../data/paths';
import { PLAYER_STALL_SPOT } from '../data/rating';
import { BRIDGES, HOUSE_SPOTS, houseDoor, MUSEUM_DOOR, NOTICE_BOARD, SEED_SHOP_COUNTER, TENTS, tentDoor, WELL } from '../data/village';
import { buildColliders, walkableHeight, type Collider } from '../world/collision';
import { groundHeight } from '../world/terrain';
import type { GameState, PlacedDecor, PlayerState } from './types';

/**
 * Stage 5: the decoration grid (pure rules, no Three.js). A decoration covers whole 1 × 1 tiles; tile
 * (tx, tz) spans x from tx to tx + 1. Outside, a tile must be flat walkable ground, away from buildings,
 * work spots and the villagers' paths; inside, it must be on the floor and off the door and stairs.
 */

export type Tile = readonly [number, number];

/** Tiles a decoration covers when its corner is at (x, z) with `rot` quarter turns. */
export function tilesOf(item: DecorItem, x: number, z: number, rot: number): Tile[] {
  const { w, d } = footprintSize(item, rot);
  const tiles: Tile[] = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) tiles.push([x + i, z + j]);
  return tiles;
}

/** Middle of a decoration on the ground. */
export function decorCenter(p: Pick<PlacedDecor, 'item' | 'x' | 'z' | 'rot'>): XZ {
  if (!isDecorItem(p.item)) return [p.x + 0.5, p.z + 0.5];
  const { w, d } = footprintSize(p.item, p.rot);
  return [p.x + w / 2, p.z + d / 2];
}

/** Outside: how far from the player a decoration may be placed, moved or put away. */
export const DECOR_REACH = 7;
/** How close you must be to use a decoration (sit, open the wardrobe, work at a station). */
export const USE_REACH = 1.3;

/** Spots outside that must stay clear (doors, counters, work spots), with the clear radius. */
function keepClear(): readonly (readonly [number, number, number])[] {
  const spots: [number, number, number][] = [
    [HOUSE_DOOR[0], HOUSE_DOOR[1], 2.2], [MAILBOX[0], MAILBOX[1], 1.1], [SHIPPING_BIN[0], SHIPPING_BIN[1], 1.4], [KITCHEN[0], KITCHEN[1], 1.6],
    [WORKBENCH[0], WORKBENCH[1], 1.6], [BENTO_SPOT[0], BENTO_SPOT[1], 1.4], [NOTICE_BOARD[0], NOTICE_BOARD[1], 1.6], [WELL[0], WELL[1], 1.2],
    [MUSEUM_DOOR[0], MUSEUM_DOOR[1], 1.8], [SEED_SHOP_COUNTER[0], SEED_SHOP_COUNTER[1], 1.6], [PLAYER_STALL_SPOT[0], PLAYER_STALL_SPOT[1], 1.3],
    [GREENHOUSE.x, GREENHOUSE.z + GREENHOUSE.d / 2 + 0.4, 1.2], [PEN.x1, (PEN.gate[0] + PEN.gate[1]) / 2, 1.4],
    [(RAMP.x0 + RAMP.x1) / 2, RAMP.zTop, 1.6], [(RAMP.x0 + RAMP.x1) / 2, RAMP.zBottom, 1.6],
    [(STAIRS.x0 + STAIRS.x1) / 2, STAIRS.z0 - 0.4, 1.6], [(STAIRS.x0 + STAIRS.x1) / 2, STAIRS.z1 + 0.4, 1.6], [(PIER.x0 + PIER.x1) / 2, PIER.z0, 1.4],
  ];
  for (const s of STALLS) spots.push([s.at[0], s.at[1] + 1.2, 1.3]);
  for (const [x, z] of [...MACHINE_PADS, ...MINE_NODES, ...STUMPS, ...HIVES]) spots.push([x, z, 1.0]);
  for (const h of HOUSE_SPOTS) spots.push([houseDoor(h)[0], houseDoor(h)[1], 1.0]);
  for (const h of TENTS) spots.push([h.x, h.z, 2.0], [tentDoor(h)[0], tentDoor(h)[1], 1.0]);
  for (const b of BRIDGES) {
    if (b.along === 'x') spots.push([b.x0, (b.z0 + b.z1) / 2, 1.6], [b.x1, (b.z0 + b.z1) / 2, 1.6]);
    else spots.push([(b.x0 + b.x1) / 2, b.z0, 1.6], [(b.x0 + b.x1) / 2, b.z1, 1.6]);
  }
  return spots;
}

let staticCache: { colliders: Collider[]; clear: ReturnType<typeof keepClear>; paths: [XZ, XZ][] } | null = null;
function statics() {
  if (!staticCache) {
    staticCache = {
      colliders: buildColliders({ tents: TENTS.map(t => t.npc) }),
      clear: keepClear(),
      paths: PATH_EDGES.map(([a, b]) => [PATH_NODES[a]!, PATH_NODES[b]!] as [XZ, XZ]),
    };
  }
  return staticCache;
}

function segmentDistance(px: number, pz: number, [ax, az]: XZ, [bx, bz]: XZ): number {
  const dx = bx - ax, dz = bz - az, len = dx * dx + dz * dz;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function tileHitsCollider(tx: number, tz: number, c: Collider): boolean {
  const pad = 0.06, x0 = tx + pad, z0 = tz + pad, x1 = tx + 1 - pad, z1 = tz + 1 - pad;
  if (c.kind === 'circle') {
    const qx = Math.min(Math.max(c.x, x0), x1), qz = Math.min(Math.max(c.z, z0), z1);
    return Math.hypot(c.x - qx, c.z - qz) < c.r;
  }
  return c.x0 < x1 && c.x1 > x0 && c.z0 < z1 && c.z1 > z0;
}

/** True if an outdoor tile can hold a decoration: flat ground, nothing solid, off paths and work spots. */
export function outdoorTileFree(tx: number, tz: number): boolean {
  const cx = tx + 0.5, cz = tz + 0.5;
  const h = groundHeight(cx, cz);
  if (h === null || walkableHeight(cx, cz) !== h) return false;
  for (const [ox, oz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]] as const) {
    const corner = walkableHeight(cx + ox, cz + oz);
    if (corner === null || Math.abs(corner - h) > 0.05) return false;
  }
  if (cx > TALL_GRASS.x0 - 0.3 && cx < TALL_GRASS.x1 + 0.3 && cz > TALL_GRASS.z0 - 0.3 && cz < TALL_GRASS.z1 + 0.3) return false;
  const s = statics();
  if (s.colliders.some(c => tileHitsCollider(tx, tz, c))) return false;
  if (s.clear.some(([x, z, r]) => Math.hypot(cx - x, cz - z) < r)) return false;
  return !s.paths.some(([a, b]) => segmentDistance(cx, cz, a, b) < 0.6);
}

/** Where a decoration is: on the island, or on a floor of a player's house. */
export type DecorSpace = { kind: 'island' } | { kind: 'home'; playerId: string; floor: FloorId };

export const spaceOf = (player: PlayerState): DecorSpace => (player.inside ? { kind: 'home', playerId: player.id, floor: player.inside } : { kind: 'island' });

export function decorList(state: Readonly<GameState>, space: DecorSpace): PlacedDecor[] {
  if (space.kind === 'island') return state.decor;
  return state.players[space.playerId]?.home.floors[space.floor] ?? [];
}

/** Two decorations clash on a shared tile unless exactly one of them lies flat (a rug under a table). */
function clashes(a: DecorItem, b: DecorItem): boolean {
  return !!(DECOR[a] as { flat?: boolean }).flat === !!(DECOR[b] as { flat?: boolean }).flat;
}

/** Why a decoration cannot go at (x, z, rot) in a space, or null if it can. `ignore` is the id being moved. */
export function placementError(state: Readonly<GameState>, space: DecorSpace, item: DecorItem, x: number, z: number, rot: number, ignore = -1): 'invalid' | 'occupied' | null {
  if (!Number.isInteger(x) || !Number.isInteger(z) || !Number.isInteger(rot) || rot < 0 || rot > 3) return 'invalid';
  const def = decorDef(item);
  const tiles = tilesOf(item, x, z, rot);
  if (space.kind === 'island') {
    if (def.where === 'in') return 'invalid';
    if (!tiles.every(([tx, tz]) => outdoorTileFree(tx, tz))) return 'occupied';
    // All tiles on the same level (no decoration across a cliff step).
    const heights = tiles.map(([tx, tz]) => groundHeight(tx + 0.5, tz + 0.5) ?? 0);
    if (Math.max(...heights) - Math.min(...heights) > 0.05) return 'occupied';
  } else {
    if (def.where === 'out') return 'invalid';
    const owner = state.players[space.playerId];
    const shape = owner ? floorShape(owner.home.level, space.floor) : null;
    if (!owner || !shape) return 'invalid';
    if (!tiles.every(([tx, tz]) => tx >= 0 && tz >= 0 && tx < shape.w && tz < shape.d)) return 'invalid';
    const reserved = reservedTiles(owner.home.level, space.floor);
    if (tiles.some(([tx, tz]) => reserved.some(([rx, rz]) => rx === tx && rz === tz))) return 'occupied';
  }
  for (const other of decorList(state, space)) {
    if (other.id === ignore || !isDecorItem(other.item) || !clashes(item, other.item)) continue;
    const taken = tilesOf(other.item, other.x, other.z, other.rot);
    if (tiles.some(([tx, tz]) => taken.some(([ox, oz]) => ox === tx && oz === tz))) return 'occupied';
  }
  return null;
}

/** Solid boxes for the decorations of a space (flat ones are walked over). */
export function decorColliders(list: readonly PlacedDecor[]): Collider[] {
  const out: Collider[] = [];
  for (const p of list) {
    if (!isDecorItem(p.item) || (DECOR[p.item] as { flat?: boolean }).flat) continue;
    const { w, d } = footprintSize(p.item, p.rot);
    out.push({ kind: 'box', x0: p.x + 0.1, z0: p.z + 0.1, x1: p.x + w - 0.1, z1: p.z + d - 0.1 });
  }
  return out;
}

/** Distance from a point to the edge of a decoration's footprint (0 when on it). */
export function distanceToDecor(px: number, pz: number, p: PlacedDecor): number {
  if (!isDecorItem(p.item)) return Infinity;
  const { w, d } = footprintSize(p.item, p.rot);
  const qx = Math.min(Math.max(px, p.x), p.x + w), qz = Math.min(Math.max(pz, p.z), p.z + d);
  return Math.hypot(px - qx, pz - qz);
}

/** Decorations of a use (or a station) within reach of the player, in the space the player is in. */
export function usableNear(state: Readonly<GameState>, player: PlayerState, use: DecorUse, station?: StationId): PlacedDecor | null {
  for (const p of decorList(state, spaceOf(player))) {
    if (!isDecorItem(p.item)) continue;
    const def = DECOR[p.item] as { use?: DecorUse; station?: StationId };
    if (def.use !== use || (station && def.station !== station)) continue;
    if (distanceToDecor(player.position.x, player.position.z, p) <= USE_REACH) return p;
  }
  return null;
}
