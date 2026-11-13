import { STARTING_ANIMALS } from '../data/animals';
import { DEFAULT_APPEARANCE, type Appearance } from '../data/appearance';
import { DEFAULT_ISLAND, DEFAULT_PLAYER, DEFAULT_SEED, type FruitId } from '../data/defaults';
import { MAX_ENERGY, STARTING_COINS, STARTING_INVENTORY } from '../data/items';
import { FARM_TILES, MINE_NODES, PLAYER_START } from '../data/map';
import { SKILLS, type SkillId } from '../data/skills';
import { TOOLS, type ToolId } from '../data/tools';
import { FIRST_DAY_WEATHER } from '../data/weather';
import { createTime, seasonOf, startNextDay } from './clock';
import { createInventory } from './inventory';
import { emptyPlot } from './rules';
import type { AnimalState, GameState, OreId, PlayerState } from './types';

/** What the rocks hold on the first day: mostly stone and copper, one silver. */
const STARTING_ORES: readonly OreId[] = ['copper', 'stone', 'copper', 'stone', 'silver', 'stone', 'copper', 'stone'];
import { rollWeather } from './weather';

/** Bumped whenever the shape of GameState changes; older saves are not loaded. */
export const SAVE_VERSION = 3;

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
    ...newPlayerProgress(),
  };
}

/** Tool levels, skills and the rest added in stage 3 (also used to bring older saves up to date). */
export function newPlayerProgress(): Pick<PlayerState, 'toolLevels' | 'skills' | 'buff' | 'fishing'> {
  return {
    toolLevels: Object.fromEntries(TOOLS.map(t => [t, 1])) as Record<ToolId, number>,
    skills: Object.fromEntries(SKILLS.map(k => [k, 0])) as Record<SkillId, number>,
    buff: null,
    fishing: null,
  };
}

export const startingAnimals = (): AnimalState[] =>
  STARTING_ANIMALS.map(a => ({ ...a, friendship: 0, fedToday: false, pettedToday: false, ready: false, lastProduct: -1 }));

/** Farm, animals, rocks and the other stage 3 parts of a fresh island; `rng` rolls the first forecast. */
export function newIslandProgress(time: GameState['time'], rng: number): Pick<GameState, 'forecast' | 'plots' | 'animals' | 'machines' | 'nodes' | 'stumps' | 'grass' | 'hives' | 'shipping' | 'greenhouse' | 'rng'> {
  const w = rollWeather(rng, seasonOf(startNextDay(time).time));
  return {
    rng: w.rng,
    forecast: w.weather,
    // The first bed comes already tilled, so the first seeds can go in right away.
    plots: Object.fromEntries(FARM_TILES.filter(t => t.bed === 'NW').map(t => [t.id, { ...emptyPlot(), tilled: true }])),
    animals: startingAnimals(),
    machines: {},
    nodes: Object.fromEntries(MINE_NODES.map((_, i) => [`node-${i}`, { ore: STARTING_ORES[i % STARTING_ORES.length]!, back: 0 }])),
    stumps: {},
    grass: {},
    hives: {},
    shipping: {},
    greenhouse: false,
  };
}

export function createInitialState(opts: NewIslandOptions = {}): GameState {
  const seed = opts.seed ?? DEFAULT_SEED;
  const playerId = opts.playerId ?? DEFAULT_PLAYER.id;
  const time = createTime();
  return {
    version: SAVE_VERSION,
    seed,
    time,
    weather: FIRST_DAY_WEATHER,
    island: {
      name: opts.islandName ?? DEFAULT_ISLAND.name,
      nativeFruit: opts.nativeFruit ?? DEFAULT_ISLAND.nativeFruit,
    },
    players: { [playerId]: createPlayer(playerId, opts.playerName ?? DEFAULT_PLAYER.name, opts.appearance) },
    quests: [{ id: 'tour', visited: [], done: false }],
    trees: {},
    ...newIslandProgress(time, seed),
  };
}
