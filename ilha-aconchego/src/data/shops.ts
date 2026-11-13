import type { SeasonId } from './calendar';
import type { ItemId } from './items';

/** What each market stall and the smithy sell, and for how much. */
export interface ShopEntry {
  item: ItemId;
  price: number;
  /** Only sold in these seasons (seeds). */
  seasons?: readonly SeasonId[];
}

export const SHOPS = {
  flowers: [
    { item: 'seed.strawberry', price: 40, seasons: ['spring'] },
    { item: 'seed.lettuce', price: 20, seasons: ['spring'] },
    { item: 'seed.carrot', price: 25, seasons: ['spring'] },
    { item: 'seed.wheat', price: 10, seasons: ['summer', 'autumn'] },
    { item: 'seed.tomato', price: 35, seasons: ['summer'] },
    { item: 'seed.corn', price: 50, seasons: ['summer', 'autumn'] },
    { item: 'seed.pumpkin', price: 70, seasons: ['autumn'] },
    { item: 'seed.cabbage', price: 50, seasons: ['autumn'] },
    { item: 'seed.kale', price: 40, seasons: ['winter'] },
    { item: 'res.hay', price: 12 },
    { item: 'supply.fertilizer', price: 25 },
    { item: 'place.sprinkler', price: 300 },
  ],
  bread: [
    { item: 'dish.bread', price: 60 },
    { item: 'dish.blackberryPie', price: 180 },
    { item: 'crop.wheat', price: 40 },
    { item: 'animal.egg', price: 70 },
  ],
  honey: [
    { item: 'animal.honey', price: 150 },
    { item: 'animal.milk', price: 120 },
    { item: 'dish.honeyCake', price: 380 },
  ],
  smithy: [
    { item: 'res.copper', price: 75 },
    { item: 'res.silver', price: 180 },
    { item: 'res.gold', price: 450 },
    { item: 'res.stone', price: 10 },
    { item: 'res.wood', price: 12 },
  ],
} as const satisfies Record<string, readonly ShopEntry[]>;
export type ShopId = keyof typeof SHOPS;

export function isShopId(v: unknown): v is ShopId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SHOPS, v);
}

export const shopEntries = (shop: ShopId, season: SeasonId): readonly ShopEntry[] =>
  (SHOPS[shop] as readonly ShopEntry[]).filter(e => !e.seasons || e.seasons.includes(season));
