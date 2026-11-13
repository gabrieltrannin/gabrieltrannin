import type { SeasonId } from '../data/calendar';
import { FOOTPRINTS, type Footprint } from '../data/footprints';
import {
  BEDS, BLOSSOM_TREES, BUSHES, FENCE_GATE_POSTS, FENCE_LINES, GLOBE_LAMPS, GROUND_LANTERNS, HEDGES, LEVELS, LIGHT_POLES,
  ORCHARD, PALMS, PIER, PINES, PROPS, ROCKS, ROUND_TREES, STAIRS, STALLS,
} from '../data/map';
import { groundHeight, insideRoundedRect } from './terrain';

/**
 * Walking rules, as pure functions (no Three.js): where the ground can be walked on, what blocks the way,
 * and how a step slides along obstacles. The multiplayer server can run the same checks.
 */

export type Collider =
  | { kind: 'circle'; x: number; z: number; r: number; onlyIn?: SeasonId }
  | { kind: 'box'; x0: number; z0: number; x1: number; z1: number };

export const PLAYER_RADIUS = 0.32;
/** Highest ground change allowed in one step; cliffs are 1.05 to 1.4 tall, so only the ramp and the stairs connect levels. */
export const MAX_STEP = 0.36;
/** Keep this far from cliff edges and the waterline. */
const EDGE_MARGIN = 0.32;

/**
 * Ground height where a character may stand, or null (sea, cliff edge).
 * Like groundHeight, but keeps a margin from the edges so characters do not hang over them.
 */
export function walkableHeight(x: number, z: number): number | null {
  const main = LEVELS.main;
  if (x > STAIRS.x0 + 0.08 && x < STAIRS.x1 - 0.08 && z >= STAIRS.z0 - 0.6 && z <= STAIRS.z1) {
    if (z < STAIRS.z0) return main.top;
    return groundHeight(x, z);
  }
  if (insideRoundedRect(x, z, main, EDGE_MARGIN)) return groundHeight(x, z);
  if (x > PIER.x0 + 0.1 && x < PIER.x1 - 0.1 && z > PIER.z0 && z < PIER.z1 - 0.1) return PIER.deck;
  if (insideRoundedRect(x, z, LEVELS.beach, EDGE_MARGIN) && !insideRoundedRect(x, z, main, -0.05)) return LEVELS.beach.top;
  return null;
}

function footprintCollider(footprint: Footprint, x: number, z: number, ry = 0, scale = 1): Collider {
  if ('r' in footprint) return { kind: 'circle', x, z, r: footprint.r * scale };
  // Boxes turned by about a quarter turn swap width and depth; small turns keep them.
  const quarter = Math.abs(Math.sin(ry)) > 0.7;
  const w = (quarter ? footprint.d : footprint.w) * scale, d = (quarter ? footprint.w : footprint.d) * scale;
  const cz = z + (footprint.dz ?? 0) * scale;
  return { kind: 'box', x0: x - w / 2, z0: cz - d / 2, x1: x + w / 2, z1: cz + d / 2 };
}

const fp = (asset: string): Footprint => FOOTPRINTS[asset] ?? { r: 0.4 };

