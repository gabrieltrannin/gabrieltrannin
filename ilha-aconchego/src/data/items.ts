import type { FruitId } from './defaults';

/**
 * Everything that fits in the backpack. Names come from i18n (`item.<id>`); icons are emoji drawn by
 * the browser until there is item art. `sell` is the base price at the shipping bin (0 = cannot be sold).
 */
export type ItemKind =
  | 'tool' | 'seed' | 'crop' | 'fruit' | 'animal' | 'fish' | 'bug' | 'resource' | 'supply' | 'dish' | 'artisan' | 'placeable' | 'flower'
  // Stage 5: furniture and decorations, clothes, dyes, jewelry, potions, recipe books and the pet's accessories.
  | 'furniture' | 'clothing' | 'dye' | 'jewelry' | 'potion' | 'book' | 'petwear'
  // Stage 6: shells and fossils for the museum.
  | 'shell' | 'fossil';

export type BuffId = 'speed' | 'fishing' | 'mining' | 'farming' | 'luck';

export interface ItemDef {
  icon: string;
  kind: ItemKind;
  /** How many fit in one backpack slot. Tools do not stack. */
  maxStack: number;
  sell: number;
  /** Energy restored when eaten (only food has it). */
  energy?: number;
  /** Bonus for the rest of the day when eaten. */
  buff?: BuffId;
}

const tool = (icon: string): ItemDef => ({ icon, kind: 'tool', maxStack: 1, sell: 0 });
const seed = (icon: string, sell: number): ItemDef => ({ icon, kind: 'seed', maxStack: 99, sell });
const crop = (icon: string, sell: number, energy: number): ItemDef => ({ icon, kind: 'crop', maxStack: 99, sell, energy });
const fish = (icon: string, sell: number): ItemDef => ({ icon, kind: 'fish', maxStack: 99, sell });
const bug = (icon: string, sell: number): ItemDef => ({ icon, kind: 'bug', maxStack: 99, sell });
const res = (icon: string, sell: number): ItemDef => ({ icon, kind: 'resource', maxStack: 99, sell });
const dish = (icon: string, sell: number, energy: number, buff?: BuffId): ItemDef => ({ icon, kind: 'dish', maxStack: 99, sell, energy, ...(buff ? { buff } : {}) });
const furn = (icon: string, sell: number): ItemDef => ({ icon, kind: 'furniture', maxStack: 10, sell });
const cloth = (icon: string, sell: number): ItemDef => ({ icon, kind: 'clothing', maxStack: 5, sell });
const dye = (icon: string, sell: number): ItemDef => ({ icon, kind: 'dye', maxStack: 20, sell });
const jewel = (icon: string, sell: number): ItemDef => ({ icon, kind: 'jewelry', maxStack: 10, sell });
const book = (icon: string): ItemDef => ({ icon, kind: 'book', maxStack: 5, sell: 60 });
const petwear = (icon: string, sell: number): ItemDef => ({ icon, kind: 'petwear', maxStack: 5, sell });
const shell = (icon: string, sell: number): ItemDef => ({ icon, kind: 'shell', maxStack: 20, sell });
const fossil = (icon: string, sell: number): ItemDef => ({ icon, kind: 'fossil', maxStack: 10, sell });

