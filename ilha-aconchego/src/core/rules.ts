import { ANIMAL_DEFS, FRIENDSHIP, FRIENDSHIP_DOUBLE, MAX_FRIENDSHIP } from '../data/animals';
import type { SeasonId } from '../data/calendar';
import { FARM_CROP_DEFS, type FarmCropId } from '../data/crops';
import { FISH, inHours, isRainy, type FishSpot } from '../data/fish';
import { ITEMS, QUALITY_PRICE, type ItemId, type Quality } from '../data/items';
import { FARM_TILES, type FarmTile } from '../data/map';
import type { Recipe } from '../data/recipes';
import { MAX_SKILL_LEVEL, skillLevel, type SkillId } from '../data/skills';
import { TOOL_AREA, toolEnergy, type ToolId } from '../data/tools';
import type { WeatherId } from '../data/weather';
import { countItem, countKind, removeItem, removeKind } from './inventory';
import { nextRandom } from './rng';
import type { AnimalState, GameState, Inventory, ItemStack, OreId, PlayerState, PlotState } from './types';

/**
 * Game rules as small pure functions. Commands (core/commands.ts) and the new-day step
 * (core/day.ts) use them; tests check them directly.
 */

// ---------- Random helpers working on the state's generator ----------

/** Next random number in [0, 1), advancing the generator stored in the state. */
export function roll(state: GameState): number {
  const r = nextRandom(state.rng);
  state.rng = r.state;
  return r.value;
}

export function pickWeighted<T>(state: GameState, entries: readonly (readonly [T, number])[]): T | null {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  let r = roll(state) * total;
  for (const [value, w] of entries) {
    if (r < w) return value;
    r -= w;
  }
  return entries[entries.length - 1]![0];
}

// ---------- Skills ----------

export const levelOf = (player: PlayerState, skill: SkillId): number => skillLevel(player.skills[skill]);

/** Adds experience. Returns the new level if the skill went up a level. */
export function addXp(player: PlayerState, skill: SkillId, xp: number): number | null {
  const before = skillLevel(player.skills[skill]);
  player.skills[skill] += xp;
  const after = skillLevel(player.skills[skill]);
  return after > before && after <= MAX_SKILL_LEVEL ? after : null;
}

// ---------- Energy ----------

/** Energy a tool use costs this player (tool level, and today's "Dedo verde" bonus for farm tools). */
export function energyCost(player: PlayerState, tool: ToolId): number {
  const base = toolEnergy(tool, player.toolLevels[tool]);
  if (player.buff === 'farming' && (tool === 'hoe' || tool === 'wateringCan')) return Math.ceil(base / 2);
  return base;
}

/** Energy restored by eating an item (cooking skill makes dishes more filling). */
export function eatEnergy(player: PlayerState, item: ItemId): number {
  const def = ITEMS[item] as { energy?: number; kind: string };
  if (!def.energy) return 0;
  const bonus = def.kind === 'dish' ? 1 + 0.04 * levelOf(player, 'cooking') : 1;
  return Math.round(def.energy * bonus);
}

// ---------- Farm ----------

export const emptyPlot = (): PlotState => ({ tilled: false, crop: null, growth: 0, ripe: false, watered: false, fertilizer: null, sprinkler: false });
export const plotOf = (state: Readonly<GameState>, id: string): PlotState => state.plots[id] ?? emptyPlot();

/** Tiles a hoe or watering can of `level` reaches around `center` (same bed only). */
export function tilesInArea(center: FarmTile, level: number): FarmTile[] {
  const area = TOOL_AREA[level] ?? 'tile';
  return FARM_TILES.filter(t => {
    if (t.bed !== center.bed) return false;
    if (area === 'bed') return true;
    if (area === 'tile') return t.id === center.id;
    if (area === 'row') return t.row === center.row && Math.abs(t.col - center.col) <= 1;
    return Math.abs(t.row - center.row) <= 1 && Math.abs(t.col - center.col) <= 1;
  });
}

export const cropGrowsIn = (crop: FarmCropId, season: SeasonId, greenhouse: boolean): boolean => greenhouse || FARM_CROP_DEFS[crop].seasons.includes(season);

/** One night of growth for a plot that was watered (the growth fertilizer adds a bonus day every third day). */
export function growPlot(plot: PlotState): void {
  if (!plot.crop || plot.ripe || !plot.watered) return;
  plot.growth += 1;
  if (plot.fertilizer === 'growth' && plot.growth % 3 === 0) plot.growth += 1;
  const def = FARM_CROP_DEFS[plot.crop];
  if (plot.growth >= def.days) plot.ripe = true;
}

/** Quality of a harvest: farming level, fertilizer and luck raise the chance of silver and gold. */
export function rollQuality(state: GameState, player: PlayerState, plot: PlotState): Quality {
  const level = levelOf(player, 'farming');
  const fert = plot.fertilizer === 'fertilizer' ? 1 : 0;
  const luck = player.buff === 'luck' ? 1 : 0;
  const gold = 0.015 * level + 0.08 * fert + 0.08 * luck;
  const silver = gold + 0.05 * level + 0.2 * fert + 0.1 * luck;
  const r = roll(state);
  return r < gold ? 2 : r < silver ? 1 : 0;
}

