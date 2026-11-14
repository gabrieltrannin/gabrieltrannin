import { talentById, type TalentMod } from '../data/talents';
import { ITEMS, type ItemId } from '../data/items';
import type { GameState, PlayerState } from './types';

/** Sum of a modifier over the talents a player chose (0 when none). */
export function talent(player: Readonly<PlayerState>, mod: TalentMod): number {
  let sum = 0;
  for (const id of player.talents) {
    const t = talentById(id);
    if (t && t.mod === mod) sum += t.value;
  }
  return sum;
}

/** For things that belong to the whole island (the farm at night, the pet's finds): the best player counts. */
export function islandTalent(state: Readonly<GameState>, mod: TalentMod): number {
  return Math.max(0, ...Object.values(state.players).map(p => talent(p, mod)));
}

/** Percent modifiers as a factor: 10 → 1.10. */
export const boost = (player: Readonly<PlayerState>, mod: TalentMod): number => 1 + talent(player, mod) / 100;
/** Percent modifiers as a chance: 10 → 0.10. */
export const chance = (player: Readonly<PlayerState>, mod: TalentMod): number => talent(player, mod) / 100;

const PRICE_MOD: Partial<Record<string, TalentMod>> = {
  crop: 'cropPrice', fruit: 'cropPrice', fish: 'fishPrice', resource: 'orePrice', dish: 'dishPrice',
  artisan: 'artisanPrice', furniture: 'artisanPrice', clothing: 'artisanPrice', jewelry: 'artisanPrice', potion: 'artisanPrice', dye: 'artisanPrice',
};

/** Extra price from talents when selling an item (its kind's talent plus "sell bonus"). */
export function priceFactor(player: Readonly<PlayerState>, item: ItemId): number {
  const mod = PRICE_MOD[ITEMS[item].kind];
  return 1 + ((mod ? talent(player, mod) : 0) + talent(player, 'sellBonus')) / 100;
}
