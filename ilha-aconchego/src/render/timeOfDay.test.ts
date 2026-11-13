import { describe, expect, it } from 'vitest';
import { keysAround, sampleLight } from './timeOfDay';

describe('sampleLight', () => {
  it('keeps the lamps off in the afternoon and on at night', () => {
    expect(sampleLight(13 * 60, 'sun').lamps).toBe(0);
    expect(sampleLight(22 * 60, 'sun').lamps).toBe(1);
    const dusk = sampleLight(19 * 60, 'sun').lamps;
    expect(dusk).toBeGreaterThan(0.5);
    expect(dusk).toBeLessThan(1);
  });

  it('is darker at night than at noon', () => {
    expect(sampleLight(23 * 60, 'sun').sunIntensity).toBeLessThan(sampleLight(13 * 60, 'sun').sunIntensity);
    expect(sampleLight(23 * 60, 'sun').night).toBe(1);
  });

  it('rain dims the sun, turns the lamps on a little and hides the stars', () => {
    const sun = sampleLight(13 * 60, 'sun');
    const rain = sampleLight(13 * 60, 'rain');
    expect(rain.sunIntensity).toBeLessThan(sun.sunIntensity);
    expect(rain.lamps).toBeGreaterThan(0);
    expect(sampleLight(23 * 60, 'rain').night).toBeLessThan(0.2);
  });

  it('treats the small hours before 06:00 as night (real-time clock)', () => {
    const [, end, f] = keysAround(3 * 60);
    expect(end.minute).toBe(26 * 60);
    expect(f).toBe(1);
    expect(sampleLight(3 * 60, 'sun').night).toBe(1);
    expect(sampleLight(27 * 60, 'sun').lamps).toBe(1);
  });

  it('returns a normalized sun direction', () => {
    expect(sampleLight(10 * 60, 'sun').sunDir.length()).toBeCloseTo(1, 5);
  });
});
