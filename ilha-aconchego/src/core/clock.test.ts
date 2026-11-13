import { describe, expect, it, vi } from 'vitest';
import { DAY_END_MINUTE, DAY_START_MINUTE } from '../data/calendar';
import {
  ClockDriver,
  STEPS_PER_DAY,
  advanceSteps,
  createTime,
  formatClock,
  msPerStep,
  realTimeToMinuteOfDay,
  seasonOf,
  startNextDay,
  weekdayOf,
} from './clock';

describe('clock constants', () => {
  it('has 120 ten-minute steps between 06:00 and 02:00', () => {
    expect(STEPS_PER_DAY).toBe(120);
  });

  it('turns the day length option into real time per step', () => {
    expect(msPerStep(20)).toBe(10_000);
    expect(msPerStep(14)).toBe(7_000);
    expect(msPerStep(28)).toBe(14_000);
  });
});

describe('formatClock', () => {
  it('formats morning, afternoon and after midnight', () => {
    expect(formatClock(DAY_START_MINUTE)).toBe('06:00');
    expect(formatClock(13 * 60 + 20)).toBe('13:20');
    expect(formatClock(DAY_END_MINUTE)).toBe('02:00');
    expect(formatClock(24 * 60 + 50)).toBe('00:50');
  });
});

describe('advanceSteps', () => {
  it('moves 10 minutes per step', () => {
    const r = advanceSteps(createTime(), 3);
    expect(r.time.minuteOfDay).toBe(6 * 60 + 30);
    expect(r.stepsApplied).toBe(3);
    expect(r.reachedDayEnd).toBe(false);
  });

  it('stops exactly at 02:00 and marks the day as ended', () => {
    const late = { ...createTime(), minuteOfDay: DAY_END_MINUTE - 20 };
    const r = advanceSteps(late, 10);
    expect(r.time.minuteOfDay).toBe(DAY_END_MINUTE);
    expect(r.stepsApplied).toBe(2);
    expect(r.reachedDayEnd).toBe(true);
    expect(r.time.dayEnded).toBe(true);
  });

  it('does nothing after the day ended', () => {
    const ended = { ...createTime(), minuteOfDay: DAY_END_MINUTE, dayEnded: true };
    expect(advanceSteps(ended, 5).stepsApplied).toBe(0);
  });

  it('does not change the input', () => {
    const t0 = createTime();
    advanceSteps(t0, 5);
    expect(t0.minuteOfDay).toBe(DAY_START_MINUTE);
  });
});

describe('startNextDay', () => {
  it('starts the next day at 06:00', () => {
    const r = startNextDay({ ...createTime(), day: 5, minuteOfDay: 22 * 60 });
    expect(r.time).toMatchObject({ day: 6, minuteOfDay: DAY_START_MINUTE, dayEnded: false });
    expect(r.newSeason).toBe(false);
  });

  it('rolls from day 28 to the next season', () => {
    const r = startNextDay({ ...createTime(), day: 28 });
    expect(r.time).toMatchObject({ day: 1, seasonIndex: 1 });
    expect(seasonOf(r.time)).toBe('summer');
    expect(r.newSeason).toBe(true);
  });

  it('rolls from the end of winter to a new year', () => {
    const r = startNextDay({ ...createTime(), day: 28, seasonIndex: 3 });
    expect(r.time).toMatchObject({ year: 2, seasonIndex: 0, day: 1 });
    expect(r.newYear).toBe(true);
  });
});

describe('weekdayOf', () => {
  it('starts on Monday and day 12 of spring is a Friday', () => {
    expect(weekdayOf(createTime())).toBe('mon');
    expect(weekdayOf({ ...createTime(), day: 12 })).toBe('fri');
  });

  it('keeps counting across seasons (28 is a multiple of 7)', () => {
    expect(weekdayOf({ ...createTime(), seasonIndex: 1, day: 1 })).toBe('mon');
  });
});

describe('realTimeToMinuteOfDay', () => {
  it('rounds down to the 10-minute step', () => {
    expect(realTimeToMinuteOfDay(new Date(2026, 0, 1, 13, 27))).toBe(13 * 60 + 20);
  });

  it('treats the hours before 06:00 as the end of the previous game day', () => {
    expect(realTimeToMinuteOfDay(new Date(2026, 0, 1, 1, 5))).toBe(25 * 60);
  });
});

describe('ClockDriver', () => {
  it('reports whole steps and keeps the remainder', () => {
    const onAdvance = vi.fn();
    const driver = new ClockDriver({ dayLengthMin: 20, onAdvance, onSync: vi.fn() });
    driver.update(9_000);
    expect(onAdvance).not.toHaveBeenCalled();
    driver.update(2_000);
    expect(onAdvance).toHaveBeenCalledWith(1);
    driver.update(19_000);
    expect(onAdvance).toHaveBeenLastCalledWith(2);
  });

  it('does nothing while paused', () => {
    const onAdvance = vi.fn();
    const driver = new ClockDriver({ dayLengthMin: 20, onAdvance, onSync: vi.fn() });
    driver.setPaused(true);
    driver.update(60_000);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('follows the device clock in real mode', () => {
    const onSync = vi.fn();
    const driver = new ClockDriver({ dayLengthMin: 20, mode: 'real', onAdvance: vi.fn(), onSync, now: () => new Date(2026, 0, 1, 9, 41) });
    driver.update(16);
    expect(onSync).toHaveBeenCalledWith(9 * 60 + 40);
  });
});
