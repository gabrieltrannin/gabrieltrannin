import { describe, expect, it } from 'vitest';
import { DAY_END_MINUTE, DAY_START_MINUTE } from '../data/calendar';
import { applyCommand, type Command } from './commands';
import { Game, SYSTEM } from './game';
import { createInitialState } from './state';
import type { Actor } from './types';

const host: Actor = { id: 'local', role: 'host' };
const visitor: Actor = { id: 'theo', role: 'visitor' };

describe('applyCommand', () => {
  it('rejects unknown commands, including prototype keys', () => {
    const state = createInitialState();
    expect(applyCommand(state, { type: 'fly' } as unknown as Command, host)).toEqual({ ok: false, error: 'unknown_command' });
    expect(applyCommand(state, { type: 'toString' } as unknown as Command, host)).toEqual({ ok: false, error: 'unknown_command' });
    expect(applyCommand(state, null as unknown as Command, host)).toEqual({ ok: false, error: 'unknown_command' });
  });

  it('only lets the system move the clock', () => {
    const state = createInitialState();
    expect(applyCommand(state, { type: 'time.advance', steps: 1 }, host)).toEqual({ ok: false, error: 'forbidden' });
    expect(state.time.minuteOfDay).toBe(DAY_START_MINUTE);
  });

  it('advances time and reports it', () => {
    const state = createInitialState();
    const r = applyCommand(state, { type: 'time.advance', steps: 6 }, SYSTEM);
    expect(r.ok).toBe(true);
    expect(state.time.minuteOfDay).toBe(7 * 60);
    expect(r.ok && r.events.map(e => e.type)).toEqual(['time.changed']);
  });

  it('rejects invalid step counts without touching the state', () => {
    const state = createInitialState();
    const before = structuredClone(state);
    for (const steps of [0, -1, 1.5, 999, Number.NaN]) {
      expect(applyCommand(state, { type: 'time.advance', steps }, SYSTEM)).toEqual({ ok: false, error: 'invalid' });
    }
    expect(applyCommand(state, { type: 'time.advance', steps: '3' } as unknown as Command, SYSTEM)).toEqual({ ok: false, error: 'invalid' });
    expect(state).toEqual(before);
  });

  it('emits day.ended at 02:00 and then refuses to advance', () => {
    const state = createInitialState();
    state.time.minuteOfDay = DAY_END_MINUTE - 10;
    const r = applyCommand(state, { type: 'time.advance', steps: 3 }, SYSTEM);
    expect(r.ok && r.events.map(e => e.type)).toEqual(['time.changed', 'day.ended']);
    expect(applyCommand(state, { type: 'time.advance', steps: 1 }, SYSTEM)).toEqual({ ok: false, error: 'day_ended' });
  });

  it('sleep starts the next day for residents but not for visitors', () => {
    const state = createInitialState();
    state.time.minuteOfDay = 23 * 60;
    expect(applyCommand(state, { type: 'sleep' }, visitor)).toEqual({ ok: false, error: 'forbidden' });
    const r = applyCommand(state, { type: 'sleep' }, host);
    expect(r.ok).toBe(true);
    expect(state.time).toMatchObject({ day: 2, minuteOfDay: DAY_START_MINUTE, dayEnded: false });
  });

  it('sleep after the day ended unlocks the clock again', () => {
    const state = createInitialState();
    state.time = { ...state.time, minuteOfDay: DAY_END_MINUTE, dayEnded: true };
    applyCommand(state, { type: 'sleep' }, host);
    expect(applyCommand(state, { type: 'time.advance', steps: 1 }, SYSTEM).ok).toBe(true);
  });

  it('time.sync only accepts whole 10-minute steps', () => {
    const state = createInitialState();
    expect(applyCommand(state, { type: 'time.sync', minuteOfDay: 9 * 60 + 5 }, SYSTEM)).toEqual({ ok: false, error: 'invalid' });
    expect(applyCommand(state, { type: 'time.sync', minuteOfDay: 9 * 60 + 40 }, SYSTEM).ok).toBe(true);
    expect(state.time.minuteOfDay).toBe(9 * 60 + 40);
  });

  it('is deterministic: the same commands give the same state', () => {
    const run = () => {
      const s = createInitialState({ seed: 42 });
      const cmds: Command[] = [{ type: 'time.advance', steps: 50 }, { type: 'sleep' }, { type: 'time.advance', steps: 7 }];
      for (const c of cmds) applyCommand(s, c, c.type === 'sleep' ? host : SYSTEM);
      return s;
    };
    expect(run()).toEqual(run());
  });
});

describe('Game', () => {
  it('notifies listeners only after successful commands', () => {
    const game = new Game();
    const seen: string[] = [];
    const off = game.on(e => seen.push(e.type));
    game.dispatch({ type: 'time.advance', steps: 1 }, host);
    game.dispatch({ type: 'time.advance', steps: 1 }, SYSTEM);
    game.dispatch({ type: 'sleep' }, host);
    off();
    game.dispatch({ type: 'sleep' }, host);
    expect(seen).toEqual(['time.changed', 'day.started']);
  });
});
