import type { FruitId } from './defaults';

/** Items that fit in the backpack. Names come from i18n (`item.<id>`). Icons are emoji drawn by the browser. */
export type ItemKind = 'tool' | 'seed' | 'fruit';

export interface ItemDef {
  icon: string;
  kind: ItemKind;
  /** How many fit in one backpack slot. Tools do not stack. */
  maxStack: number;
}

export const ITEMS = {
  'tool.hoe': { icon: '⚒️', kind: 'tool', maxStack: 1 },
  'tool.wateringCan': { icon: '💧', kind: 'tool', maxStack: 1 },
  'tool.axe': { icon: '🪓', kind: 'tool', maxStack: 1 },
  'tool.pickaxe': { icon: '⛏️', kind: 'tool', maxStack: 1 },
  'tool.fishingRod': { icon: '🎣', kind: 'tool', maxStack: 1 },
  'tool.bugNet': { icon: '🦋', kind: 'tool', maxStack: 1 },
  'seed.strawberry': { icon: '🌱', kind: 'seed', maxStack: 99 },
  'fruit.apple': { icon: '🍎', kind: 'fruit', maxStack: 99 },
  'fruit.pear': { icon: '🍐', kind: 'fruit', maxStack: 99 },
  'fruit.peach': { icon: '🍑', kind: 'fruit', maxStack: 99 },
  'fruit.orange': { icon: '🍊', kind: 'fruit', maxStack: 99 },
  'fruit.cherry': { icon: '🍒', kind: 'fruit', maxStack: 99 },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, value);
}

export const fruitItem = (fruit: FruitId): ItemId => `fruit.${fruit}`;

/** 24 slots; the first 8 are the item bar at the bottom of the screen. */
export const INVENTORY_SIZE = 24;
export const HOTBAR_SIZE = 8;

/** What a new player carries. */
export const STARTING_INVENTORY: readonly (readonly [ItemId, number])[] = [
  ['tool.hoe', 1],
  ['tool.wateringCan', 1],
  ['tool.axe', 1],
  ['tool.pickaxe', 1],
  ['tool.fishingRod', 1],
  ['tool.bugNet', 1],
  ['seed.strawberry', 12],
];

export const STARTING_COINS = 500;
export const MAX_ENERGY = 100;
