import type { StationId } from './decor';
import type { ItemId, ItemKind } from './items';

/** One ingredient: a specific item, or any item of a kind (for example any fish). */
export type Ingredient = { item: ItemId; qty: number } | { kind: ItemKind; qty: number };

/**
 * How a recipe is learned (docs/GAME_DESIGN.md, "Receitas descobertas por experimento, presentes e livros"):
 * - level: known once the station's skill reaches `level`;
 * - discover: a secret. Found by trying its ingredients together ("Experimentar"), and also taught by
 *   a recipe book or a villager's letter (data/villagers `teaches`).
 */
export interface Recipe {
  id: string;
  station: StationId;
  result: ItemId;
  qty: number;
  ingredients: readonly Ingredient[];
  /** Skill level needed to know the recipe. */
  level: number;
  learn?: 'discover';
}

const r = (station: StationId, id: string, result: ItemId, qty: number, level: number, ingredients: Ingredient[], learn?: 'discover'): Recipe =>
  ({ id, station, result, qty, level, ingredients, ...(learn ? { learn } : {}) });
const it = (item: ItemId, qty = 1): Ingredient => ({ item, qty });
const any = (kind: ItemKind, qty = 1): Ingredient => ({ kind, qty });
const SECRET = 'discover' as const;

export const RECIPES: readonly Recipe[] = [
  // Cozinha (the stove next to the house, or a stove placed anywhere).
  r('kitchen', 'salad', 'dish.salad', 1, 0, [it('crop.lettuce'), it('crop.carrot')]),
  r('kitchen', 'omelet', 'dish.omelet', 1, 0, [it('animal.egg', 2)]),
  r('kitchen', 'grilledFish', 'dish.grilledFish', 1, 0, [any('fish')]),
  r('kitchen', 'popcorn', 'dish.popcorn', 2, 0, [it('crop.corn')]),
  r('kitchen', 'pancakes', 'dish.pancakes', 1, 1, [it('animal.egg'), it('animal.milk'), it('crop.wheat')]),
  r('kitchen', 'strawberryPie', 'dish.strawberryPie', 1, 2, [it('crop.strawberry', 3), it('crop.wheat'), it('animal.egg')]),
  r('kitchen', 'tomatoPasta', 'dish.tomatoPasta', 1, 2, [it('crop.tomato', 2), it('crop.wheat')]),
  r('kitchen', 'pumpkinSoup', 'dish.pumpkinSoup', 1, 3, [it('crop.pumpkin'), it('animal.milk')]),
  r('kitchen', 'kaleStew', 'dish.kaleStew', 1, 3, [it('crop.kale', 2), it('animal.milk')]),
  r('kitchen', 'honeyCake', 'dish.honeyCake', 1, 4, [it('animal.honey'), it('crop.wheat'), it('animal.egg')]),
  r('kitchen', 'cheeseToast', 'dish.cheeseToast', 1, 5, [it('artisan.cheese'), it('crop.wheat')]),
  r('kitchen', 'fruitPie', 'dish.fruitPie', 1, 0, [any('fruit', 2), it('crop.wheat'), it('animal.egg')], SECRET),
  r('kitchen', 'jam', 'dish.jam', 1, 0, [any('fruit', 3)], SECRET),
  r('kitchen', 'fishStew', 'dish.fishStew', 1, 0, [any('fish', 2), it('crop.tomato')], SECRET),
  r('kitchen', 'pizza', 'dish.pizza', 1, 0, [it('crop.tomato'), it('crop.wheat'), it('artisan.cheese')], SECRET),
  r('kitchen', 'fruitSalad', 'dish.fruitSalad', 1, 0, [any('fruit', 2), it('animal.honey')], SECRET),

  // Carpintaria (the workbench behind the house): machines, furniture and the other stations.
  r('carpentry', 'sprinkler', 'place.sprinkler', 1, 0, [it('res.copper', 2), it('res.stone', 4)]),
  r('carpentry', 'chair', 'furn.chair', 1, 0, [it('res.wood', 4)]),
  r('carpentry', 'table', 'furn.table', 1, 0, [it('res.wood', 8)]),
  r('carpentry', 'crate', 'furn.crate', 1, 0, [it('res.wood', 5)]),
  r('carpentry', 'fence', 'furn.fence', 2, 0, [it('res.wood', 3)]),
  r('carpentry', 'stonePath', 'furn.stonePath', 2, 0, [it('res.stone', 3)]),
  r('carpentry', 'loom', 'furn.loom', 1, 0, [it('res.wood', 10)]),
  r('carpentry', 'alchemyTable', 'furn.alchemy', 1, 0, [it('res.wood', 8), it('res.stone', 6)]),
  r('carpentry', 'jeweler', 'furn.jeweler', 1, 0, [it('res.wood', 8), it('res.copper', 3)]),
  r('carpentry', 'lamp', 'furn.lamp', 1, 0, [it('res.wood', 3), it('res.copper', 1)]),
  r('carpentry', 'keg', 'place.keg', 1, 1, [it('res.wood', 20), it('res.copper', 1)]),
  r('carpentry', 'stove', 'furn.stove', 1, 1, [it('res.stone', 10), it('res.copper', 2)]),
  r('carpentry', 'workbench', 'furn.workbench', 1, 1, [it('res.wood', 15), it('res.stone', 5)]),
  r('carpentry', 'bookshelf', 'furn.bookshelf', 1, 1, [it('res.wood', 12)]),
  r('carpentry', 'mirror', 'furn.mirror', 1, 1, [it('res.wood', 4), it('res.silver', 1)]),
  r('carpentry', 'press', 'place.press', 1, 2, [it('res.wood', 15), it('res.stone', 10), it('res.silver', 1)]),
  r('carpentry', 'bed', 'furn.bed', 1, 2, [it('res.wood', 15), it('artisan.fabric', 2)]),
  r('carpentry', 'sofa', 'furn.sofa', 1, 2, [it('res.wood', 10), it('artisan.fabric', 3)]),
  r('carpentry', 'wardrobe', 'furn.wardrobe', 1, 2, [it('res.wood', 18)]),
  r('carpentry', 'wheel', 'place.wheel', 1, 3, [it('res.wood', 18), it('res.silver', 1)]),
  r('carpentry', 'bench', 'furn.bench', 1, 0, [it('res.wood', 10), it('res.stone', 4)], SECRET),
  r('carpentry', 'hayBale', 'furn.hayBale', 1, 0, [it('res.hay', 6)], SECRET),
  r('carpentry', 'birdbath', 'furn.birdbath', 1, 0, [it('res.stone', 12)], SECRET),
  r('carpentry', 'birdhouse', 'furn.birdhouse', 1, 0, [it('res.wood', 6), it('res.hay', 2)], SECRET),
  r('carpentry', 'flowerBox', 'furn.flowerBox', 1, 0, [it('res.wood', 5), any('flower', 2)], SECRET),
  r('carpentry', 'beachChair', 'furn.beachChair', 1, 0, [it('res.wood', 8), it('artisan.fabric')], SECRET),
  r('carpentry', 'flowerBed', 'furn.flowerBed', 1, 0, [it('res.wood', 4), any('flower', 3)], SECRET),
  r('carpentry', 'lantern', 'furn.lantern', 1, 0, [it('res.copper', 2), it('res.wood', 2), it('bug.firefly')], SECRET),
  r('carpentry', 'fountain', 'furn.fountain', 1, 0, [it('res.stone', 30), it('res.copper', 4)], SECRET),

  // Tricô (the knitting table): wool becomes yarn, yarn becomes fabric, fabric becomes clothes.
  r('knitting', 'yarn', 'artisan.yarn', 1, 0, [it('animal.wool', 2)]),
  r('knitting', 'fabric', 'artisan.fabric', 1, 0, [it('artisan.yarn', 2)]),
  r('knitting', 'scarf', 'cloth.scarf', 1, 0, [it('artisan.yarn', 2)]),
  r('knitting', 'petBow', 'pet.bow', 1, 0, [it('artisan.fabric')]),
  r('knitting', 'sweater', 'cloth.sweater', 1, 1, [it('artisan.fabric', 2), it('artisan.yarn')]),
  r('knitting', 'rug', 'furn.rug', 1, 1, [it('artisan.fabric', 2), it('artisan.yarn')]),
  r('knitting', 'petScarf', 'pet.scarf', 1, 1, [it('artisan.yarn')]),
  r('knitting', 'beret', 'cloth.beret', 1, 0, [it('artisan.fabric'), it('artisan.yarn')], SECRET),
  r('knitting', 'raincoat', 'cloth.raincoat', 1, 0, [it('artisan.fabric', 2), it('animal.honey')], SECRET),
  r('knitting', 'apron', 'cloth.apron', 1, 0, [it('artisan.fabric', 2), any('flower')], SECRET),
  r('knitting', 'petFlowerCrown', 'pet.flowerCrown', 1, 0, [any('flower', 3)], SECRET),

  // Alquimia: fertilizers, dyes and potions.
  r('alchemy', 'fertilizer', 'supply.fertilizer', 2, 0, [it('res.hay', 3)]),
  r('alchemy', 'dyeRed', 'dye.red', 2, 0, [it('flower.rose')]),
  r('alchemy', 'dyeYellow', 'dye.yellow', 2, 0, [it('flower.sunflower')]),
  r('alchemy', 'dyePink', 'dye.pink', 2, 0, [it('flower.tulip')]),
  r('alchemy', 'dyeGreen', 'dye.green', 2, 1, [it('crop.kale')]),
  r('alchemy', 'dyeOrange', 'dye.orange', 2, 1, [it('crop.carrot')]),
  r('alchemy', 'energyTonic', 'potion.energy', 1, 1, [it('animal.honey'), any('flower')]),
  r('alchemy', 'growth', 'supply.growth', 2, 2, [it('supply.fertilizer', 2), it('res.copper', 1)]),
  r('alchemy', 'dyeNavy', 'dye.navy', 2, 0, [it('fish.squid')], SECRET),
  r('alchemy', 'dyeLilac', 'dye.lilac', 2, 0, [it('crop.cabbage')], SECRET),
  r('alchemy', 'speedPotion', 'potion.speed', 1, 0, [it('bug.grasshopper'), it('animal.honey')], SECRET),
  r('alchemy', 'luckPotion', 'potion.luck', 1, 0, [it('bug.ladybug'), it('flower.daisy')], SECRET),

  // Joalheria.
  r('jewelry', 'copperRing', 'jewel.copperRing', 1, 0, [it('res.copper', 2)]),
  r('jewelry', 'petBell', 'pet.bell', 1, 0, [it('res.copper', 1), it('res.stone', 1)]),
  r('jewelry', 'silverRing', 'jewel.silverRing', 1, 1, [it('res.silver', 2)]),
  r('jewelry', 'goldNecklace', 'jewel.goldNecklace', 1, 3, [it('res.gold', 2), it('res.silver')]),
  r('jewelry', 'crystalPendant', 'jewel.crystalPendant', 1, 0, [it('res.crystal'), it('res.silver')], SECRET),
  r('jewelry', 'tiara', 'jewel.tiara', 1, 0, [it('res.crystal', 2), it('res.gold')], SECRET),
];

export const recipeById = (id: unknown): Recipe | undefined => RECIPES.find(x => x.id === id);
export const recipesAt = (station: StationId): Recipe[] => RECIPES.filter(x => x.station === station);
/** The skill each station trains. */
export const STATION_SKILL: Record<StationId, 'cooking' | 'crafting'> = { kitchen: 'cooking', carpentry: 'crafting', knitting: 'crafting', alchemy: 'crafting', jewelry: 'crafting' };

/** Recipe books and what each one teaches. */
export const BOOKS: Partial<Record<ItemId, readonly string[]>> = {
  'book.kitchen': ['pizza', 'fruitSalad', 'jam'],
  'book.carpentry': ['birdhouse', 'flowerBox', 'beachChair', 'bench'],
  'book.knitting': ['raincoat', 'beret'],
  'book.alchemy': ['dyeNavy', 'dyeLilac'],
  'book.jewelry': ['tiara', 'crystalPendant'],
};

/** Older names kept for the code that still lists one station at a time. */
export const COOKING: readonly Recipe[] = recipesAt('kitchen');
export const CRAFTING: readonly Recipe[] = recipesAt('carpentry');

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
