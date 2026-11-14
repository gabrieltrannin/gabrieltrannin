import { isStationId, type StationId } from '../../data/decor';
import { INVENTORY_SIZE, isItemId, ITEMS, type ItemId } from '../../data/items';
import { KITCHEN, STATION_REACH, WORKBENCH, type XZ } from '../../data/map';
import { BOOKS, recipeById, recipesAt, STATION_SKILL, type Recipe } from '../../data/recipes';
import { XP } from '../../data/skills';
import { changed, gained, isInt, near, playerOf, RESIDENTS, xp, type HandlersFor } from '../commandKit';
import type { GameEvent } from '../commands';
import { usableNear } from '../decor';
import { addItem, countItem, countKind, spaceFor, takeFromSlot } from '../inventory';
import { bump, knowsRecipe } from '../progress';
import { hasIngredients, roll, useIngredients } from '../rules';
import { chance } from '../talents';
import type { GameState, PlayerState } from '../types';

/**
 * Stage 5: the five crafting stations (docs/GAME_DESIGN.md, "Ofícios e magia"). The stove and the
 * workbench next to the house are fixed; more stations can be placed anywhere as furniture.
 * Secret recipes are found by experimenting, from recipe books or from villagers' letters.
 */

type CraftCommands = 'craft' | 'craft.experiment' | 'book.read';

const FIXED: Partial<Record<StationId, XZ>> = { kitchen: KITCHEN, carpentry: WORKBENCH };

/** Next to a station of this kind: the fixed one outside, or one placed as furniture where the player is. */
export function atStation(state: Readonly<GameState>, player: PlayerState, station: StationId): boolean {
  const fixed = FIXED[station];
  if (fixed && near(player, fixed, STATION_REACH + 0.5)) return true;
  return !!usableNear(state, player, 'station', station);
}

/** Does this set of items match a recipe's ingredients one to one (by item, or by kind)? */
export function matches(recipe: Recipe, items: readonly ItemId[]): boolean {
  if (recipe.ingredients.length !== items.length) return false;
  const used = new Set<number>();
  const fits = (i: number): boolean => {
    if (i === recipe.ingredients.length) return true;
    const ing = recipe.ingredients[i]!;
    for (let j = 0; j < items.length; j++) {
      if (used.has(j)) continue;
      const ok = 'item' in ing ? ing.item === items[j] : ITEMS[items[j]!].kind === ing.kind;
      if (!ok) continue;
      used.add(j);
      if (fits(i + 1)) return true;
      used.delete(j);
    }
    return false;
  };
  return fits(0);
}

/** Makes a recipe: uses the ingredients (talents may save them), gives the result (and maybe one more). */
function make(state: GameState, player: PlayerState, recipe: Recipe): GameEvent[] {
  const kitchen = recipe.station === 'kitchen';
  if (roll(state) >= chance(player, kitchen ? 'kitchenSave' : 'craftSave')) useIngredients(player.inventory, recipe);
  let qty = recipe.qty;
  if (kitchen && roll(state) < chance(player, 'cookExtra') && spaceFor(player.inventory, recipe.result) > qty) qty += 1;
  addItem(player.inventory, recipe.result, qty);
  bump(player, kitchen ? 'cooked' : 'crafted');
  bump(player, `station.${recipe.station}`);
  const skill = STATION_SKILL[recipe.station];
  return [
    { type: 'made', playerId: player.id, item: recipe.result, qty },
    gained(player.id, recipe.result, qty),
    ...changed(player.id),
    ...xp(player, skill, kitchen ? XP.cook : XP.craft),
  ];
}

const ownsAll = (player: PlayerState, items: readonly ItemId[]) => items.every(i => countItem(player.inventory, i) > 0);

export const craftHandlers: HandlersFor<CraftCommands> = {
  craft: {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const recipe = recipeById(cmd.recipe);
      if (!isStationId(cmd.station) || !recipe || recipe.station !== cmd.station) return 'invalid';
      if (!atStation(state, player, cmd.station)) return 'too_far';
      if (!knowsRecipe(player, recipe)) return 'not_available';
      if (!hasIngredients(player.inventory, recipe)) return 'missing';
      return spaceFor(player.inventory, recipe.result) >= recipe.qty ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      return make(state, state.players[actor.id]!, recipeById(cmd.recipe)!);
    },
  },

  'craft.experiment': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!isStationId(cmd.station) || !Array.isArray(cmd.items)) return 'invalid';
      const items = cmd.items as unknown[];
      if (items.length < 1 || items.length > 3 || !items.every(isItemId) || new Set(items).size !== items.length) return 'invalid';
      if (!atStation(state, player, cmd.station)) return 'too_far';
      return ownsAll(player, cmd.items) ? null : 'missing';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const found = recipesAt(cmd.station).find(r => matches(r, cmd.items));
      // Nothing new (or a recipe that comes with a higher skill level): the items stay in the backpack.
      // A recipe already known is named as a hint.
      if (!found || !found.learn || knowsRecipe(player, found)) {
        return [{ type: 'experiment.failed', playerId: actor.id, known: found && knowsRecipe(player, found) ? found.id : null }];
      }
      player.recipes.push(found.id);
      bump(player, 'experiments');
      const events: GameEvent[] = [{ type: 'recipe.learned', playerId: actor.id, recipe: found.id, how: 'experiment' }];
      // Enough of everything: the first one is made right away.
      if (hasIngredients(player.inventory, found) && spaceFor(player.inventory, found.result) >= found.qty) events.push(...make(state, player, found));
      else events.push(...changed(actor.id));
      return events;
    },
  },

  'book.read': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!isInt(cmd.slot) || cmd.slot < 0 || cmd.slot >= INVENTORY_SIZE) return 'invalid';
      const stack = player.inventory[cmd.slot];
      const teaches = stack ? BOOKS[stack.item] : undefined;
      if (!teaches) return 'invalid';
      return teaches.every(id => player.recipes.includes(id)) ? 'already' : null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const teaches = BOOKS[player.inventory[cmd.slot]!.item]!;
      takeFromSlot(player.inventory, cmd.slot, 1);
      const events: GameEvent[] = [];
      for (const id of teaches) {
        if (player.recipes.includes(id)) continue;
        player.recipes.push(id);
        events.push({ type: 'recipe.learned', playerId: actor.id, recipe: id, how: 'book' });
      }
      return [...events, ...changed(actor.id)];
    },
  },
};

/** How many of each ingredient the player has (for the recipe list). */
export const haveOf = (player: PlayerState, ing: Recipe['ingredients'][number]) => ('item' in ing ? countItem(player.inventory, ing.item) : countKind(player.inventory, ing.kind));
