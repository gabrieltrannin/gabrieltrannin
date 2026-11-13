import { FARM_CROP_DEFS, isFarmCrop, type FarmCropId } from '../../data/crops';
import { ITEMS, isItemId, type ItemId } from '../../data/items';
import { FARM_REACH, farmTile, GREENHOUSE, type FarmTile } from '../../data/map';
import { GREENHOUSE_COST } from '../../data/recipes';
import { XP } from '../../data/skills';
import { seasonOf } from '../clock';
import { changed, gained, hasItem, hasRoom, near, playerOf, RESIDENTS, xp, type HandlersFor } from '../commandKit';
import type { GameEvent } from '../commands';
import { addItem, countItem, removeItem } from '../inventory';
import { afterHarvest, cropGrowsIn, emptyPlot, energyCost, levelOf, plotOf, roll, rollQuality, tilesInArea } from '../rules';
import type { GameState, PlayerState, PlotState } from '../types';

type FarmCommands = 'farm.till' | 'farm.plant' | 'farm.water' | 'farm.harvest' | 'farm.fertilize' | 'farm.sprinkler' | 'greenhouse.repair';

const at = (t: FarmTile) => [t.x, t.z] as const;
const seedCrop = (item: unknown): FarmCropId | null => {
  if (typeof item !== 'string' || !item.startsWith('seed.')) return null;
  const crop = item.slice(5);
  return isFarmCrop(crop) ? crop : null;
};

/** Shared checks for working a tile: it exists, it is close and (in the greenhouse) the glass house is fixed. */
function tileCheck(state: Readonly<GameState>, player: PlayerState, id: unknown): FarmTile | 'invalid' | 'too_far' | 'not_available' {
  const tile = farmTile(id);
  if (!tile) return 'invalid';
  if (!near(player, at(tile), FARM_REACH)) return 'too_far';
  if (tile.greenhouse && !state.greenhouse) return 'not_available';
  return tile;
}

const editPlot = (state: GameState, id: string): PlotState => (state.plots[id] ??= emptyPlot());

