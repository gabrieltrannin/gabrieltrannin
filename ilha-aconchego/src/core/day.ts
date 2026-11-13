import { HONEY_DAYS } from '../data/map';
import { MAX_ENERGY } from '../data/items';
import { FARM_TILES, farmTile, MINE_NODES } from '../data/map';
import { absoluteDay, seasonOf, startNextDay } from './clock';
import type { GameEvent } from './commands';
import { animalMorning, cropGrowsIn, growPlot, levelOf, rollOre, sellPrice, sprinklerTiles } from './rules';
import type { GameState } from './types';
import { rollWeather } from './weather';

/** Days a broken rock, a chopped stump and cut grass take to come back. */
export const NODE_DAYS = 2;
export const STUMP_DAYS = 2;
export const GRASS_DAYS = 2;

/**
 * Everything that happens overnight, in order: the shipping bin pays, the calendar moves on,
 * the forecast becomes today's weather, crops grow and get watered by rain or sprinklers,
 * animals that were fed and petted leave a product, rocks and wood come back, energy refills.
 */
export function startNewDay(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];

  // 1. The shipping bin pays everything put in it yesterday.
  for (const [playerId, stacks] of Object.entries(state.shipping)) {
    const player = state.players[playerId];
    if (!player || stacks.length === 0) continue;
    const charisma = levelOf(player, 'charisma');
    const coins = stacks.reduce((sum, s) => sum + sellPrice(s, charisma), 0);
    player.coins += coins;
    events.push({ type: 'shipping.paid', playerId, coins });
  }
  state.shipping = {};

  // 2. Calendar and weather: tomorrow's forecast becomes today's weather.
  const next = startNextDay(state.time);
  state.time = next.time;
  const season = seasonOf(state.time);
  const today = absoluteDay(state.time);
  state.weather = state.forecast === 'snow' && season !== 'winter' ? 'rain' : state.forecast;
  const tomorrow = startNextDay(state.time);
  const w = rollWeather(state.rng, seasonOf(tomorrow.time));
  state.rng = w.rng;
  state.forecast = w.weather;

  // 3. Farm: yesterday's watering makes crops grow; out-of-season crops wither outdoors.
  let withered = false;
  for (const tile of FARM_TILES) {
    const plot = state.plots[tile.id];
    if (!plot) continue;
    growPlot(plot);
    plot.watered = false;
    if (plot.crop && !cropGrowsIn(plot.crop, season, tile.greenhouse)) {
      plot.crop = null;
      plot.growth = 0;
      plot.ripe = false;
      plot.fertilizer = null;
      withered = true;
    }
  }
  const wet = state.weather === 'rain' || state.weather === 'storm' || state.weather === 'snow';
  for (const tile of FARM_TILES) {
    const plot = state.plots[tile.id];
    if (!plot) continue;
    if (wet && !tile.greenhouse && plot.tilled) plot.watered = true;
    if (plot.sprinkler && (!tile.greenhouse || state.greenhouse)) {
      for (const t of sprinklerTiles(tile)) {
        const p = state.plots[t.id];
        if (p?.tilled) p.watered = true;
      }
    }
  }

  // 4. Animals.
  for (const animal of state.animals) animalMorning(state, animal, today);

  // 5. Rocks, stumps, tall grass and beehives come back.
  MINE_NODES.forEach((_, i) => {
    const id = `node-${i}`;
    const node = state.nodes[id];
    if (!node || (node.ore === null && today >= node.back)) state.nodes[id] = { ore: rollOre(state), back: 0 };
  });
  for (const [id, day] of Object.entries(state.stumps)) if (today >= day) delete state.stumps[id];
  for (const [id, day] of Object.entries(state.grass)) if (today >= day) delete state.grass[id];

  // 6. Everyone wakes up rested; yesterday's meal bonus is over.
  for (const player of Object.values(state.players)) {
    player.energy = MAX_ENERGY;
    player.buff = null;
    player.fishing = null;
  }

  events.push(
    { type: 'day.started', time: { ...state.time }, newSeason: next.newSeason, newYear: next.newYear, weather: state.weather },
    { type: 'farm.changed' },
    { type: 'world.changed' },
  );
  if (withered) events.push({ type: 'farm.withered' });
  if (wet) events.push({ type: 'farm.rained' });
  return events;
}

/** Honey is ready when the hive's day has come. */
export const hiveReady = (state: Readonly<GameState>, id: string): boolean => absoluteDay(state.time) >= (state.hives[id] ?? 0);
export const nextHoneyDay = (state: Readonly<GameState>): number => absoluteDay(state.time) + HONEY_DAYS;
export { farmTile };
