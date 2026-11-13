import { describe, expect, it } from 'vitest';
import { LEVELS, PIER } from '../data/map';
import { groundHeight, insideRoundedRect } from './terrain';

describe('groundHeight', () => {
  it('knows the main level, the upper level and the beach', () => {
    expect(groundHeight(0, 5)).toBe(LEVELS.main.top);
    expect(groundHeight(-10, -9.6)).toBe(LEVELS.upper.top);
    expect(groundHeight(0, 15)).toBe(LEVELS.beach.top);
  });

  it('blends along the ramp between the two levels', () => {
    const top = groundHeight(6.75, -6.49)!;
    const middle = groundHeight(6.75, -4.95)!;
    const bottom = groundHeight(6.75, -3.41)!;
    expect(top).toBeCloseTo(LEVELS.upper.top, 1);
    expect(middle).toBeGreaterThan(LEVELS.main.top);
    expect(middle).toBeLessThan(LEVELS.upper.top);
    expect(bottom).toBeCloseTo(LEVELS.main.top, 1);
  });

  it('steps down the stairs to the beach', () => {
    expect(groundHeight(10, 13.1)!).toBeLessThan(LEVELS.main.top);
    expect(groundHeight(10, 14.9)!).toBeCloseTo(LEVELS.beach.top, 1);
  });

  it('has the pier over the sea and nothing in open water', () => {
    expect(groundHeight(10, 20)).toBe(PIER.deck);
    expect(groundHeight(14, 21)).toBeNull();
    expect(groundHeight(30, 0)).toBeNull();
  });
});

describe('insideRoundedRect', () => {
  const rect = { x0: 0, z0: 0, x1: 10, z1: 10, r: 3 };
  it('cuts the rounded corners', () => {
    expect(insideRoundedRect(5, 5, rect)).toBe(true);
    expect(insideRoundedRect(0.2, 0.2, rect)).toBe(false);
    expect(insideRoundedRect(1.5, 1.5, rect)).toBe(true);
    expect(insideRoundedRect(9.8, 9.8, rect)).toBe(false);
  });
});