export const ITEMS = {
  'tool.hoe': tool('⚒️'),
  'tool.wateringCan': tool('💧'),
  'tool.axe': tool('🪓'),
  'tool.pickaxe': tool('⛏️'),
  'tool.fishingRod': tool('🎣'),
  'tool.bugNet': tool('🥅'),
  /** Stage 6: blows bubbles that calm the cute creatures down (not an upgradable tool). */
  'gear.wand': { icon: '🫧', kind: 'tool', maxStack: 1, sell: 0 },

  'seed.strawberry': seed('🍓', 20),
  'seed.lettuce': seed('🥬', 10),
  'seed.carrot': seed('🥕', 12),
  'seed.wheat': seed('🌾', 5),
  'seed.tomato': seed('🍅', 17),
  'seed.corn': seed('🌽', 25),
  'seed.pumpkin': seed('🎃', 35),
  'seed.cabbage': seed('🥦', 25),
  'seed.kale': seed('🌿', 20),

  'crop.strawberry': crop('🍓', 60, 12),
  'crop.lettuce': crop('🥬', 50, 10),
  'crop.carrot': crop('🥕', 55, 12),
  'crop.wheat': crop('🌾', 28, 0),
  'crop.tomato': crop('🍅', 50, 10),
  'crop.corn': crop('🌽', 60, 12),
  'crop.pumpkin': crop('🎃', 170, 0),
  'crop.cabbage': crop('🥦', 115, 14),
  'crop.kale': crop('🌿', 95, 12),

  'fruit.apple': { icon: '🍎', kind: 'fruit', maxStack: 99, sell: 45, energy: 10 },
  'fruit.pear': { icon: '🍐', kind: 'fruit', maxStack: 99, sell: 45, energy: 10 },
  'fruit.peach': { icon: '🍑', kind: 'fruit', maxStack: 99, sell: 45, energy: 10 },
  'fruit.orange': { icon: '🍊', kind: 'fruit', maxStack: 99, sell: 45, energy: 10 },
  'fruit.cherry': { icon: '🍒', kind: 'fruit', maxStack: 99, sell: 45, energy: 10 },
  // Found in the regions (not grown in the orchard).
  'fruit.coconut': { icon: '🥥', kind: 'fruit', maxStack: 99, sell: 60, energy: 12 },
  'fruit.blackberry': { icon: '🫐', kind: 'fruit', maxStack: 99, sell: 40, energy: 8 },
  'crop.mushroom': crop('🍄', 45, 10),

  'animal.egg': { icon: '🥚', kind: 'animal', maxStack: 99, sell: 50, energy: 8 },
  'animal.milk': { icon: '🥛', kind: 'animal', maxStack: 99, sell: 90, energy: 15 },
  'animal.wool': { icon: '☁️', kind: 'animal', maxStack: 99, sell: 130 },
  'animal.honey': { icon: '🍯', kind: 'animal', maxStack: 99, sell: 100, energy: 15 },

  'fish.sardine': fish('🐟', 35),
  'fish.seabass': fish('🐟', 80),
  'fish.squid': fish('🦑', 90),
  'fish.crab': fish('🦀', 70),
  'fish.puffer': fish('🐡', 150),
  'fish.moonfish': fish('🐠', 260),
  'fish.lambari': fish('🐟', 30),
  'fish.tilapia': fish('🐠', 60),
  'fish.trout': fish('🐟', 85),
  'fish.carp': fish('🐟', 45),
  'fish.catfish': fish('🐟', 140),
  'fish.goldfish': fish('🐠', 320),

  'bug.butterfly': bug('🦋', 60),
  'bug.ladybug': bug('🐞', 50),
  'bug.bee': bug('🐝', 80),
  'bug.grasshopper': bug('🦗', 70),
  'bug.snail': bug('🐌', 45),
  'bug.firefly': bug('✨', 120),
  'bug.caterpillar': bug('🐛', 40),
  'bug.beetle': bug('🪲', 150),
  'bug.blueFirefly': bug('✨', 200),
  'bug.lavaBeetle': bug('🐞', 260),
  'bug.cloudMoth': bug('🦋', 300),

  'res.wood': res('🪵', 4),
  'res.stone': res('🪨', 3),
  'res.copper': res('🥉', 25),
  'res.silver': res('🥈', 60),
  'res.gold': res('🥇', 150),
  'res.crystal': res('💎', 350),
  'res.hay': res('🍂', 4),
  'res.fossil': res('🦴', 180),
  'res.obsidian': res('🖤', 120),
  'res.fireCrystal': res('💠', 400),
  'res.stardust': res('🌟', 250),
  'res.cloudCotton': res('☁️', 90),
  // Things the cute creatures leave when they calm down.
  'res.jelly': res('🟢', 30),
  'res.moss': res('🌱', 25),
  'res.ember': res('🔸', 45),
  'res.puff': res('🤍', 40),

  // Stage 6: shells and fossils (the museum keeps one of each).
  'shell.scallop': shell('🐚', 40),
  'shell.cowrie': shell('🐚', 60),
  'shell.starfish': shell('⭐', 50),
  'shell.conch': shell('🐚', 90),
  'shell.nautilus': shell('🐚', 220),
  'shell.pearl': shell('🦪', 320),
  'fossil.fern': fossil('🌿', 180),
  'fossil.ammonite': fossil('🌀', 220),
  'fossil.trilobite': fossil('🦐', 260),
  'fossil.feather': fossil('🪶', 280),
  'fossil.tooth': fossil('🦷', 320),
  'fossil.egg': fossil('🥚', 400),

  'flower.tulip': { icon: '🌷', kind: 'flower', maxStack: 99, sell: 30 },
  'flower.sunflower': { icon: '🌻', kind: 'flower', maxStack: 99, sell: 35 },
  'flower.rose': { icon: '🌹', kind: 'flower', maxStack: 99, sell: 50 },
  'flower.daisy': { icon: '🌼', kind: 'flower', maxStack: 99, sell: 25 },

  'supply.fertilizer': { icon: '🪣', kind: 'supply', maxStack: 99, sell: 10 },
  'supply.growth': { icon: '🧪', kind: 'supply', maxStack: 99, sell: 20 },

  'dish.salad': dish('🥗', 140, 45),
  'dish.omelet': dish('🍳', 130, 40),
  'dish.pancakes': dish('🥞', 230, 60, 'speed'),
  'dish.strawberryPie': dish('🍰', 320, 80, 'luck'),
  'dish.grilledFish': dish('🍢', 150, 50, 'fishing'),
  'dish.pumpkinSoup': dish('🍲', 360, 90, 'farming'),
  'dish.popcorn': dish('🍿', 90, 30),
  'dish.kaleStew': dish('🥘', 280, 70, 'mining'),
  'dish.tomatoPasta': dish('🍝', 200, 60, 'mining'),
  'dish.honeyCake': dish('🧁', 280, 75, 'speed'),
  'dish.cheeseToast': dish('🥪', 330, 70, 'luck'),
  'dish.bread': dish('🍞', 40, 25),
  'dish.blackberryPie': dish('🥧', 120, 45),
  'dish.fruitPie': dish('🥧', 260, 65, 'luck'),
  'dish.jam': dish('🫙', 180, 30),
  'dish.fishStew': dish('🍲', 300, 80, 'fishing'),
  'dish.pizza': dish('🍕', 380, 85, 'speed'),
  'dish.fruitSalad': dish('🍧', 220, 55),

  'artisan.juice': { icon: '🧃', kind: 'artisan', maxStack: 99, sell: 150, energy: 20 },
  'artisan.cheese': { icon: '🧀', kind: 'artisan', maxStack: 99, sell: 230, energy: 25 },
  'artisan.yarn': { icon: '🧶', kind: 'artisan', maxStack: 99, sell: 320 },
  'artisan.fabric': { icon: '🧵', kind: 'artisan', maxStack: 99, sell: 700 },

  // Furniture and decorations (data/decor.ts says where they go and how big they are).
  'furn.bed': furn('🛏️', 1600),
  'furn.table': furn('🪵', 120),
  'furn.chair': furn('🪑', 60),
  'furn.sofa': furn('🛋️', 2300),
  'furn.bookshelf': furn('📚', 200),
  'furn.lamp': furn('💡', 90),
  'furn.rug': furn('🟫', 1900),
  'furn.plant': furn('🪴', 80),
  'furn.wardrobe': furn('🚪', 300),
  'furn.mirror': furn('🪞', 260),
  'furn.workbench': furn('🔨', 250),
  'furn.stove': furn('🍳', 320),
  'furn.loom': furn('🧶', 250),
  'furn.alchemy': furn('⚗️', 250),
  'furn.jeweler': furn('💍', 250),
  'furn.beachChair': furn('🏖️', 850),
  'furn.parasol': furn('⛱️', 220),
  'furn.surfboard': furn('🏄', 240),
  'furn.shellLamp': furn('🐚', 280),
  'furn.sandcastle': furn('🏰', 160),
  'furn.lifebuoy': furn('🛟', 150),
  'furn.hayBale': furn('🌾', 50),
  'furn.crate': furn('📦', 40),
  'furn.milkCan': furn('🥛', 150),
  'furn.flowerBox': furn('🌷', 140),
  'furn.miniScarecrow': furn('🧑‍🌾', 180),
  'furn.birdhouse': furn('🐦', 120),
  'furn.cafeTable': furn('☕', 260),
  'furn.bunting': furn('🎏', 180),
  'furn.fruitCrate': furn('🍎', 140),
  'furn.umbrella': furn('🏮', 240),
  'furn.chalkboard': furn('🪧', 120),
  'furn.lantern': furn('🏮', 260),
  'furn.bench': furn('🪑', 200),
  'furn.streetLamp': furn('🔦', 260),
  'furn.fence': furn('🚧', 20),
  'furn.fountain': furn('⛲', 600),
  'furn.birdbath': furn('🕊️', 180),
  'furn.flowerBed': furn('🌼', 120),
  'furn.stonePath': furn('🪨', 10),
  // Festival prizes.
  'furn.flowerArch': furn('🌸', 600),
  'furn.paperLantern': furn('🏮', 500),
  'furn.jackLantern': furn('🎃', 500),
  'furn.snowGlobe': furn('🔮', 700),

  // Clothes sewn at the knitting table (they go to the wardrobe), dyes for new colors, jewelry.
  'cloth.sweater': cloth('🧥', 2100),
  'cloth.raincoat': cloth('🧥', 1700),
  'cloth.apron': cloth('👗', 1600),
  'cloth.scarf': cloth('🧣', 800),
  'cloth.beret': cloth('🎨', 1200),
  'dye.red': dye('🔴', 80),
  'dye.yellow': dye('🟡', 80),
  'dye.pink': dye('🌸', 80),
  'dye.green': dye('🟢', 100),
  'dye.navy': dye('🔵', 120),
  'dye.lilac': dye('🟣', 120),
  'dye.orange': dye('🟠', 90),
  'jewel.copperRing': jewel('💍', 120),
  'jewel.silverRing': jewel('💍', 260),
  'jewel.goldNecklace': jewel('📿', 900),
  'jewel.crystalPendant': jewel('🔮', 1000),
  'jewel.tiara': jewel('👑', 1500),

  // Potions from the alchemy table.
  'potion.energy': { icon: '🧃', kind: 'potion', maxStack: 20, sell: 150, energy: 60 },
  'potion.speed': { icon: '🧪', kind: 'potion', maxStack: 20, sell: 200, energy: 10, buff: 'speed' },
  'potion.luck': { icon: '🍀', kind: 'potion', maxStack: 20, sell: 260, energy: 10, buff: 'luck' },

  // Recipe books (reading one teaches its recipes).
  'book.kitchen': book('📕'),
  'book.carpentry': book('📗'),
  'book.knitting': book('📘'),
  'book.alchemy': book('📙'),
  'book.jewelry': book('📓'),

  // The pet's accessories.
  'pet.bow': petwear('🎀', 150),
  'pet.scarf': petwear('🧣', 200),
  'pet.flowerCrown': petwear('💐', 180),
  'pet.bell': petwear('🔔', 160),

  'place.sprinkler': { icon: '⛲', kind: 'placeable', maxStack: 20, sell: 40 },
  'place.keg': { icon: '🛢️', kind: 'placeable', maxStack: 5, sell: 0 },
  'place.press': { icon: '🗜️', kind: 'placeable', maxStack: 5, sell: 0 },
  'place.wheel': { icon: '🧵', kind: 'placeable', maxStack: 5, sell: 0 },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, value);
}

export const itemDef = (id: ItemId): ItemDef => ITEMS[id];
export const fruitItem = (fruit: FruitId): ItemId => `fruit.${fruit}`;

/** Crop quality: 0 common, 1 silver, 2 gold. Better quality sells for more. */
export type Quality = 0 | 1 | 2;
export const QUALITY_PRICE: readonly number[] = [1, 1.25, 1.5];

/** 24 slots; the first 8 are the item bar at the bottom of the screen. */
export const INVENTORY_SIZE = 24;
export const HOTBAR_SIZE = 8;

/** What a new player carries. */
export const STARTING_INVENTORY: readonly (readonly [ItemId, number])[] = [
  ['tool.hoe', 1],
  ['tool.wateringCan', 1],
  ['seed.strawberry', 6],
  ['seed.lettuce', 6],
  ['tool.fishingRod', 1],
  ['tool.axe', 1],
  ['tool.pickaxe', 1],
  ['tool.bugNet', 1],
  ['res.hay', 6],
  ['dish.bread', 2],
];

export const STARTING_COINS = 500;
export const MAX_ENERGY = 100;
