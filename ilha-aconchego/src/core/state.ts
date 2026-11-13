import { DEFAULT_ISLAND, DEFAULT_PLAYER, DEFAULT_SEED, type FruitId } from '../data/defaults';
import { FIRST_DAY_WEATHER } from '../data/weather';
import { createTime } from './clock';
import type { GameState } from './types';

export const SAVE_VERSION = 1;

export interface NewIslandOptions {
  seed?: number;
  islandName?: string;
  nativeFruit?: FruitId;
  playerId?: string;
  playerName?: string;
}

export function createInitialState(opts: NewIslandOptions = {}): GameState {
  const seed = opts.seed ?? DEFAULT_SEED;
  const playerId = opts.playerId ?? DEFAULT_PLAYER.id;
  return {
    version: SAVE_VERSION,
    seed,
    rng: seed,
    time: createTime(),
    weather: FIRST_DAY_WEATHER,
    island: {
      name: opts.islandName ?? DEFAULT_ISLAND.name,
      nativeFruit: opts.nativeFruit ?? DEFAULT_ISLAND.nativeFruit,
    },
    players: {
      [playerId]: { id: playerId, name: opts.playerName ?? DEFAULT_PLAYER.name },
    },
  };
}
