import { ANIMAL_DEFS } from '../../data/animals';
import { HOTBAR_SIZE, INVENTORY_SIZE, ITEMS, MAX_ENERGY, isItemId } from '../../data/items';
import { BENTO_SPOT, KITCHEN, MACHINE_PADS, PEN, PEN_REACH, SHIPPING_BIN, STALLS, STATION_REACH, WORKBENCH, type XZ } from '../../data/map';
import { COOKING, CRAFTING, MACHINES, machineOfItem, type Recipe } from '../../data/recipes';
import { isShopId, shopEntries, type ShopId } from '../../data/shops';
import { XP } from '../../data/skills';
import { MAX_TOOL_LEVEL, TOOLS, toolItem, UPGRADE_COST, type ToolId } from '../../data/tools';
import { seasonOf } from '../clock';
import { changed, gained, has, hasItem, hasRoom, isInt, near, nowMinute, playerOf, PLAYERS, RESIDENTS, sellable, xp, type HandlersFor } from '../commandKit';
import { addItem, countItem, removeItem, spaceFor, takeFromSlot } from '../inventory';
import { animalYield, eatEnergy, feedAnimal, hasIngredients, levelOf, petAnimal, useIngredients } from '../rules';
import { shopOpen } from '../villagers';
import { SEED_SHOP_COUNTER } from '../../data/village';
import type { GameState, PlayerState } from '../types';

type EconomyCommands =
  | 'item.eat' | 'cook' | 'craft' | 'shop.buy' | 'ship.add' | 'ship.take' | 'tool.upgrade'
  | 'machine.place' | 'machine.load' | 'machine.collect' | 'animal.feed' | 'animal.pet' | 'animal.collect';

const STALL_SHOP: Record<string, ShopId> = { 'stall.bread': 'bread', 'stall.honey': 'honey', 'stall.flowers': 'flowers' };
/** Where each shop is: in front of its market stall, or Bento's spot at the smithy. */
export function shopSpot(shop: ShopId): XZ {
  if (shop === 'smithy') return BENTO_SPOT;
  if (shop === 'seeds') return SEED_SHOP_COUNTER;
  const stall = STALLS.find(s => STALL_SHOP[s.asset] === shop)!;
  return [stall.at[0], stall.at[1] + 1.2];
}
const SHOP_REACH = 3;
const PEN_CENTER: XZ = [(PEN.x0 + PEN.x1) / 2, (PEN.z0 + PEN.z1) / 2];

function recipeCheck(state: Readonly<GameState>, player: PlayerState, list: readonly Recipe[], id: unknown, skill: 'cooking' | 'crafting', spot: XZ) {
  const recipe = list.find(r => r.id === id);
  if (!recipe) return 'invalid' as const;
  if (!near(player, spot, STATION_REACH + 0.5)) return 'too_far' as const;
  if (recipe.level > levelOf(player, skill)) return 'not_available' as const;
  if (!hasIngredients(player.inventory, recipe)) return 'missing' as const;
  return spaceFor(player.inventory, recipe.result) >= recipe.qty ? null : ('inventory_full' as const);
  void state;
}

const animalOf = (state: Readonly<GameState>, id: unknown) => state.animals.find(a => a.id === id);
const padOk = (pad: unknown): pad is number => isInt(pad) && pad >= 0 && pad < MACHINE_PADS.length;

