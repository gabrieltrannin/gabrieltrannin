/**
 * Calendar and clock constants from docs/GAME_DESIGN.md ("Tempo e calendário").
 * Pure data: no logic lives here.
 */

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type SeasonId = (typeof SEASONS)[number];

export const DAYS_PER_SEASON = 28;
export const DAYS_PER_WEEK = 7;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;

/** Minutes since midnight of the game day. The day runs from 06:00 to 02:00 of the next morning. */
export const DAY_START_MINUTE = 6 * 60;
export const DAY_END_MINUTE = 26 * 60;
/** The clock moves in 10-minute steps. */
export const TIME_STEP_MINUTES = 10;

/** Real minutes that one game day lasts (option in the "Jogo" settings tab). */
export const DAY_LENGTH_OPTIONS_MIN = [14, 20, 28] as const;
export type DayLengthMin = (typeof DAY_LENGTH_OPTIONS_MIN)[number];
export const DEFAULT_DAY_LENGTH_MIN: DayLengthMin = 20;

/** Weekday 0 is Monday; day 1 of spring, year 1 is a Monday. */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayId = (typeof WEEKDAYS)[number];

export type FestivalId = 'flowers' | 'lanterns' | 'harvest' | 'snow';

export interface Festival {
  id: FestivalId;
  season: SeasonId;
  /** Day of the season. `null` means the design document has not fixed the day yet (stage 6). */
  day: number | null;
}

export const FESTIVALS: readonly Festival[] = [
  { id: 'flowers', season: 'spring', day: 13 },
  { id: 'lanterns', season: 'summer', day: null },
  { id: 'harvest', season: 'autumn', day: null },
  { id: 'snow', season: 'winter', day: null },
];
