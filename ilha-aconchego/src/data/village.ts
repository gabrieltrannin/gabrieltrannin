import type { RoundedRect, XZ } from './map';

/**
 * Stage 4: the village islet to the east (12 houses, the museum, Flora's seed shop and the notice
 * board) and the little wood to its north, behind the old bridge. 1 unit = 1 tile, like data/map.
 */

export interface Islet {
  id: 'village' | 'wood';
  beach: RoundedRect & { bottom: number; top: number };
  main: RoundedRect & { top: number };
  /** Area its ground texture covers. */
  ground: { x0: number; z0: number; x1: number; z1: number };
}

export const VILLAGE_ISLET: Islet = {
  id: 'village',
  beach: { x0: 23.4, z0: -13.6, x1: 46, z1: 15.2, r: 4, bottom: -1.2, top: 0.35 },
  main: { x0: 25, z0: -12.2, x1: 44.6, z1: 13.8, r: 2.5, top: 1.4 },
  ground: { x0: 23, z0: -14, x1: 47, z1: 16 },
};

export const WOOD_ISLET: Islet = {
  id: 'wood',
  beach: { x0: 27, z0: -30, x1: 43, z1: -17.4, r: 3.5, bottom: -1.2, top: 0.35 },
  main: { x0: 28.4, z0: -28.6, x1: 41.6, z1: -18.6, r: 2.2, top: 1.4 },
  ground: { x0: 26, z0: -31, x1: 44, z1: -16 },
};

export const ISLETS: readonly Islet[] = [VILLAGE_ISLET, WOOD_ISLET];

/** Wooden bridges at the height of the main level. The old one is broken until the community fixes it. */
export interface Bridge {
  id: 'new' | 'old';
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  deck: number;
  /** Runs along x (east-west) or z (north-south). */
  along: 'x' | 'z';
}

export const BRIDGES: readonly Bridge[] = [
  { id: 'new', x0: 16.4, z0: -3.55, x1: 25.6, z1: -2.05, deck: 1.4, along: 'x' },
  { id: 'old', x0: 33.8, z0: -18.9, x1: 35.2, z1: -11.9, deck: 1.4, along: 'z' },
];
/** The missing planks of the old bridge (blocked until the "bridge" project is done). */
export const OLD_BRIDGE_GAP = { x0: 33.8, z0: -16.4, x1: 35.2, z1: -14.4 } as const;

/** Village houses: one per villager, facing south (+z). */
export interface HouseSpot {
  npc: string;
  x: number;
  z: number;
}
const ROW_X = [28.6, 32.6, 36.6, 40.6];
export const HOUSE_SPOTS: readonly HouseSpot[] = [
  ...['lumi', 'pipo', 'celeste', 'bento'].map((npc, i) => ({ npc, x: ROW_X[i]!, z: -9.0 })),
  ...['flora', 'dudu', 'margo', 'tico'].map((npc, i) => ({ npc, x: ROW_X[i]!, z: 6.2 })),
  ...['juca', 'lino', 'perola', 'nico'].map((npc, i) => ({ npc, x: ROW_X[i]!, z: 10.4 })),
];
export const HOUSE_SIZE = { w: 2.6, d: 2.1 } as const;
export const houseDoor = (h: HouseSpot): XZ => [h.x, h.z + HOUSE_SIZE.d / 2 + 0.35];

export const MUSEUM = { x: 38.0, z: -1.6, w: 6.0, d: 3.6 } as const;
export const MUSEUM_DOOR: XZ = [38.0, 0.75];
export const SEED_SHOP = { x: 30.4, z: 1.6, w: 3.0, d: 2.0 } as const;
export const SEED_SHOP_COUNTER: XZ = [30.4, 3.1];
export const NOTICE_BOARD: XZ = [28.0, -4.6];
export const WELL: XZ = [31.0, -4.1];
/** Lino's sign by the broken bridge. */
export const BRIDGE_SIGN: XZ = [33.2, -11.4];

/** Paths painted on the village ground. */
export const VILLAGE_PATHS: readonly { width: number; points: readonly XZ[] }[] = [
  { width: 1.6, points: [[25.2, -2.8], [33.5, -2.8], [33.5, 0.9], [38, 0.9]] },
  { width: 1.4, points: [[26.6, -6.2], [26.6, 12.4]] },
  { width: 1.3, points: [[26.6, -6.2], [42.6, -6.2]] },
  { width: 1.3, points: [[26.6, 8.0], [42.6, 8.0]] },
  { width: 1.3, points: [[26.6, 12.3], [42.6, 12.3]] },
  { width: 1.3, points: [[34.5, -6.2], [34.5, -12.0]] },
  { width: 1.2, points: [[30.4, 3.6], [26.6, 3.6]] },
];
export const VILLAGE_PLAZA: RoundedRect = { x0: 26.0, z0: -4.6, x1: 32.6, z1: -1.0, r: 0.8 };
export const WOOD_PATHS: readonly { width: number; points: readonly XZ[] }[] = [
  { width: 1.3, points: [[34.5, -19.0], [34.5, -23.0], [30.5, -24.5]] },
  { width: 1.2, points: [[34.5, -23.0], [39.0, -25.5]] },
];

/** Trees, rocks and stumps of the wood (it only becomes reachable when the old bridge is fixed). */
export const WOOD_TREES: readonly (readonly [number, number, number, string])[] = [
  [30.0, -20.4, 0.9, 'tree.apple'], [38.6, -20.2, 0.9, 'tree.cherry'], [31.2, -27.2, 0.85, 'tree.pear'], [37.6, -27.4, 0.9, 'tree.orange'],
  [40.6, -23.4, 0.8, 'tree.pine'], [29.0, -23.0, 0.8, 'tree.pine'], [35.8, -27.8, 0.7, 'tree.pine'],
];
export const WOOD_NODES: readonly XZ[] = [[32.4, -22.2], [37.2, -22.8], [33.6, -26.4]];
export const WOOD_STUMPS: readonly XZ[] = [[39.8, -26.4], [30.2, -25.8]];

/** Village decoration: trees, bushes, lamps, benches. */
export const VILLAGE_TREES: readonly (readonly [number, number, number, string])[] = [
  [42.8, -2.2, 0.85, 'tree.round'], [26.2, -10.9, 0.8, 'tree.blossom'], [43.4, 3.4, 0.85, 'tree.pine'], [34.8, 3.2, 0.7, 'tree.round'],
  [43.6, -10.2, 0.8, 'tree.pine'],
];
export const VILLAGE_LAMPS: readonly XZ[] = [[26.0, -1.6], [32.6, -4.4], [34.6, 7.4], [25.9, 9.4], [42.6, 8.7], [39.0, -5.2]];
