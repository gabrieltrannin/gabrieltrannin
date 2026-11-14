import { ITEMS, type ItemId } from './items';

/**
 * Stage 5: furniture and decorations (docs/GAME_DESIGN.md, "Ilha e decoração"). Everything sits on a
 * grid of 1 × 1 tiles, outside on the island or inside the house. `w` × `d` is the size before turning
 * (a quarter turn swaps them). Rugs and paths lie flat: you walk over them and can put furniture on top.
 */

export type StationId = 'carpentry' | 'kitchen' | 'knitting' | 'alchemy' | 'jewelry';
export const STATIONS: readonly StationId[] = ['carpentry', 'kitchen', 'knitting', 'alchemy', 'jewelry'];
export const isStationId = (v: unknown): v is StationId => typeof v === 'string' && (STATIONS as readonly string[]).includes(v);

/** Themed collections of the catalog. */
export type CollectionId = 'cozy' | 'craft' | 'garden' | 'beach' | 'farm' | 'market' | 'festival';
export const COLLECTIONS: readonly CollectionId[] = ['cozy', 'craft', 'garden', 'beach', 'farm', 'market', 'festival'];
/** Island stars needed before a collection can be ordered from the catalog (festival prizes are never sold). */
export const COLLECTION_STARS: Record<CollectionId, number> = { cozy: 1, craft: 1, garden: 1, beach: 2, farm: 2, market: 3, festival: 99 };
/** Collections that count as "themed" for achievements, titles and the island rating. */
export const THEMED: readonly CollectionId[] = ['beach', 'farm', 'market'];

/** What happens when you press E next to it. */
export type DecorUse = 'bed' | 'mirror' | 'wardrobe' | 'station' | 'sit';

export interface DecorDef {
  w: number;
  d: number;
  /** Inside the house, outside on the island, or both. */
  where: 'in' | 'out' | 'any';
  collection: CollectionId;
  /** How much it adds to the island rating (1 to 5). */
  beauty: number;
  /** Price in the catalog. */
  price: number;
  /** Flat on the floor: no collision, and furniture may stand on it. */
  flat?: boolean;
  use?: DecorUse;
  station?: StationId;
  /** Gives light at night. */
  light?: boolean;
}

const d = (w: number, dd: number, where: DecorDef['where'], collection: CollectionId, beauty: number, price: number, extra: Partial<DecorDef> = {}): DecorDef =>
  ({ w, d: dd, where, collection, beauty, price, ...extra });

