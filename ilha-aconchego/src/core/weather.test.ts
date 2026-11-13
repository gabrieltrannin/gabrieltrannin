import { describe, expect, it } from 'vitest';
import { SEASONS } from '../data/calendar';
import { WEATHER_WEIGHTS } from '../data/weather';
import { applyCommand, type Command } from './commands';
import { SYSTEM } from './game';
import { createInitialState } from './state';
import type { Actor } from './types';
import { rollWeather } from './weather';

const host: Actor = { id: 'local', role: 'host' };

function rollMany(season: (typeof SEASONS)[number], n: number) {
  const seen = new Set<string>();
  let rng = 1;
  for (let i = 0; i < n; i++) {
    const r = rollWeather(rng, season);
    seen.add(r.weather);
    rng = r.rng;
  }
  return seen;
}

describe('rollWeather', () => {
  it('only rolls weathers that have weight in the season', () => {
    for (const season of SEASONS) {
      for (const w of rollMany(season, 400)) expect(WEATHER_WEIGHTS[season][w as 'sun']).toBeGreaterThan(0);
    }
  });

  it('snows only in winter', () => {
    expect(rollMany('winter', 400).has('snow')).toBe(true);
    for (const season of ['spring', 'summer', 'autumn'] as const) expect(rollMany(season, 400).has('snow')).toBe(false);
  });

  it('is deterministic for the same generator state', () => {
    expect(rollWeather(99, 'spring')).toEqual(rollWeather(99, 'spring'));
  });
});

describe('weather and date commands', () => {
  it('a new island starts sunny', () => {
    expect(createInitialState().weather).toBe('sun');
  });

  it('sleep rolls the weather and moves the generator forward', () => {
    const state = createInitialState({ seed: 5 });
    const r = applyCommand(state, { type: 'sleep' }, host);
    expect(r.ok && r.events[0]).toMatchObject({ type: 'day.started', weather: state.weather });
    expect(state.rng).not.toBe(5);
  });

  it('weather.set is system-only and checks the value', () => {
    const state = createInitialState();
    expect(applyCommand(state, { type: 'weather.set', weather: 'rain' }, host)).toEqual({ ok: false, error: 'forbidden' });
    expect(applyCommand(state, { type: 'weather.set', weather: 'hail' } as unknown as Command, SYSTEM)).toEqual({ ok: false, error: 'invalid' });
    const r = applyCommand(state, { type: 'weather.set', weather: 'storm' }, SYSTEM);
    expect(r).toEqual({ ok: true, events: [{ type: 'weather.changed', weather: 'storm' }] });
    expect(state.weather).toBe('storm');
  });

  it('time.setDate jumps to a season and day but keeps the time of day', () => {
    const state = createInitialState();
    state.time.minuteOfDay = 15 * 60;
    expect(applyCommand(state, { type: 'time.setDate', seasonIndex: 4, day: 1 }, SYSTEM)).toEqual({ ok: false, error: 'invalid' });
    expect(applyCommand(state, { type: 'time.setDate', seasonIndex: 3, day: 29 }, SYSTEM)).toEqual({ ok: false, error: 'invalid' });
    expect(applyCommand(state, { type: 'time.setDate', seasonIndex: 3, day: 10 }, SYSTEM).ok).toBe(true);
    expect(state.time).toMatchObject({ seasonIndex: 3, day: 10, minuteOfDay: 15 * 60 });
  });
});
