import type { ItemId, ItemKind } from './items';

/** One ingredient: a specific item, or any item of a kind (for example any fish). */
export type Ingredient = { item: ItemId; qty: number } | { kind: ItemKind; qty: number };

export interface Recipe {
  id: string;
  result: ItemId;
  qty: number;
  ingredients: readonly Ingredient[];
  /** Skill level needed to know the recipe. */
  level: number;
}

/** Dishes made at the kitchen stove next to the house. */
export const COOKING: readonly Recipe[] = [
  { id: 'salad', result: 'dish.salad', qty: 1, level: 0, ingredients: [{ item: 'crop.lettuce', qty: 1 }, { item: 'crop.carrot', qty: 1 }] },
  { id: 'omelet', result: 'dish.omelet', qty: 1, level: 0, ingredients: [{ item: 'animal.egg', qty: 2 }] },
  { id: 'grilledFish', result: 'dish.grilledFish', qty: 1, level: 0, ingredients: [{ kind: 'fish', qty: 1 }] },
  { id: 'popcorn', result: 'dish.popcorn', qty: 2, level: 0, ingredients: [{ item: 'crop.corn', qty: 1 }] },
  { id: 'pancakes', result: 'dish.pancakes', qty: 1, level: 1, ingredients: [{ item: 'animal.egg', qty: 1 }, { item: 'animal.milk', qty: 1 }, { item: 'crop.wheat', qty: 1 }] },
  { id: 'strawberryPie', result: 'dish.strawberryPie', qty: 1, level: 2, ingredients: [{ item: 'crop.strawberry', qty: 3 }, { item: 'crop.wheat', qty: 1 }, { item: 'animal.egg', qty: 1 }] },
  { id: 'tomatoPasta', result: 'dish.tomatoPasta', qty: 1, level: 2, ingredients: [{ item: 'crop.tomato', qty: 2 }, { item: 'crop.wheat', qty: 1 }] },
  { id: 'pumpkinSoup', result: 'dish.pumpkinSoup', qty: 1, level: 3, ingredients: [{ item: 'crop.pumpkin', qty: 1 }, { item: 'animal.milk', qty: 1 }] },
  { id: 'kaleStew', result: 'dish.kaleStew', qty: 1, level: 3, ingredients: [{ item: 'crop.kale', qty: 2 }, { item: 'animal.milk', qty: 1 }] },
  { id: 'honeyCake', result: 'dish.honeyCake', qty: 1, level: 4, ingredients: [{ item: 'animal.honey', qty: 1 }, { item: 'crop.wheat', qty: 1 }, { item: 'animal.egg', qty: 1 }] },
  { id: 'cheeseToast', result: 'dish.cheeseToast', qty: 1, level: 5, ingredients: [{ item: 'artisan.cheese', qty: 1 }, { item: 'crop.wheat', qty: 1 }] },
];

/** Things made at the workbench. */
export const CRAFTING: readonly Recipe[] = [
  { id: 'fertilizer', result: 'supply.fertilizer', qty: 2, level: 0, ingredients: [{ item: 'res.hay', qty: 3 }] },
  { id: 'sprinkler', result: 'place.sprinkler', qty: 1, level: 0, ingredients: [{ item: 'res.copper', qty: 2 }, { item: 'res.stone', qty: 4 }] },
  { id: 'keg', result: 'place.keg', qty: 1, level: 1, ingredients: [{ item: 'res.wood', qty: 20 }, { item: 'res.copper', qty: 1 }] },
  { id: 'growth', result: 'supply.growth', qty: 2, level: 2, ingredients: [{ item: 'supply.fertilizer', qty: 2 }, { item: 'res.copper', qty: 1 }] },
  { id: 'press', result: 'place.press', qty: 1, level: 2, ingredients: [{ item: 'res.wood', qty: 15 }, { item: 'res.stone', qty: 10 }, { item: 'res.silver', qty: 1 }] },
  { id: 'wheel', result: 'place.wheel', qty: 1, level: 3, ingredients: [{ item: 'res.wood', qty: 18 }, { item: 'res.silver', qty: 1 }] },
];

/** Machines: what they take, what they make and how long it takes (in game minutes). */
export const MACHINES = {
  keg: { item: 'place.keg', accepts: ['fruit', 'crop'] as readonly ItemKind[], inputs: [] as readonly ItemId[], output: 'artisan.juice' as ItemId, minutes: 1200 },
  press: { item: 'place.press', accepts: [] as readonly ItemKind[], inputs: ['animal.milk'] as readonly ItemId[], output: 'artisan.cheese' as ItemId, minutes: 180 },
  wheel: { item: 'place.wheel', accepts: [] as readonly ItemKind[], inputs: ['animal.wool'] as readonly ItemId[], output: 'artisan.yarn' as ItemId, minutes: 240 },
} as const;
export type MachineKind = keyof typeof MACHINES;
export const MACHINE_KINDS = Object.keys(MACHINES) as MachineKind[];
export const machineOfItem = (item: ItemId): MachineKind | null => MACHINE_KINDS.find(k => MACHINES[k].item === item) ?? null;

/** Price to repair the greenhouse on the upper level. */
export const GREENHOUSE_COST = { coins: 1000, wood: 20, stone: 10 } as const;
