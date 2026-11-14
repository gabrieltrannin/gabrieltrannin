import { BUGS, FISH, inHours, isRainy, type FishSpot } from '../../data/fish';
import { isItemId } from '../../data/items';
import { CREEK, CREEK_BEACH, GRASS_PATCHES, grassPatchCenter, HIVES, HONEY_DAYS, MINE_NODES, PIER, POND, STUMPS, WOOD_NODE_START, WORK_REACH } from '../../data/map';
import { XP } from '../../data/skills';
import { groundHeight } from '../../world/terrain';
import { absoluteDay, seasonOf } from '../clock';
import { changed, gained, hasItem, hasRoom, isInt, near, playerOf, RESIDENTS, PLAYERS, xp, type HandlersFor } from '../commandKit';
import { GRASS_DAYS, hiveReady, NODE_DAYS, STUMP_DAYS } from '../day';
import { addItem } from '../inventory';
import { energyCost, levelOf, ORE_ITEM, roll, rollFish } from '../rules';
import type { GameState, PlayerState } from '../types';

type GatherCommands = 'grass.cut' | 'node.mine' | 'stump.chop' | 'hive.collect' | 'bug.catch' | 'fishing.cast' | 'fishing.finish';

const ORE_XP = { stone: XP.mine, copper: 8, silver: 12, gold: 18, crystal: 30 } as const;
const REACH = WORK_REACH + 0.5;

/** Is the player standing where a line can reach this kind of water? */
export function canFishFrom(player: PlayerState, spot: FishSpot): boolean {
  const { x, z } = player.position;
  if (spot === 'pier') return x > PIER.x0 - 0.4 && x < PIER.x1 + 0.4 && z > PIER.z0 - 0.4 && z < PIER.z1 + 0.4;
  if (spot === 'river') {
    const pond = Math.hypot((x - POND.x) / (POND.rx + 1.6), (z - POND.z) / (POND.rz + 1.6)) <= 1;
    const creek = CREEK.some(([cx, cz]) => Math.hypot(x - cx, z - cz) <= 1.9) || (Math.abs(x - CREEK_BEACH.x) <= 1.9 && z >= CREEK_BEACH.z0 && z <= CREEK_BEACH.z1);
    return pond || creek;
  }
  const h = groundHeight(x, z);
  return h !== null && h < 0.5;
}

