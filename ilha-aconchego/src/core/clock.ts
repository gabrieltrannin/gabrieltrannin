import {
  DAY_END_MINUTE,
  DAY_START_MINUTE,
  DAYS_PER_SEASON,
  DAYS_PER_WEEK,
  DAYS_PER_YEAR,
  SEASONS,
  TIME_STEP_MINUTES,
  WEEKDAYS,
  type SeasonId,
  type WeekdayId,
} from '../data/calendar';
import type { GameTime } from './types';

/** Number of 10-minute steps between 06:00 and 02:00 (120). */
export const STEPS_PER_DAY = (DAY_END_MINUTE - DAY_START_MINUTE) / TIME_STEP_MINUTES;

/** Real milliseconds per 10-minute step for a day that lasts `dayLengthMin` real minutes. */
export function msPerStep(dayLengthMin: number): number {
  return (dayLengthMin * 60_000) / STEPS_PER_DAY;
}

export function createTime(): GameTime {
  return { year: 1, seasonIndex: 0, day: 1, minuteOfDay: DAY_START_MINUTE, dayEnded: false };
}

export function seasonOf(time: GameTime): SeasonId {
  return SEASONS[time.seasonIndex] ?? 'spring';
}

/** Days elapsed since day 1 of spring, year 1. */
export function absoluteDay(time: GameTime): number {
  return (time.year - 1) * DAYS_PER_YEAR + time.seasonIndex * DAYS_PER_SEASON + (time.day - 1);
}

export function weekdayOf(time: GameTime): WeekdayId {
  return WEEKDAYS[absoluteDay(time) % DAYS_PER_WEEK] ?? 'mon';
}

/** "HH:MM" for a minute of the game day (1560 becomes "02:00"). */
export function formatClock(minuteOfDay: number): string {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface AdvanceResult {
  time: GameTime;
  stepsApplied: number;
  /** True when this advance reached 02:00. */
  reachedDayEnd: boolean;
}

/** Moves the clock forward by whole 10-minute steps, stopping at 02:00. Pure. */
export function advanceSteps(time: GameTime, steps: number): AdvanceResult {
  if (time.dayEnded || steps <= 0) return { time: { ...time }, stepsApplied: 0, reachedDayEnd: false };
  const remaining = (DAY_END_MINUTE - time.minuteOfDay) / TIME_STEP_MINUTES;
  const applied = Math.max(0, Math.min(steps, remaining));
  const minuteOfDay = time.minuteOfDay + applied * TIME_STEP_MINUTES;
  const reachedDayEnd = minuteOfDay >= DAY_END_MINUTE;
  return { time: { ...time, minuteOfDay, dayEnded: reachedDayEnd }, stepsApplied: applied, reachedDayEnd };
}

export interface NextDayResult {
  time: GameTime;
  newSeason: boolean;
  newYear: boolean;
}

/** Wakes up the next morning at 06:00, rolling over season and year. Pure. */
export function startNextDay(time: GameTime): NextDayResult {
  let { day, seasonIndex, year } = time;
  let newSeason = false;
  let newYear = false;
  day += 1;
  if (day > DAYS_PER_SEASON) {
    day = 1;
    seasonIndex += 1;
    newSeason = true;
    if (seasonIndex >= SEASONS.length) {
      seasonIndex = 0;
      year += 1;
      newYear = true;
    }
  }
  return { time: { year, seasonIndex, day, minuteOfDay: DAY_START_MINUTE, dayEnded: false }, newSeason, newYear };
}

/**
 * Maps the device clock to a game minute for the "Horário real" option.
 * Rounds down to the 10-minute step. Hours before 06:00 count as the end of the previous
 * game day (00:00 to 05:59 become 24:00 to 29:50), so the night does not jump back to morning.
 */
export function realTimeToMinuteOfDay(date: Date): number {
  const h = date.getHours();
  const m = Math.floor(date.getMinutes() / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
  return (h < 6 ? h + 24 : h) * 60 + m;
}

export type ClockMode = 'game' | 'real';

export interface ClockDriverOptions {
  dayLengthMin: number;
  mode?: ClockMode;
  /** Called with the number of 10-minute steps to advance ("game" mode). */
  onAdvance: (steps: number) => void;
  /** Called with the device time mapped to a game minute ("real" mode). */
  onSync: (minuteOfDay: number) => void;
  /** Injectable for tests. */
  now?: () => Date;
}

/**
 * Turns real elapsed time into clock commands. It holds no game state: the game decides what to do
 * with each callback (on the multiplayer server only the server runs a driver).
 */
export class ClockDriver {
  private acc = 0;
  private syncAcc = Infinity;
  private paused = false;
  private dayLengthMin: number;
  private mode: ClockMode;

  constructor(private readonly opts: ClockDriverOptions) {
    this.dayLengthMin = opts.dayLengthMin;
    this.mode = opts.mode ?? 'game';
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setDayLength(dayLengthMin: number): void {
    this.dayLengthMin = dayLengthMin;
  }

  setMode(mode: ClockMode): void {
    this.mode = mode;
    this.acc = 0;
    this.syncAcc = Infinity;
  }

  update(dtMs: number): void {
    if (this.paused || !(dtMs > 0)) return;
    if (this.mode === 'real') {
      this.syncAcc += dtMs;
      if (this.syncAcc >= 1000) {
        this.syncAcc = 0;
        this.opts.onSync(realTimeToMinuteOfDay((this.opts.now ?? (() => new Date()))()));
      }
      return;
    }
    this.acc += dtMs;
    const per = msPerStep(this.dayLengthMin);
    if (this.acc >= per) {
      const steps = Math.floor(this.acc / per);
      this.acc -= steps * per;
      this.opts.onAdvance(steps);
    }
  }
}
