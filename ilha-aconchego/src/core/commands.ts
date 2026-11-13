import { DAYS_PER_SEASON, SEASONS, TIME_STEP_MINUTES } from '../data/calendar';
import type { WeatherId } from '../data/weather';
import { STEPS_PER_DAY, advanceSteps, seasonOf, startNextDay } from './clock';
import type { Actor, GameState, GameTime, Role } from './types';
import { isWeatherId, rollWeather } from './weather';

/**
 * Every change to the game goes through one of these commands.
 * The multiplayer server (stage 7) will run this same file, so commands must be plain JSON.
 */
export type Command =
  /** System only: the clock moved forward by whole 10-minute steps. */
  | { type: 'time.advance'; steps: number }
  /** System only: set the time of day directly ("Horário real" option, server sync, test panel). */
  | { type: 'time.sync'; minuteOfDay: number }
  /** System only: jump to a season and day (test panel, server sync). Keeps the time of day. */
  | { type: 'time.setDate'; seasonIndex: number; day: number }
  /** System only: change today's weather (test panel, server sync). */
  | { type: 'weather.set'; weather: WeatherId }
  /** A player goes to bed: the next day starts at 06:00 with newly rolled weather. */
  | { type: 'sleep' };

export type CommandType = Command['type'];

export type GameEvent =
  | { type: 'time.changed'; time: GameTime }
  | { type: 'day.ended'; time: GameTime }
  | { type: 'day.started'; time: GameTime; newSeason: boolean; newYear: boolean; weather: WeatherId }
  | { type: 'date.changed'; time: GameTime }
  | { type: 'weather.changed'; weather: WeatherId };

export type CommandError = 'unknown_command' | 'forbidden' | 'invalid' | 'day_ended';

export type CommandResult = { ok: true; events: GameEvent[] } | { ok: false; error: CommandError };

interface Handler<C extends Command> {
  /** Roles allowed to send this command. */
  roles: readonly Role[];
  /** Must not change the state. Returns an error code or null. */
  validate(state: Readonly<GameState>, cmd: C, actor: Actor): CommandError | null;
  /** Changes the state in place and returns what happened. Only called after `validate` passed. */
  apply(state: GameState, cmd: C, actor: Actor): GameEvent[];
}

type HandlerMap = { [K in CommandType]: Handler<Extract<Command, { type: K }>> };

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

const handlers: HandlerMap = {
  'time.advance': {
    roles: ['system'],
    validate(state, cmd) {
      if (!isInt(cmd.steps) || cmd.steps < 1 || cmd.steps > STEPS_PER_DAY) return 'invalid';
      if (state.time.dayEnded) return 'day_ended';
      return null;
    },
    apply(state, cmd) {
      const r = advanceSteps(state.time, cmd.steps);
      state.time = r.time;
      const events: GameEvent[] = [{ type: 'time.changed', time: { ...state.time } }];
      if (r.reachedDayEnd) events.push({ type: 'day.ended', time: { ...state.time } });
      return events;
    },
  },

  'time.sync': {
    roles: ['system'],
    validate(_state, cmd) {
      if (!isInt(cmd.minuteOfDay) || cmd.minuteOfDay < 0 || cmd.minuteOfDay >= 30 * 60) return 'invalid';
      if (cmd.minuteOfDay % TIME_STEP_MINUTES !== 0) return 'invalid';
      return null;
    },
    apply(state, cmd) {
      state.time = { ...state.time, minuteOfDay: cmd.minuteOfDay, dayEnded: false };
      return [{ type: 'time.changed', time: { ...state.time } }];
    },
  },

  'time.setDate': {
    roles: ['system'],
    validate(_state, cmd) {
      if (!isInt(cmd.seasonIndex) || cmd.seasonIndex < 0 || cmd.seasonIndex >= SEASONS.length) return 'invalid';
      if (!isInt(cmd.day) || cmd.day < 1 || cmd.day > DAYS_PER_SEASON) return 'invalid';
      return null;
    },
    apply(state, cmd) {
      state.time = { ...state.time, seasonIndex: cmd.seasonIndex, day: cmd.day };
      return [{ type: 'date.changed', time: { ...state.time } }];
    },
  },

  'weather.set': {
    roles: ['system'],
    validate(_state, cmd) {
      return isWeatherId(cmd.weather) ? null : 'invalid';
    },
    apply(state, cmd) {
      state.weather = cmd.weather;
      return [{ type: 'weather.changed', weather: state.weather }];
    },
  },

  sleep: {
    // Visitors sleep at home, on their own island.
    roles: ['host', 'resident'],
    validate() {
      return null;
    },
    apply(state) {
      const r = startNextDay(state.time);
      state.time = r.time;
      const w = rollWeather(state.rng, seasonOf(state.time));
      state.rng = w.rng;
      state.weather = w.weather;
      return [{ type: 'day.started', time: { ...state.time }, newSeason: r.newSeason, newYear: r.newYear, weather: state.weather }];
    },
  },
};

/**
 * The single entry point that validates and applies a command.
 * Validation never touches the state; if it fails the state is exactly as before.
 * Commands may come from the network, so the shape is checked here too.
 */
export function applyCommand(state: GameState, cmd: Command, actor: Actor): CommandResult {
  const type = (cmd as { type?: unknown } | null)?.type;
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(handlers, type)) {
    return { ok: false, error: 'unknown_command' };
  }
  const handler = handlers[type as CommandType] as unknown as Handler<Command>;
  if (!handler.roles.includes(actor.role)) return { ok: false, error: 'forbidden' };
  const error = handler.validate(state, cmd, actor);
  if (error) return { ok: false, error };
  return { ok: true, events: handler.apply(state, cmd, actor) };
}