export const gatherHandlers: HandlersFor<GatherCommands> = {
  'grass.cut': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!isInt(cmd.patch) || cmd.patch < 0 || cmd.patch >= GRASS_PATCHES.columns * GRASS_PATCHES.rows) return 'invalid';
      if (state.grass[cmd.patch] !== undefined) return 'not_ready';
      if (!near(player, grassPatchCenter(cmd.patch), 2.4)) return 'too_far';
      return hasRoom(player.inventory, 'res.hay', 3) ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const qty = addItem(player.inventory, 'res.hay', 2 + (roll(state) < 0.5 ? 1 : 0));
      state.grass[cmd.patch] = absoluteDay(state.time) + GRASS_DAYS;
      return [{ type: 'world.changed' }, gained(actor.id, 'res.hay', qty), ...changed(actor.id), ...xp(player, 'farming', 2)];
    },
  },

  'node.mine': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!hasItem(player.inventory, 'tool.pickaxe')) return 'no_tool';
      const index = MINE_NODES.findIndex((_, i) => `node-${i}` === cmd.node);
      if (index < 0) return 'invalid';
      if (!state.nodes[cmd.node]?.ore) return 'not_ready';
      if (!near(player, MINE_NODES[index]!, REACH)) return 'too_far';
      if (!hasRoom(player.inventory, 'res.stone', 3)) return 'inventory_full';
      return player.energy >= energyCost(player, 'pickaxe') ? null : 'tired';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const node = state.nodes[cmd.node]!;
      const ore = node.ore!;
      const events = [{ type: 'world.changed' } as const, ...changed(actor.id)];
      const stone = addItem(player.inventory, 'res.stone', ore === 'stone' ? 2 + (roll(state) < 0.5 ? 1 : 0) : 1);
      const out = [gained(actor.id, 'res.stone', stone)];
      if (ore !== 'stone') {
        const extraChance = 0.05 * levelOf(player, 'mining') * (player.buff === 'mining' ? 2 : 1) + (player.toolLevels.pickaxe >= 4 ? 0.2 : 0);
        const qty = addItem(player.inventory, ORE_ITEM[ore], 1 + (roll(state) < extraChance ? 1 : 0));
        out.unshift(gained(actor.id, ORE_ITEM[ore], qty));
      }
      // Now and then a fossil hides in the rock (more often in the wood).
      const index = MINE_NODES.findIndex((_, i) => `node-${i}` === cmd.node);
      if (roll(state) < (index >= WOOD_NODE_START ? 0.12 : 0.05)) out.push(gained(actor.id, 'res.fossil', addItem(player.inventory, 'res.fossil', 1)));
      player.energy -= energyCost(player, 'pickaxe');
      state.nodes[cmd.node] = { ore: null, back: absoluteDay(state.time) + NODE_DAYS };
      return [...events, ...out, ...xp(player, 'mining', ORE_XP[ore])];
    },
  },

  'stump.chop': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!hasItem(player.inventory, 'tool.axe')) return 'no_tool';
      const index = STUMPS.findIndex((_, i) => `stump-${i}` === cmd.stump);
      if (index < 0) return 'invalid';
      if (state.stumps[cmd.stump] !== undefined) return 'not_ready';
      if (!near(player, STUMPS[index]!, REACH)) return 'too_far';
      if (!hasRoom(player.inventory, 'res.wood', 6)) return 'inventory_full';
      return player.energy >= energyCost(player, 'axe') ? null : 'tired';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const qty = addItem(player.inventory, 'res.wood', 3 + Math.floor(roll(state) * 2) + (player.toolLevels.axe - 1));
      player.energy -= energyCost(player, 'axe');
      state.stumps[cmd.stump] = absoluteDay(state.time) + STUMP_DAYS;
      return [{ type: 'world.changed' }, gained(actor.id, 'res.wood', qty), ...changed(actor.id), ...xp(player, 'crafting', XP.chop)];
    },
  },

  'hive.collect': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const index = HIVES.findIndex((_, i) => `hive-${i}` === cmd.hive);
      if (index < 0) return 'invalid';
      if (!near(player, HIVES[index]!, REACH)) return 'too_far';
      if (seasonOf(state.time) === 'winter' || !hiveReady(state, cmd.hive)) return 'not_ready';
      return hasRoom(player.inventory, 'animal.honey', 2) ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const qty = addItem(player.inventory, 'animal.honey', 1 + (player.buff === 'luck' ? 1 : 0));
      state.hives[cmd.hive] = absoluteDay(state.time) + HONEY_DAYS;
      return [{ type: 'world.changed' }, gained(actor.id, 'animal.honey', qty), ...changed(actor.id), ...xp(player, 'farming', 4)];
    },
  },

  'bug.catch': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!hasItem(player.inventory, 'tool.bugNet')) return 'no_tool';
      const bug = BUGS.find(b => b.item === cmd.item);
      if (!bug || !isItemId(cmd.item)) return 'invalid';
      const rainy = isRainy(state.weather);
      const okWeather = !bug.weather || (bug.weather === 'rain' ? rainy : !rainy);
      if (!bug.seasons.includes(seasonOf(state.time)) || !inHours(bug.hours, state.time.minuteOfDay) || !okWeather) return 'not_available';
      if (!hasRoom(player.inventory, cmd.item)) return 'inventory_full';
      return player.energy >= energyCost(player, 'bugNet') ? null : 'tired';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      addItem(player.inventory, cmd.item, 1);
      player.energy -= energyCost(player, 'bugNet');
      return [gained(actor.id, cmd.item, 1), ...changed(actor.id), ...xp(player, 'charisma', XP.bug)];
    },
  },

  'fishing.cast': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!hasItem(player.inventory, 'tool.fishingRod')) return 'no_tool';
      if (cmd.spot !== 'pier' && cmd.spot !== 'beach' && cmd.spot !== 'river') return 'invalid';
      if (!canFishFrom(player, cmd.spot)) return 'too_far';
      return player.energy >= energyCost(player, 'fishingRod') ? null : 'tired';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      player.energy -= energyCost(player, 'fishingRod');
      const item = rollFish(state, cmd.spot, seasonOf(state.time), state.time.minuteOfDay, state.weather, player.buff === 'luck');
      player.fishing = item ? { item, spot: cmd.spot } : null;
      return [{ type: 'fishing.cast', playerId: actor.id, item }, ...changed(actor.id)];
    },
  },

  'fishing.finish': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!player.fishing || typeof cmd.caught !== 'boolean') return 'invalid';
      return cmd.caught && !hasRoom(player.inventory, player.fishing.item) ? 'inventory_full' : null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const { item } = player.fishing!;
      player.fishing = null;
      if (!cmd.caught) return [{ type: 'fishing.done', playerId: actor.id, item, caught: false }];
      addItem(player.inventory, item, 1);
      const difficulty = FISH.find(f => f.item === item)?.difficulty ?? 1;
      return [{ type: 'fishing.done', playerId: actor.id, item, caught: true }, gained(actor.id, item, 1), ...changed(actor.id), ...xp(player, 'fishing', XP.fishCatch + difficulty * 6)];
    },
  },
};

/** Where the stage-3 grass patches, rocks and stumps are, for the state checker. */
export const isHiveReady = (state: Readonly<GameState>, i: number) => seasonOf(state.time) !== 'winter' && hiveReady(state, `hive-${i}`);