/** Everything solid on the starting island, built from the map data. */
export function buildColliders(): Collider[] {
  const list: Collider[] = [];
  for (const p of PROPS) {
    const c = footprintCollider(fp(p.asset), p.at[0], p.at[1], p.ry, p.scale);
    if (p.asset === 'boat') continue;
    if (p.asset === 'snowman' && c.kind === 'circle') c.onlyIn = 'winter';
    if (p.asset === 'pumpkin.deco' && c.kind === 'circle') c.onlyIn = 'autumn';
    list.push(c);
  }
  for (const s of STALLS) list.push(footprintCollider(fp(s.asset), s.at[0], s.at[1]));
  for (const b of BEDS) {
    list.push({ kind: 'box', x0: b.x0 - 0.15, z0: b.z0 - 0.15, x1: b.x1 + 0.15, z1: b.z1 + 0.15 });
    list.push(footprintCollider(fp('sign.crop'), b.sign[0], b.sign[1]));
  }
  for (const [[ax, az], [bx, bz]] of FENCE_LINES) {
    const t = fp('fence.log') as { r: number };
    list.push({ kind: 'box', x0: Math.min(ax, bx) - t.r, z0: Math.min(az, bz) - t.r, x1: Math.max(ax, bx) + t.r, z1: Math.max(az, bz) + t.r });
  }
  for (const [x, z] of FENCE_GATE_POSTS) list.push(footprintCollider(fp('fence.log'), x, z));
  for (const [x, z] of LIGHT_POLES) list.push(footprintCollider(fp('light.pole'), x, z));
  for (const [x, z] of GROUND_LANTERNS) list.push(footprintCollider(fp('lantern.ground'), x, z));
  for (const [x, z] of GLOBE_LAMPS) list.push(footprintCollider(fp('lamp.globe'), x, z));
  for (const [x0, z0, x1, z1] of HEDGES) list.push({ kind: 'box', x0, z0, x1, z1 });
  for (const [x, z, s] of ORCHARD) list.push(footprintCollider(fp('tree.fruit'), x, z, 0, s));
  for (const [x, z, s] of [...ROUND_TREES, ...BLOSSOM_TREES]) list.push(footprintCollider(fp('tree.round'), x, z, 0, s));
  for (const [x, z, s] of PINES) list.push(footprintCollider(fp('tree.pine'), x, z, 0, s));
  for (const [x, z, s] of PALMS) list.push(footprintCollider(fp('tree.palm'), x, z, 0, s));
  for (const [x, z] of BUSHES) list.push(footprintCollider(fp('bush.flower'), x, z));
  for (const [x, z, s] of ROCKS) list.push(footprintCollider(fp('rock'), x, z, 0, s));
  return list;
}

/** Pushes a circle of `radius` at (x, z) out of every collider it overlaps. */
export function resolve(x: number, z: number, colliders: readonly Collider[], season: SeasonId, radius = PLAYER_RADIUS): [number, number] {
  for (const c of colliders) {
    if (c.kind === 'circle') {
      if (c.onlyIn && c.onlyIn !== season) continue;
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + radius;
      if (d >= min) continue;
      if (d < 1e-6) x = c.x + min;
      else {
        x = c.x + (dx / d) * min;
        z = c.z + (dz / d) * min;
      }
    } else {
      const qx = Math.min(Math.max(x, c.x0), c.x1), qz = Math.min(Math.max(z, c.z0), c.z1);
      const dx = x - qx, dz = z - qz, d = Math.hypot(dx, dz);
      if (d >= radius) continue;
      if (d > 1e-6) {
        x = qx + (dx / d) * radius;
        z = qz + (dz / d) * radius;
      } else {
        // Inside the box: leave by the nearest side.
        const left = x - c.x0, right = c.x1 - x, back = z - c.z0, front = c.z1 - z, nearest = Math.min(left, right, back, front);
        if (nearest === left) x = c.x0 - radius;
        else if (nearest === right) x = c.x1 + radius;
        else if (nearest === back) z = c.z0 - radius;
        else z = c.z1 + radius;
      }
    }
  }
  return [x, z];
}

/**
 * One step of movement from (x, z) toward (tx, tz). Tries the full step, then sliding along x or z
 * (so the character glides along walls). Never ends in the sea, on a cliff edge, or up a cliff.
 */
export function step(x: number, z: number, tx: number, tz: number, colliders: readonly Collider[], season: SeasonId): { x: number; z: number; moved: boolean } {
  const from = walkableHeight(x, z);
  const ok = (nx: number, nz: number) => {
    const h = walkableHeight(nx, nz);
    if (h === null || (from !== null && Math.abs(h - from) > MAX_STEP)) return false;
    // Keep the body out of cliff walls: the ground one radius ahead must not rise like a wall.
    // Only the point ahead counts, so walking away from (or along) a wall is always allowed.
    const dx = nx - x, dz = nz - z, d = Math.hypot(dx, dz);
    if (d < 1e-6) return true;
    const ahead = groundHeight(nx + (dx / d) * PLAYER_RADIUS, nz + (dz / d) * PLAYER_RADIUS);
    return ahead === null || ahead - h <= MAX_STEP;
  };
  for (const [ax, az] of [[tx, tz], [tx, z], [x, tz]] as const) {
    const [nx, nz] = resolve(ax, az, colliders, season);
    if (ok(nx, nz)) return { x: nx, z: nz, moved: nx !== x || nz !== z };
  }
  return { x, z, moved: false };
}
