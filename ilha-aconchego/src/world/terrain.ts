import { LEVELS, PIER, RAMP, STAIRS, type RoundedRect } from '../data/map';
import { BRIDGES, ISLETS } from '../data/village';

/** True if (x, z) is inside the rounded rectangle, with an optional inward margin. */
export function insideRoundedRect(x: number, z: number, rect: RoundedRect, margin = 0): boolean {
  const x0 = rect.x0 + margin, x1 = rect.x1 - margin, z0 = rect.z0 + margin, z1 = rect.z1 - margin;
  if (x < x0 || x > x1 || z < z0 || z > z1) return false;
  // Corner radii: back-left, back-right, front-right, front-left.
  const [bl, br, fr, fl] = typeof rect.r === 'number' ? [rect.r, rect.r, rect.r, rect.r] : rect.r;
  const outsideCorner = (cx: number, cz: number, r: number, inX: boolean, inZ: boolean) => inX && inZ && Math.hypot(x - cx, z - cz) > r;
  if (outsideCorner(x0 + bl, z0 + bl, bl, x < x0 + bl, z < z0 + bl)) return false;
  if (outsideCorner(x1 - br, z0 + br, br, x > x1 - br, z < z0 + br)) return false;
  if (outsideCorner(x1 - fr, z1 - fr, fr, x > x1 - fr, z > z1 - fr)) return false;
  if (outsideCorner(x0 + fl, z1 - fl, fl, x < x0 + fl, z > z1 - fl)) return false;
  return true;
}

/**
 * Height of the walkable ground at (x, z), or null over open sea.
 * Upper level 2.8, main level 1.4, beach 0.35, pier deck 0.62; ramp and stairs blend between levels.
 */
export function groundHeight(x: number, z: number): number | null {
  if (x > STAIRS.x0 && x < STAIRS.x1 && z >= STAIRS.z0 && z <= STAIRS.z1) {
    return LEVELS.main.top - ((z - STAIRS.z0) / (STAIRS.z1 - STAIRS.z0)) * (LEVELS.main.top - LEVELS.beach.top);
  }
  if (insideRoundedRect(x, z, LEVELS.main)) {
    if (z < LEVELS.upper.z1) return LEVELS.upper.top;
    if (x > RAMP.x0 && x < RAMP.x1 && z < RAMP.zBottom) {
      return LEVELS.main.top + ((RAMP.zBottom - z) / (RAMP.zBottom - RAMP.zTop)) * (LEVELS.upper.top - LEVELS.main.top);
    }
    return LEVELS.main.top;
  }
  if (x > PIER.x0 && x < PIER.x1 && z > PIER.z0 && z < PIER.z1) return PIER.deck;
  for (const b of BRIDGES) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return b.deck;
  if (insideRoundedRect(x, z, LEVELS.beach)) return LEVELS.beach.top;
  // The village islet and the wood (stage 4).
  for (const islet of ISLETS) {
    if (insideRoundedRect(x, z, islet.main)) return islet.main.top;
    if (insideRoundedRect(x, z, islet.beach)) return islet.beach.top;
  }
  return null;
}

/** Like groundHeight, but returns sea level instead of null. Handy for placing objects. */
export function heightAt(x: number, z: number): number {
  return groundHeight(x, z) ?? 0.12;
}