export const farmHandlers: HandlersFor<FarmCommands> = {
  'farm.till': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!hasItem(player.inventory, 'tool.hoe')) return 'no_tool';
      const tile = tileCheck(state, player, cmd.tile);
      if (typeof tile === 'string') return tile;
      if (!tilesInArea(tile, player.toolLevels.hoe).some(t => !plotOf(state, t.id).tilled)) return 'not_available';
      return player.energy >= energyCost(player, 'hoe') ? null : 'tired';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const tiles = tilesInArea(farmTile(cmd.tile)!, player.toolLevels.hoe).filter(t => !plotOf(state, t.id).tilled);
      for (const t of tiles) editPlot(state, t.id).tilled = true;
      player.energy -= energyCost(player, 'hoe');
      return [{ type: 'farm.changed' }, ...changed(actor.id), ...xp(player, 'farming', XP.till * tiles.length)];
    },
  },

  'farm.plant': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const crop = seedCrop(cmd.item);
      if (!crop || !isItemId(cmd.item) || countItem(player.inventory, cmd.item) < 1) return 'invalid';
      const tile = tileCheck(state, player, cmd.tile);
      if (typeof tile === 'string') return tile;
      const plot = plotOf(state, tile.id);
      if (!plot.tilled) return 'not_tilled';
      if (plot.crop || plot.sprinkler) return 'occupied';
      return cropGrowsIn(crop, seasonOf(state.time), tile.greenhouse) ? null : 'wrong_season';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      removeItem(player.inventory, cmd.item as ItemId, 1);
      const plot = editPlot(state, cmd.tile);
      plot.crop = seedCrop(cmd.item);
      plot.growth = 0;
      plot.ripe = false;
      return [{ type: 'farm.changed' }, ...changed(actor.id), ...xp(player, 'farming', XP.plant)];
    },
  },

  'farm.water': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!hasItem(player.inventory, 'tool.wateringCan')) return 'no_tool';
      const tile = tileCheck(state, player, cmd.tile);
      if (typeof tile === 'string') return tile;
      const area = tilesInArea(tile, player.toolLevels.wateringCan);
      if (!area.some(t => plotOf(state, t.id).tilled && !plotOf(state, t.id).watered)) return 'not_available';
      return player.energy >= energyCost(player, 'wateringCan') ? null : 'tired';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const tiles = tilesInArea(farmTile(cmd.tile)!, player.toolLevels.wateringCan).filter(t => plotOf(state, t.id).tilled && !plotOf(state, t.id).watered);
      for (const t of tiles) editPlot(state, t.id).watered = true;
      player.energy -= energyCost(player, 'wateringCan');
      return [{ type: 'farm.changed' }, { type: 'farm.watered', tiles: tiles.map(t => t.id) }, ...changed(actor.id), ...xp(player, 'farming', XP.water * tiles.length)];
    },
  },

  'farm.harvest': {
    // Visitors may help harvest (the option "visitantes podem colher" arrives with multiplayer).
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const tile = tileCheck(state, player, cmd.tile);
      if (typeof tile === 'string') return tile;
      const plot = plotOf(state, tile.id);
      if (!plot.crop || !plot.ripe) return 'not_ready';
      return hasRoom(player.inventory, `crop.${plot.crop}`, 2) ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const plot = editPlot(state, cmd.tile);
      const crop = plot.crop!;
      const item: ItemId = `crop.${crop}`;
      const q = rollQuality(state, player, plot);
      const qty = 1 + (roll(state) < 0.03 * levelOf(player, 'farming') ? 1 : 0);
      const added = addItem(player.inventory, item, qty, q);
      afterHarvest(plot);
      return [{ type: 'farm.changed' }, gained(actor.id, item, added, q), ...changed(actor.id), ...xp(player, 'farming', FARM_CROP_DEFS[crop].xp)];
    },
  },

  'farm.fertilize': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (cmd.item !== 'supply.fertilizer' && cmd.item !== 'supply.growth') return 'invalid';
      if (countItem(player.inventory, cmd.item) < 1) return 'missing';
      const tile = tileCheck(state, player, cmd.tile);
      if (typeof tile === 'string') return tile;
      const plot = plotOf(state, tile.id);
      if (!plot.tilled) return 'not_tilled';
      return plot.fertilizer || plot.ripe || plot.sprinkler ? 'occupied' : null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      removeItem(player.inventory, cmd.item, 1);
      editPlot(state, cmd.tile).fertilizer = cmd.item === 'supply.growth' ? 'growth' : 'fertilizer';
      return [{ type: 'farm.changed' }, ...changed(actor.id)];
    },
  },

  'farm.sprinkler': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (countItem(player.inventory, 'place.sprinkler') < 1) return 'missing';
      const tile = tileCheck(state, player, cmd.tile);
      if (typeof tile === 'string') return tile;
      const plot = plotOf(state, tile.id);
      return plot.crop || plot.sprinkler ? 'occupied' : null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      removeItem(player.inventory, 'place.sprinkler', 1);
      const plot = editPlot(state, cmd.tile);
      plot.sprinkler = true;
      plot.tilled = true;
      plot.fertilizer = null;
      return [{ type: 'farm.changed' }, ...changed(actor.id), ...xp(player, 'crafting', 4)];
    },
  },

  'greenhouse.repair': {
    roles: RESIDENTS,
    validate(state, _cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (state.greenhouse) return 'not_available';
      if (!near(player, [GREENHOUSE.x, GREENHOUSE.z + GREENHOUSE.d / 2], 3)) return 'too_far';
      if (player.coins < GREENHOUSE_COST.coins) return 'no_money';
      const inv = player.inventory;
      return countItem(inv, 'res.wood') >= GREENHOUSE_COST.wood && countItem(inv, 'res.stone') >= GREENHOUSE_COST.stone ? null : 'missing';
    },
    apply(state, _cmd, actor) {
      const player = state.players[actor.id]!;
      player.coins -= GREENHOUSE_COST.coins;
      removeItem(player.inventory, 'res.wood', GREENHOUSE_COST.wood);
      removeItem(player.inventory, 'res.stone', GREENHOUSE_COST.stone);
      state.greenhouse = true;
      const events: GameEvent[] = [{ type: 'world.changed' }, { type: 'farm.changed' }, ...changed(actor.id)];
      return events.concat(xp(player, 'crafting', 30));
    },
  },
};

/** The produce a crop item comes from (for prompts). */
export const cropOfItem = (item: ItemId) => (ITEMS[item].kind === 'seed' ? seedCrop(item) : null);
