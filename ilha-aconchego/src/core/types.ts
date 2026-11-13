import type { FruitId } from '../data/defaults';
import type { WeatherId } from '../data/weather';

/** Position in the calendar plus the time of day. Plain data, safe to save and send over the network. */
export interface GameTime {
  year: number;
  /** 0 = spring, 1 = summer, 2 = autumn, 3 = winter. */
  seasonIndex: number;
  /** Day of the season, 1 to 28. */
  day: number;
  /** Minutes since midnight of the game day (06:00 = 360, 02:00 of the next morning = 1560). */
  minuteOfDay: number;
  /** True once the clock reaches 02:00; nothing advances until someone sleeps. */
  dayEnded: boolean;
}

/**
 * Who sends a command. The same roles are used by the multiplayer server (stage 7):
 * - system: the clock, the server, scripted events
 * - host: owner of the island
 * - resident: friend who lives on a shared island
 * - visitor: friend visiting by boat, with limited permissions
 */
export type Role = 'system' | 'host' | 'resident' | 'visitor';

export interface Actor {
  id: string;
  role: Role;
}

export interface PlayerState {
  id: string;
  name: string;
}

export interface IslandState {
  name: string;
  nativeFruit: FruitId;
}

/** The whole game state. Only `applyCommand` may change it. */
export interface GameState {
  /** Save format version, bumped when the shape changes. */
  version: number;
  /** Seed the island was created with. */
  seed: number;
  /** Current state of the deterministic random generator. */
  rng: number;
  time: GameTime;
  /** Weather of the current day. Rolled when a new day starts. */
  weather: WeatherId;
  island: IslandState;
  players: Record<string, PlayerState>;
}