/** After harvesting: crops that regrow go back a few days; the others leave tilled soil. */
export function afterHarvest(plot: PlotState): void {
  const def = plot.crop ? FARM_CROP_DEFS[plot.crop] : null;
  if (def?.regrow) {
    plot.ripe = false;
    plot.growth = def.days - def.regrow;
    return;
  }
  plot.crop = null;
  plot.ripe = false;
  plot.growth = 0;
  plot.fertilizer = null;
}

/** Tiles a sprinkler waters: the eight around it, in the same bed. */
export function sprinklerTiles(center: FarmTile): FarmTile[] {
  return FARM_TILES.filter(t => t.bed === center.bed && t.id !== center.id && Math.abs(t.row - center.row) <= 1 && Math.abs(t.col - center.col) <= 1);
}

// ---------- Animals ----------

export function feedAnimal(animal: AnimalState, charisma: number): void {
  animal.fedToday = true;
  animal.friendship = Math.min(MAX_FRIENDSHIP, animal.friendship + Math.round(FRIENDSHIP.feed * (1 + 0.05 * charisma)));
}

export function petAnimal(animal: AnimalState, charisma: number): void {
  animal.pettedToday = true;
  animal.friendship = Math.min(MAX_FRIENDSHIP, animal.friendship + Math.round(FRIENDSHIP.pet * (1 + 0.05 * charisma)));
}

/** Morning step for one animal: fed and petted yesterday means a product today (sheep every other day). */
export function animalMorning(state: GameState, animal: AnimalState, today: number): void {
  const def = ANIMAL_DEFS[animal.kind];
  if (animal.fedToday && animal.pettedToday && !animal.ready && today - animal.lastProduct >= def.every) {
    animal.ready = true;
    animal.lastProduct = today;
  }
  if (!animal.pettedToday) animal.friendship = Math.max(0, animal.friendship - 5);
  animal.fedToday = false;
  animal.pettedToday = false;
  void state;
}

/** How many products a ready animal gives (good friends sometimes give two). */
export function animalYield(state: GameState, animal: AnimalState): number {
  if (animal.friendship >= FRIENDSHIP_DOUBLE && roll(state) < 0.3) return 2;
  return 1;
}

// ---------- Mining ----------

const ORE_WEIGHTS: readonly (readonly [OreId, number])[] = [['stone', 42], ['copper', 30], ['silver', 17], ['gold', 9], ['crystal', 2]];
const RICH_ORE_WEIGHTS: readonly (readonly [OreId, number])[] = [['stone', 15], ['copper', 25], ['silver', 30], ['gold', 22], ['crystal', 8]];
export const ORE_ITEM: Record<OreId, ItemId> = { stone: 'res.stone', copper: 'res.copper', silver: 'res.silver', gold: 'res.gold', crystal: 'res.crystal' };

export function rollOre(state: GameState, rich = false): OreId {
  return pickWeighted(state, rich ? RICH_ORE_WEIGHTS : ORE_WEIGHTS) ?? 'stone';
}

// ---------- Fishing ----------

/** Fish that bite at a spot right now. */
export function fishAvailable(spot: FishSpot, season: SeasonId, minute: number, weather: WeatherId) {
  return FISH.filter(f => f.spots.includes(spot) && f.seasons.includes(season) && inHours(f.hours, minute) && (!f.weather || isRainy(weather)));
}

/** Picks the fish on the line ("Dia de sorte" makes rare fish more likely). */
export function rollFish(state: GameState, spot: FishSpot, season: SeasonId, minute: number, weather: WeatherId, lucky: boolean): ItemId | null {
  const list = fishAvailable(spot, season, minute, weather);
  return pickWeighted(state, list.map(f => [f.item, f.weight * (lucky && f.difficulty >= 4 ? 2 : 1)] as const));
}

// ---------- Recipes and money ----------

export function hasIngredients(inv: Inventory, recipe: Recipe): boolean {
  return recipe.ingredients.every(ing => ('item' in ing ? countItem(inv, ing.item) : countKind(inv, ing.kind)) >= ing.qty);
}

export function useIngredients(inv: Inventory, recipe: Recipe): void {
  for (const ing of recipe.ingredients) {
    if ('item' in ing) removeItem(inv, ing.item, ing.qty);
    else removeKind(inv, ing.kind, ing.qty);
  }
}

/** Price paid at the shipping bin for a stack (quality and charisma raise it). */
export function sellPrice(stack: ItemStack, charisma: number): number {
  const base = ITEMS[stack.item].sell;
  return Math.round(base * (QUALITY_PRICE[stack.q ?? 0] ?? 1) * (1 + 0.01 * charisma)) * stack.qty;
}