export const DECOR = {
  // Aconchego: the basics of a home.
  'furn.bed': d(2, 2, 'in', 'cozy', 2, 900, { use: 'bed' }),
  'furn.table': d(2, 1, 'any', 'cozy', 1, 360),
  'furn.chair': d(1, 1, 'any', 'cozy', 1, 180, { use: 'sit' }),
  'furn.sofa': d(2, 1, 'in', 'cozy', 2, 1200, { use: 'sit' }),
  'furn.bookshelf': d(2, 1, 'in', 'cozy', 2, 600),
  'furn.lamp': d(1, 1, 'any', 'cozy', 1, 280, { light: true }),
  'furn.rug': d(2, 2, 'in', 'cozy', 2, 780, { flat: true }),
  'furn.plant': d(1, 1, 'any', 'cozy', 1, 240),
  'furn.wardrobe': d(2, 1, 'any', 'cozy', 1, 900, { use: 'wardrobe' }),
  'furn.mirror': d(1, 1, 'any', 'cozy', 1, 660, { use: 'mirror' }),
  // Ofícios: the five crafting stations.
  'furn.workbench': d(2, 1, 'any', 'craft', 1, 750, { use: 'station', station: 'carpentry' }),
  'furn.stove': d(1, 1, 'any', 'craft', 1, 900, { use: 'station', station: 'kitchen' }),
  'furn.loom': d(1, 1, 'any', 'craft', 1, 750, { use: 'station', station: 'knitting' }),
  'furn.alchemy': d(1, 1, 'any', 'craft', 1, 750, { use: 'station', station: 'alchemy' }),
  'furn.jeweler': d(1, 1, 'any', 'craft', 1, 750, { use: 'station', station: 'jewelry' }),
  // Jardim: for the island outside.
  'furn.bench': d(2, 1, 'out', 'garden', 2, 600, { use: 'sit' }),
  'furn.streetLamp': d(1, 1, 'out', 'garden', 2, 780, { light: true }),
  'furn.fence': d(1, 1, 'out', 'garden', 1, 60),
  'furn.fountain': d(2, 2, 'out', 'garden', 5, 2700),
  'furn.birdbath': d(1, 1, 'out', 'garden', 2, 540),
  'furn.flowerBed': d(1, 1, 'out', 'garden', 2, 360),
  'furn.stonePath': d(1, 1, 'out', 'garden', 1, 30, { flat: true }),
  // Praia.
  'furn.beachChair': d(1, 2, 'any', 'beach', 3, 780, { use: 'sit' }),
  'furn.parasol': d(1, 1, 'out', 'beach', 3, 660),
  'furn.surfboard': d(1, 1, 'any', 'beach', 3, 720),
  'furn.shellLamp': d(1, 1, 'any', 'beach', 3, 840, { light: true }),
  'furn.sandcastle': d(1, 1, 'out', 'beach', 3, 480),
  'furn.lifebuoy': d(1, 1, 'any', 'beach', 3, 450),
  // Fazenda.
  'furn.hayBale': d(1, 1, 'any', 'farm', 2, 150, { use: 'sit' }),
  'furn.crate': d(1, 1, 'any', 'farm', 2, 120),
  'furn.milkCan': d(1, 1, 'any', 'farm', 3, 450),
  'furn.flowerBox': d(2, 1, 'any', 'farm', 3, 420),
  'furn.miniScarecrow': d(1, 1, 'out', 'farm', 3, 540),
  'furn.birdhouse': d(1, 1, 'out', 'farm', 3, 360),
  // Feira.
  'furn.cafeTable': d(2, 2, 'any', 'market', 4, 780),
  'furn.bunting': d(2, 1, 'out', 'market', 4, 540),
  'furn.fruitCrate': d(1, 1, 'any', 'market', 4, 420),
  'furn.umbrella': d(1, 1, 'out', 'market', 4, 720),
  'furn.chalkboard': d(1, 1, 'any', 'market', 4, 360),
  'furn.lantern': d(1, 1, 'any', 'market', 4, 480, { light: true }),
  // Festival prizes (stage 6): won in the minigames, never sold in the catalog.
  'furn.flowerArch': d(2, 1, 'out', 'festival', 5, 9999),
  'furn.paperLantern': d(1, 1, 'any', 'festival', 5, 9999, { light: true }),
  'furn.jackLantern': d(1, 1, 'any', 'festival', 5, 9999, { light: true }),
  'furn.snowGlobe': d(1, 1, 'any', 'festival', 5, 9999),
} as const satisfies Partial<Record<ItemId, DecorDef>>;

export type DecorItem = keyof typeof DECOR;
export const DECOR_ITEMS = Object.keys(DECOR) as DecorItem[];
export const isDecorItem = (v: unknown): v is DecorItem => typeof v === 'string' && Object.prototype.hasOwnProperty.call(DECOR, v);
export const decorDef = (item: DecorItem): DecorDef => DECOR[item];
/** Catalog price: never cheaper than twice what the item sells for. */
export const catalogPrice = (item: DecorItem): number => Math.max(DECOR[item].price, ITEMS[item].sell * 2);
export const collectionItems = (c: CollectionId): DecorItem[] => DECOR_ITEMS.filter(i => DECOR[i].collection === c);

/** Size on the grid after `rot` quarter turns. */
export function footprintSize(item: DecorItem, rot: number): { w: number; d: number } {
  const def = DECOR[item];
  return rot % 2 === 0 ? { w: def.w, d: def.d } : { w: def.d, d: def.w };
}

/** The 3D model of a decoration. */
export const decorAsset = (item: DecorItem): string => `decor.${item.slice('furn.'.length)}`;
