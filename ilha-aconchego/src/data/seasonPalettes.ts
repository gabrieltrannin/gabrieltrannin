import type { SeasonId } from './calendar';

/**
 * Colors of each season (docs/GAME_DESIGN.md, Direção de arte): grass, leaves, paths and soil.
 * Strings are CSS colors for the canvas painter; numbers are material colors.
 */
export interface SeasonPalette {
  grass: string;
  grassBlades: readonly string[];
  /** Little clover/flower dots on the grass; null hides them. */
  grassSpecks: readonly string[] | null;
  path: string;
  pathSpecks: readonly string[];
  pathEdge: string;
  soil: string;
  soilEdge: string;
  mortar: string;
  stones: readonly string[];
  curb: string;
  stone: string;
  /** Rounded grass lip along the cliff tops. */
  lip: number;
  leaf: number;
  /** Blossom trees: pink in spring, normal leaves otherwise. */
  blossom: number;
  pine: number;
  bush: number;
  hedge: number;
  tallGrass: readonly number[];
  /** Share of the flowers that stay visible (1 = all, 0 = none). */
  flowers: number;
  fruitOnTrees: boolean;
  /** Falling petals or leaves; null for none. */
  drift: number | null;
  /** Ground color shown on the minimap. */
  map: string;
}

const base = {
  path: '#CFA46E',
  pathSpecks: ['#BF935D', '#DDB585', '#B08250', '#D6AE7B'],
  pathEdge: 'rgba(95,62,30,.85)',
  soil: '#7A5236',
  soilEdge: '#5E3E28',
  mortar: '#8F8A80',
  stones: ['#BDB7AB', '#B0AA9E', '#C8C2B6', '#A59F93'],
  curb: '#9C968A',
  stone: '#CDC7BB',
  fruitOnTrees: true,
} as const;

export const SEASON_PALETTES: Record<SeasonId, SeasonPalette> = {
  spring: {
    ...base,
    grass: '#7DC35B',
    grassBlades: ['#6CB64C', '#8ED06A', '#5DA745', '#9DD979', '#74BD54'],
    grassSpecks: ['#FFFFFF', '#FFE680', '#F7B6C8'],
    lip: 0x7dc35b,
    leaf: 0x6cbb52,
    blossom: 0xf6b3cb,
    pine: 0x3b8a5e,
    bush: 0x5bae4a,
    hedge: 0x4e9a44,
    tallGrass: [0x5fae48, 0x4e9e3e, 0x6cbb52, 0x57a843],
    flowers: 1,
    drift: 0xf7a8c4,
    map: '#7DC35B',
  },
  summer: {
    ...base,
    grass: '#62B24A',
    grassBlades: ['#55A63F', '#73C058', '#4A9838', '#7FCB62', '#5BAD44'],
    grassSpecks: ['#FFFFFF', '#FFE680'],
    lip: 0x62b24a,
    leaf: 0x4fa544,
    blossom: 0x5db25a,
    pine: 0x2f7d57,
    bush: 0x4c9e3e,
    hedge: 0x438f3b,
    tallGrass: [0x4c9e3e, 0x3f8f35, 0x5bae4a, 0x46983c],
    flowers: 1,
    drift: null,
    map: '#62B24A',
  },
  autumn: {
    ...base,
    grass: '#B3B35A',
    grassBlades: ['#A6A64E', '#C4C46A', '#9A9A45', '#CFC27A', '#B8A95A'],
    grassSpecks: ['#E8913A', '#D9653B'],
    path: '#C79C68',
    lip: 0xb3b35a,
    leaf: 0xe8913a,
    blossom: 0xd9653b,
    pine: 0x3f7a5a,
    bush: 0xb8682f,
    hedge: 0x7c8a3e,
    tallGrass: [0xb8a95a, 0xa6a64e, 0xc9b26a, 0x9a9a45],
    flowers: 0.4,
    drift: 0xe58a3a,
    map: '#B3B35A',
  },
  winter: {
    ...base,
    grass: '#EDF3F6',
    grassBlades: ['#E1EAEF', '#F8FBFC', '#D6E2E9', '#E9F0F4'],
    grassSpecks: null,
    path: '#D8CCBD',
    pathSpecks: ['#CDBFAE', '#E3D9CC'],
    pathEdge: 'rgba(120,110,100,.55)',
    soil: '#B9AA9A',
    soilEdge: '#9C8E80',
    mortar: '#A9A7A3',
    stones: ['#D7D5D0', '#CBC9C4', '#E1DFDA'],
    curb: '#B5B3AE',
    stone: '#DAD7D0',
    lip: 0xedf3f6,
    leaf: 0xe3ecef,
    blossom: 0xe3ecef,
    pine: 0x5e8f7e,
    bush: 0xdde7ea,
    hedge: 0xc9d9dd,
    tallGrass: [0xdde7ea, 0xc9d6dc, 0xe9f0f3, 0xd2dee3],
    flowers: 0,
    fruitOnTrees: false,
    drift: null,
    map: '#EDF3F6',
  },
};
