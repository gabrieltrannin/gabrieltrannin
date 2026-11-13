import { DEFAULT_APPEARANCE, type Appearance } from '../data/appearance';
import { DEFAULT_ISLAND, DEFAULT_PLAYER, DEFAULT_SEED, type FruitId } from '../data/defaults';
import { MAX_ENERGY, STARTING_COINS, STARTING_INVENTORY } from '../data/items';
import { PLAYER_START } from '../data/map';
import { FIRST_DAY_WEATHER } from '../data/weather';
import { createTime } from './clock';
import { createInventory } from './inventory';
import type { GameState, PlayerState } from './types';

/** Bumped whenever the shape of GameState changes; older saves are not loaded. */
export const SAVE_VERSION = 2;

export interface NewIslandOptions {
  seed?: number;
  islandName?: string;
  nativeFruit?: FruitId;
  playerId?: string;
  playerName?: string;
  appearance?: Appearance;
}

export function createPlayer(id: string, name: string, appearance: Appearance = DEFAULT_APPEARANCE): PlayerState {
  return {
    id,
    name,
    appearance: { ...appearance },
    position: { ...PLAYER_START },
    coins: STARTING_COINS,
    energy: MAX_ENERGY,
    inventory: createInventory(STARTING_INVENTORY),
    activeSlot: 0,
  };
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
    players: { [playerId]: createPlayer(playerId, opts.playerName ?? DEFAULT_PLAYER.name, opts.appearance) },
    quests: [{ id: 'tour', visited: [], done: false }],
    trees: {},
  };
}
