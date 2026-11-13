import { describe, expect, it } from 'vitest';
import { HOUSE, LEVELS, PIER, PLAYER_START, RAMP, STAIRS } from '../data/map';
import { buildColliders, PLAYER_RADIUS, resolve, step, walkableHeight, type Collider } from './collision';

const colliders = buildColliders();

/** Walks in a straight line in small steps, like the game loop does, and returns where it ended. */
function walk(from: [number, number], to: [number, number], stepSize = 0.12, max = 2000) {
  let [x, z] = from;
  for (let i = 0; i < max; i++) {
    const dx = to[0] - x, dz = to[1] - z, d = Math.hypot(dx, dz);
    if (d < stepSize) break;
    const r = step(x, z, x + (dx / d) * stepSize, z + (dz / d) * stepSize, colliders, 'spring');
    if (!r.moved) break;
    [x, z] = [r.x, r.z];
  }
  return { x, z, h: walkableHeight(x, z) };
}

describe('walkableHeight', () => {
  it('is defined on land, the beach and the pier, and null at sea', () => {
    expect(walkableHeight(PLAYER_START.x, PLAYER_START.z)).toBe(LEVELS.main.top);
    expect(walkableHeight(-6.8, -9)).toBe(LEVELS.upper.top);
    expect(walkableHeight(0, 15.5)).toBe(LEVELS.beach.top);
    expect(walkableHeight(10, 20)).toBe(PIER.deck);
    expect(walkableHeight(25, 0)).toBeNull();
  });

  it('keeps a margin from the cliff edge', () => {
    expect(walkableHeight(LEVELS.main.x1 - 0.1, 0)).toBeNull();
  });
});

describe('resolve', () => {
  const circle: Collider[] = [{ kind: 'circle', x: 0, z: 0, r: 1 }];
  const box: Collider[] = [{ kind: 'box', x0: -1, z0: -1, x1: 1, z1: 1 }];
  it('pushes out of circles and boxes', () => {
    const [cx, cz] = resolve(0.5, 0, circle, 'spring');
    expect(Math.hypot(cx, cz)).toBeCloseTo(1 + PLAYER_RADIUS);
    const [bx] = resolve(1.1, 0, box, 'spring');
    expect(bx).toBeCloseTo(1 + PLAYER_RADIUS);
  });

  it('ignores colliders that only exist in another season', () => {
    expect(resolve(0.5, 0, [{ kind: 'circle', x: 0, z: 0, r: 1, onlyIn: 'winter' }], 'spring')).toEqual([0.5, 0]);
  });
});

describe('walking around the island', () => {
  it('cannot walk through the house', () => {
    const end = walk([HOUSE.x, HOUSE.z + 4], [HOUSE.x, HOUSE.z]);
    expect(Math.hypot(end.x - HOUSE.x, end.z - HOUSE.z)).toBeGreaterThan(2.2);
  });

  it('cannot climb the cliff to the upper level away from the ramp', () => {
    const end = walk([-10, -4.5], [-10, -9]);
    expect(end.h).toBe(LEVELS.main.top);
    expect(end.z).toBeGreaterThan(LEVELS.upper.z1 - 0.05);
  });

  it('keeps the body out of the cliff wall, but can walk away from it', () => {
    const end = walk([-10, -4.5], [-10, -9]);
    expect(end.z).toBeGreaterThanOrEqual(LEVELS.upper.z1 + PLAYER_RADIUS - 0.13);
    expect(step(end.x, end.z, end.x, end.z + 0.1, colliders, 'spring').moved).toBe(true);
    expect(step(end.x, end.z, end.x + 0.1, end.z, colliders, 'spring').moved).toBe(true);
  });

  it('goes up the ramp to the upper level', () => {
    const x = (RAMP.x0 + RAMP.x1) / 2;
    const end = walk([x, RAMP.zBottom + 1], [x, RAMP.zTop - 1.5]);
    expect(end.h).toBe(LEVELS.upper.top);
  });

  it('goes down the stairs to the beach and onto the pier', () => {
    const x = (STAIRS.x0 + STAIRS.x1) / 2;
    const beach = walk([x, STAIRS.z0 - 2], [x - 1.5, STAIRS.z1 + 0.15]);
    expect(beach.h).toBe(LEVELS.beach.top);
    const pier = walk([beach.x, beach.z], [x, 21]);
    expect(pier.h).toBe(PIER.deck);
  });

  it('cannot jump off the main level straight onto the beach or into the sea', () => {
    const edge = walk([0, 10], [0, 16]);
    expect(edge.h).toBe(LEVELS.main.top);
    const sea = walk([0, 15.5], [0, 25]);
    expect(sea.h).toBe(LEVELS.beach.top);
  });

  it('cannot walk off the side of the pier', () => {
    const end = walk([10, 19], [14, 19]);
    expect(end.h).toBe(PIER.deck);
    expect(end.x).toBeLessThan(PIER.x1);
  });
});
