import { HONEY_DAYS } from '../data/map';
import { MAX_ENERGY } from '../data/items';
import { FARM_TILES, farmTile, MINE_NODES, PLAYER_START, WOOD_NODE_START } from '../data/map';
import { absoluteDay, seasonOf, startNextDay } from './clock';
import type { GameEvent } from './commands';
import { animalMorning, cropGrowsIn, growPlot, playerSellPrice, roll, rollOre, sprinklerTiles } from './rules';
import { islandTalent } from './talents';
import { rollHidden } from './home';
import { updateStars } from './rating';
import { recipeById } from '../data/recipes';
import type { GameState, MailItem } from './types';
import { VILLAGERS, hearts } from '../data/villagers';
import { isBirthday, refreshRequests } from './villagers';
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
    const coins = stacks.reduce((sum, s) => sum + playerSellPrice(player, s), 0);
    player.coins += coins;
    player.stats.earned = (player.stats.earned ?? 0) + coins;
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
  const growFast = islandTalent(state, 'growFast') / 100;
  for (const tile of FARM_TILES) {
    const plot = state.plots[tile.id];
    if (!plot) continue;
    // Talent: a watered crop sometimes grows two days in one night.
    const extra = plot.watered && plot.crop && !plot.ripe && roll(state) < growFast;
    growPlot(plot);
    if (extra && !plot.ripe) {
      plot.watered = true;
      growPlot(plot);
    }
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
    if (!node || (node.ore === null && today >= node.back)) state.nodes[id] = { ore: rollOre(state, i >= WOOD_NODE_START), back: 0 };
  });
  for (const [id, day] of Object.entries(state.stumps)) if (today >= day) delete state.stumps[id];
  for (const [id, day] of Object.entries(state.grass)) if (today >= day) delete state.grass[id];

  // 6. Village: the notice board, letters with presents from good friends, birthday reminders.
  const boardChanged = refreshRequests(state);
  const tomorrowTime = startNextDay(state.time).time;
  const birthdays = VILLAGERS.filter(v => isBirthday(v, tomorrowTime));
  for (const player of Object.values(state.players)) {
    const send = (mail: Omit<MailItem, 'id' | 'taken' | 'read' | 'day'>) => {
      player.mailSeq += 1;
      player.mail.push({ ...mail, id: player.mailSeq, taken: false, read: false, day: today });
    };
    for (const v of VILLAGERS) {
      const friend = player.friends[v.id];
      const tier = [8, 6, 4].find(h => hearts(friend.points) >= h) ?? 0;
      if (tier > friend.mailedTier) {
        friend.mailedTier = tier;
        send({ from: v.id, key: 'mail.friend', params: { hearts: tier }, item: v.present, qty: tier >= 8 ? 3 : tier >= 6 ? 2 : 1 });
      }
      // Stage 5: good friends teach a secret recipe (from 4 hearts on).
      const recipe = v.teaches ? recipeById(v.teaches) : undefined;
      if (recipe && tier >= 4 && !player.recipes.includes(recipe.id)) {
        player.recipes.push(recipe.id);
        send({ from: v.id, key: 'mail.recipe', params: { item: recipe.result } });
        events.push({ type: 'recipe.learned', playerId: player.id, recipe: recipe.id, how: 'letter' });
      }
    }
    for (const v of birthdays) send({ from: 'island', key: 'mail.birthday', params: { name: v.name } });
    if (player.mail.length > 30) player.mail.splice(0, player.mail.length - 30);
  }

  // 7. Stage 5: the pet's finds for today, and the island rating recounted.
  rollHidden(state);
  const stars = updateStars(state, true);

  // 8. Stage 6: a new day of exploring (everything grows back; puzzles stay as they are).
  state.explore = { ...state.explore, day: today, taken: [], calmed: [], mine: {} };

  // 9. Everyone wakes up rested; yesterday's meal bonus is over. Anyone still away wakes up at home.
  for (const player of Object.values(state.players)) {
    if (player.away) {
      player.away = null;
      player.inside = null;
      player.position = { ...PLAYER_START };
    }
    player.energy = MAX_ENERGY;
    player.buff = null;
    player.fishing = null;
  }

  events.push(
    { type: 'day.started', time: { ...state.time }, newSeason: next.newSeason, newYear: next.newYear, weather: state.weather },
    { type: 'farm.changed' },
    { type: 'world.changed' },
  );
  events.push({ type: 'hidden.changed' }, ...stars);
  if (withered) events.push({ type: 'farm.withered' });
  if (boardChanged) events.push({ type: 'board.changed' });
  for (const id of Object.keys(state.players)) events.push({ type: 'mail.changed', playerId: id });
  if (wet) events.push({ type: 'farm.rained' });
  return events;
}

/** Honey is ready when the hive's day has come. */
export const hiveReady = (state: Readonly<GameState>, id: string): boolean => absoluteDay(state.time) >= (state.hives[id] ?? 0);
export const nextHoneyDay = (state: Readonly<GameState>): number => absoluteDay(state.time) + HONEY_DAYS;
export { farmTile };