export const economyHandlers: HandlersFor<EconomyCommands> = {
  'item.eat': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!isInt(cmd.slot) || cmd.slot < 0 || cmd.slot >= INVENTORY_SIZE) return 'invalid';
      const slot = player.inventory[cmd.slot];
      if (!slot || eatEnergy(player, slot.item) <= 0) return 'invalid';
      const buff = (ITEMS[slot.item] as { buff?: string }).buff;
      return player.energy >= MAX_ENERGY && !buff ? 'not_available' : null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const item = player.inventory[cmd.slot]!.item;
      const energy = eatEnergy(player, item);
      const buff = (ITEMS[item] as { buff?: PlayerState['buff'] }).buff ?? null;
      takeFromSlot(player.inventory, cmd.slot, 1);
      player.energy = Math.min(MAX_ENERGY, player.energy + energy);
      if (buff) player.buff = buff;
      return [{ type: 'ate', playerId: actor.id, item, energy, buff }, ...changed(actor.id)];
    },
  },

  cook: {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      return player ? recipeCheck(state, player, COOKING, cmd.recipe, 'cooking', KITCHEN) : 'forbidden';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const recipe = COOKING.find(r => r.id === cmd.recipe)!;
      useIngredients(player.inventory, recipe);
      addItem(player.inventory, recipe.result, recipe.qty);
      return [{ type: 'made', playerId: actor.id, item: recipe.result, qty: recipe.qty }, gained(actor.id, recipe.result, recipe.qty), ...changed(actor.id), ...xp(player, 'cooking', XP.cook)];
    },
  },

  craft: {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      return player ? recipeCheck(state, player, CRAFTING, cmd.recipe, 'crafting', WORKBENCH) : 'forbidden';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const recipe = CRAFTING.find(r => r.id === cmd.recipe)!;
      useIngredients(player.inventory, recipe);
      addItem(player.inventory, recipe.result, recipe.qty);
      return [{ type: 'made', playerId: actor.id, item: recipe.result, qty: recipe.qty }, gained(actor.id, recipe.result, recipe.qty), ...changed(actor.id), ...xp(player, 'crafting', XP.craft)];
    },
  },

  'shop.buy': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!isShopId(cmd.shop) || !isItemId(cmd.item) || !isInt(cmd.qty) || cmd.qty < 1 || cmd.qty > 99) return 'invalid';
      const entry = shopEntries(cmd.shop, seasonOf(state.time), state.projects.seeds.done).find(e => e.item === cmd.item);
      if (!entry) return 'not_available';
      if (!near(player, shopSpot(cmd.shop), SHOP_REACH)) return 'too_far';
      if (!shopOpen(state, cmd.shop)) return 'closed';
      if (player.coins < entry.price * cmd.qty) return 'no_money';
      return spaceFor(player.inventory, cmd.item) >= cmd.qty ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const entry = shopEntries(cmd.shop, seasonOf(state.time), state.projects.seeds.done).find(e => e.item === cmd.item)!;
      player.coins -= entry.price * cmd.qty;
      addItem(player.inventory, cmd.item, cmd.qty);
      return [gained(actor.id, cmd.item, cmd.qty), ...changed(actor.id)];
    },
  },

  'ship.add': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!near(player, SHIPPING_BIN, STATION_REACH + 0.5)) return 'too_far';
      if (!isInt(cmd.slot) || cmd.slot < 0 || cmd.slot >= INVENTORY_SIZE || !isInt(cmd.qty) || cmd.qty < 1) return 'invalid';
      const slot = player.inventory[cmd.slot];
      if (!slot || slot.qty < cmd.qty) return 'invalid';
      return sellable(slot.item) ? null : 'not_available';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const taken = takeFromSlot(player.inventory, cmd.slot, cmd.qty)!;
      const bin = (state.shipping[actor.id] ??= []);
      const same = bin.find(s => s.item === taken.item && (s.q ?? 0) === (taken.q ?? 0));
      if (same) same.qty += taken.qty;
      else bin.push(taken);
      return [{ type: 'shipping.changed', playerId: actor.id }, ...changed(actor.id)];
    },
  },

  'ship.take': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!near(player, SHIPPING_BIN, STATION_REACH + 0.5)) return 'too_far';
      const bin = state.shipping[actor.id] ?? [];
      if (!isInt(cmd.index) || cmd.index < 0 || cmd.index >= bin.length) return 'invalid';
      const stack = bin[cmd.index]!;
      return spaceFor(player.inventory, stack.item, stack.q ?? 0) >= stack.qty ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const bin = state.shipping[actor.id]!;
      const [stack] = bin.splice(cmd.index, 1);
      addItem(player.inventory, stack!.item, stack!.qty, stack!.q ?? 0);
      return [{ type: 'shipping.changed', playerId: actor.id }, ...changed(actor.id)];
    },
  },

  'tool.upgrade': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!(TOOLS as readonly unknown[]).includes(cmd.tool)) return 'invalid';
      const tool = cmd.tool as ToolId;
      if (!hasItem(player.inventory, toolItem(tool))) return 'no_tool';
      if (!near(player, BENTO_SPOT, SHOP_REACH)) return 'too_far';
      if (!shopOpen(state, 'smithy')) return 'closed';
      const level = player.toolLevels[tool];
      if (level >= MAX_TOOL_LEVEL) return 'not_available';
      const cost = UPGRADE_COST[level + 1]!;
      if (player.coins < cost.coins) return 'no_money';
      return countItem(player.inventory, cost.item) >= cost.qty ? null : 'missing';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const level = player.toolLevels[cmd.tool] + 1;
      const cost = UPGRADE_COST[level]!;
      player.coins -= cost.coins;
      removeItem(player.inventory, cost.item, cost.qty);
      player.toolLevels[cmd.tool] = level;
      return [{ type: 'tool.upgraded', playerId: actor.id, tool: cmd.tool, level }, ...changed(actor.id), ...xp(player, 'charisma', 10)];
    },
  },

  'machine.place': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!padOk(cmd.pad) || !isInt(cmd.slot) || cmd.slot < 0 || cmd.slot >= INVENTORY_SIZE) return 'invalid';
      if (has(state.machines, String(cmd.pad))) return 'occupied';
      if (!near(player, MACHINE_PADS[cmd.pad]!, STATION_REACH + 0.5)) return 'too_far';
      const slot = player.inventory[cmd.slot];
      return slot && machineOfItem(slot.item) ? null : 'invalid';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const kind = machineOfItem(player.inventory[cmd.slot]!.item)!;
      takeFromSlot(player.inventory, cmd.slot, 1);
      state.machines[String(cmd.pad)] = { kind, output: null, readyAt: 0 };
      return [{ type: 'world.changed' }, ...changed(actor.id)];
    },
  },

  'machine.load': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!padOk(cmd.pad) || !isInt(cmd.slot) || cmd.slot < 0 || cmd.slot >= INVENTORY_SIZE) return 'invalid';
      const machine = state.machines[String(cmd.pad)];
      if (!machine) return 'invalid';
      if (machine.output) return 'occupied';
      if (!near(player, MACHINE_PADS[cmd.pad]!, STATION_REACH + 0.5)) return 'too_far';
      const slot = player.inventory[cmd.slot];
      if (!slot) return 'invalid';
      const def = MACHINES[machine.kind];
      return def.inputs.includes(slot.item) || def.accepts.includes(ITEMS[slot.item].kind) ? null : 'invalid';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const machine = state.machines[String(cmd.pad)]!;
      const def = MACHINES[machine.kind];
      takeFromSlot(player.inventory, cmd.slot, 1);
      machine.output = def.output;
      const minutes = Math.round((def.minutes * (1 - 0.04 * levelOf(player, 'crafting'))) / 10) * 10;
      machine.readyAt = nowMinute(state) + minutes;
      return [{ type: 'world.changed' }, ...changed(actor.id), ...xp(player, 'crafting', XP.machine)];
    },
  },

  'machine.collect': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!padOk(cmd.pad)) return 'invalid';
      const machine = state.machines[String(cmd.pad)];
      if (!machine?.output) return 'invalid';
      if (!near(player, MACHINE_PADS[cmd.pad]!, STATION_REACH + 0.5)) return 'too_far';
      if (nowMinute(state) < machine.readyAt) return 'not_ready';
      return hasRoom(player.inventory, machine.output) ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const machine = state.machines[String(cmd.pad)]!;
      const item = machine.output!;
      addItem(player.inventory, item, 1);
      machine.output = null;
      return [{ type: 'world.changed' }, gained(actor.id, item, 1), ...changed(actor.id)];
    },
  },

  'animal.feed': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const animal = animalOf(state, cmd.animal);
      if (!animal) return 'invalid';
      if (!near(player, PEN_CENTER, PEN_REACH)) return 'too_far';
      if (animal.fedToday) return 'not_available';
      return countItem(player.inventory, 'res.hay') > 0 ? null : 'missing';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      removeItem(player.inventory, 'res.hay', 1);
      feedAnimal(animalOf(state, cmd.animal)!, levelOf(player, 'charisma'));
      return [{ type: 'animals.changed' }, ...changed(actor.id), ...xp(player, 'farming', XP.feed)];
    },
  },

  'animal.pet': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const animal = animalOf(state, cmd.animal);
      if (!animal) return 'invalid';
      if (!near(player, PEN_CENTER, PEN_REACH)) return 'too_far';
      return animal.pettedToday ? 'not_available' : null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      petAnimal(animalOf(state, cmd.animal)!, levelOf(player, 'charisma'));
      return [{ type: 'animals.changed' }, { type: 'player.changed', playerId: actor.id }, ...xp(player, 'charisma', XP.pet)];
    },
  },

  'animal.collect': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const animal = animalOf(state, cmd.animal);
      if (!animal) return 'invalid';
      if (!near(player, PEN_CENTER, PEN_REACH)) return 'too_far';
      if (!animal.ready) return 'not_ready';
      return hasRoom(player.inventory, ANIMAL_DEFS[animal.kind].product, 2) ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const animal = animalOf(state, cmd.animal)!;
      const item = ANIMAL_DEFS[animal.kind].product;
      const qty = addItem(player.inventory, item, animalYield(state, animal));
      animal.ready = false;
      return [{ type: 'animals.changed' }, gained(actor.id, item, qty), ...changed(actor.id), ...xp(player, 'farming', XP.collectAnimal)];
    },
  },
};

export { HOTBAR_SIZE };
