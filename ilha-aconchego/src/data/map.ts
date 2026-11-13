/**
 * Layout of the starting island (docs/GAME_DESIGN.md, "Mapa inicial"). 1 unit = 1 tile.
 * x grows to the right (east), z grows toward the camera (south). Ground levels:
 * sea 0.12, beach 0.35, main level 1.4, upper level 2.8.
 *
 * Pure data: the world builder reads it, and stage 2 will use the same numbers for collision.
 */

export type XZ = readonly [x: number, z: number];

export interface RoundedRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Corner radius, or [back-left, back-right, front-right, front-left]. */
  r: number | readonly [number, number, number, number];
}

export const SEA_LEVEL = 0.12;

export const LEVELS = {
  beach: { x0: -19.5, z0: -14.5, x1: 19.5, z1: 17, r: 4.5, bottom: -1.2, top: 0.35 },
  main: { x0: -17, z0: -12.5, x1: 17, z1: 13, r: 2.5, top: 1.4 },
  upper: { x0: -17, z0: -12.5, x1: 17, z1: -6.5, r: [2.5, 2.5, 0.9, 0.9] as const, top: 2.8 },
} as const;

/** Area the ground texture covers (x from -20 to 20, z from -16 to 16). */
export const GROUND_AREA = { x0: -20, z0: -16, x1: 20, z1: 16 } as const;

/** Earth ramp from the upper level (z = -6.5) down to the main level. */
export const RAMP = { x0: 5.45, x1: 8.05, zTop: -6.5, zBottom: -3.4 } as const;

/** Wooden stairs from the main level down to the beach. */
export const STAIRS = { x0: 9.1, x1: 10.9, z0: 13.02, z1: 14.95, steps: 5 } as const;

export const PIER = { x0: 9.2, x1: 10.8, z0: 15.2, z1: 22.4, deck: 0.62 } as const;

export const HOUSE = { x: -12.4, z: -3.9, radius: 2.0 } as const;
/** Where the chimney smoke comes out, relative to the house. */
export const HOUSE_CHIMNEY = { x: 0.9, y: 4.25, z: -0.45 } as const;

export interface Bed {
  id: 'NW' | 'NE' | 'SW' | 'SE';
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Where the crop sign stands. */
  sign: XZ;
}

/** Four farm beds in a cross, cut by paths (4 x 3 planting spots each). */
export const BEDS: readonly Bed[] = [
  { id: 'NW', x0: -8, z0: -3.6, x1: -3.8, z1: -0.4, sign: [-7.3, -0.22] },
  { id: 'NE', x0: -2.2, z0: -3.6, x1: 2, z1: -0.4, sign: [1.3, -0.22] },
  { id: 'SW', x0: -8, z0: 1.4, x1: -3.8, z1: 4.6, sign: [-7.3, 4.98] },
  { id: 'SE', x0: -2.2, z0: 1.4, x1: 2, z1: 4.6, sign: [1.3, 4.98] },
];
export const BED_COLUMNS = 4;
export const BED_ROWS = 3;

/** Log fence around the farm: [from, to] segments, with gates on the central path. */
export const FENCE_LINES: readonly (readonly [XZ, XZ])[] = [
  [[-8.8, -4.4], [-3.95, -4.4]],
  [[-2.05, -4.4], [2.8, -4.4]],
  [[-8.8, -4.4], [-8.8, 5.4]],
  [[2.8, -4.4], [2.8, 5.4]],
  [[-8.8, 5.4], [-3.95, 5.4]],
  [[-2.05, 5.4], [2.8, 5.4]],
];
export const FENCE_GATE_POSTS: readonly XZ[] = [[-3.9, -4.4], [-2.1, -4.4], [-3.9, 5.4], [-2.1, 5.4]];

/** String lights over the farm paths: poles and the pole pairs a string hangs between. */
export const LIGHT_POLES: readonly XZ[] = [
  [-3.9, -4.4], [-3.68, -0.28], [-3.68, 1.28], [-3.9, 5.4],
  [-2.1, -4.4], [-2.32, -0.28], [-2.32, 1.28], [-2.1, 5.4],
  [-8.5, -0.28], [-8.5, 1.28], [2.5, -0.28], [2.5, 1.28],
];
export const LIGHT_STRINGS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [1, 5], [2, 6], [1, 8], [2, 9], [5, 10], [6, 11],
];
export const LIGHT_POLE_HEIGHT = 2.35;

export interface PathStroke {
  width: number;
  points: readonly XZ[];
}

/** Dirt paths painted on the ground (soft dark edges are added by the painter). */
export const PATHS: readonly PathStroke[] = [
  { width: 1.5, points: [[-12.4, -1.6], [-12.4, 7.5]] },
  { width: 1.75, points: [[-15.6, 7.6], [-6, 7.5], [5.6, 7.5]] },
  { width: 1.6, points: [[-3, -5.4], [-3, 7.5]] },
  { width: 1.5, points: [[-8.6, 0.5], [2.6, 0.5]] },
  { width: 1.5, points: [[-3, -5], [4.5, -5], [6.75, -3.5]] },
  { width: 1.6, points: [[6.75, -3.5], [7.4, -1.6]] },
  { width: 1.3, points: [[-15.4, -7.4], [6.75, -7.4], [6.75, -6.4]] },
  { width: 1.4, points: [[10, 8.2], [10, 13.1]] },
  // Stage 3: to the animal pen gate and to Bento's smithy.
  { width: 1.1, points: [[-8.5, 7.5], [-8.5, 11.15], [-9.8, 11.15]] },
  { width: 1.2, points: [[6.9, -3.55], [10.6, -3.5]] },
];
/** Round dirt clearings: [x, z, radiusX, radiusZ]. */
export const CLEARINGS: readonly (readonly [number, number, number, number])[] = [
  [-12.4, -1.3, 1.7, 1.0],
  [-3, 0.5, 1.4, 1.3],
];

export const PLAZA: RoundedRect = { x0: 5, z0: -2.2, x1: 15.5, z1: 8.6, r: 0.8 };

export const STEPPING_STONES: readonly XZ[] = [
  [0.2, 9.1], [0.45, 9.75], [-0.1, 11.7], [0.3, 12.4], [9.6, -9.0], [10.1, -8.4], [-3.4, 8.9], [-2.9, 9.4],
];

export const TALL_GRASS = { x0: -7.8, z0: 9.0, x1: -4.6, z1: 12.3, spacing: 0.42 } as const;
/** The tall grass is cut in patches (3 x 2); each one gives hay and grows back after a few days. */
export const GRASS_PATCHES = { columns: 3, rows: 2 } as const;
export function grassPatchOf(x: number, z: number): number {
  const c = Math.min(GRASS_PATCHES.columns - 1, Math.max(0, Math.floor(((x - TALL_GRASS.x0) / (TALL_GRASS.x1 - TALL_GRASS.x0)) * GRASS_PATCHES.columns)));
  const r = Math.min(GRASS_PATCHES.rows - 1, Math.max(0, Math.floor(((z - TALL_GRASS.z0) / (TALL_GRASS.z1 - TALL_GRASS.z0)) * GRASS_PATCHES.rows)));
  return r * GRASS_PATCHES.columns + c;
}
export function grassPatchCenter(index: number): XZ {
  const c = index % GRASS_PATCHES.columns, r = Math.floor(index / GRASS_PATCHES.columns);
  return [TALL_GRASS.x0 + ((c + 0.5) / GRASS_PATCHES.columns) * (TALL_GRASS.x1 - TALL_GRASS.x0), TALL_GRASS.z0 + ((r + 0.5) / GRASS_PATCHES.rows) * (TALL_GRASS.z1 - TALL_GRASS.z0)];
}

/** Market square: three stalls along the back edge. */
export const STALLS: readonly { asset: 'stall.bread' | 'stall.honey' | 'stall.flowers'; at: XZ }[] = [
  { asset: 'stall.bread', at: [7.2, -1.0] },
  { asset: 'stall.honey', at: [10.3, -1.0] },
  { asset: 'stall.flowers', at: [13.4, -1.0] },
];
/** Hedges as boxes [x0, z0, x1, z1]. */
export const HEDGES: readonly (readonly [number, number, number, number])[] = [
  [4.85, -1.6, 5.55, 5.7],
  [5.4, 7.95, 8.6, 8.65],
  [11.4, 7.95, 15.3, 8.65],
  [15.5, -1.4, 16.2, 6.8],
];
export const GLOBE_LAMPS: readonly XZ[] = [[5.7, -1.7], [15.0, -1.7], [5.7, 6.0], [8.9, 8.2], [11.1, 8.2], [15.0, 8.0]];
export const GROUND_LANTERNS: readonly XZ[] = [[-4.35, 5.8], [-1.65, 5.8], [-4.35, -4.8], [-1.65, -4.8], [-13.4, -1.1], [-11.4, -1.1]];

export interface PropPlacement {
  asset: string;
  at: XZ;
  /** Rotation around the vertical axis, in radians. */
  ry?: number;
  scale?: number;
}

/** Single props placed by asset name. Heights come from the terrain. */
export const PROPS: readonly PropPlacement[] = [
  { asset: 'house.hut', at: [HOUSE.x, HOUSE.z] },
  { asset: 'mailbox', at: [-9.6, -1.3] },
  { asset: 'barrel', at: [-8.9, -5.6] },
  { asset: 'barrel', at: [-8.3, -5.95], ry: 1.2, scale: 0.92 },
  { asset: 'sack', at: [-15.8, -3.0] },
  { asset: 'sack', at: [-15.45, -3.5], ry: 0.8, scale: 0.9 },
  { asset: 'pump.water', at: [-9.9, 1.0] },
  { asset: 'wheelbarrow', at: [-1.2, 6.15] },
  { asset: 'scarecrow', at: [3.9, 2.6] },
  { asset: 'bench', at: [0.3, 10.7] },
  { asset: 'crate.orange', at: [6.0, 0.9] },
  { asset: 'crate.apple', at: [14.6, 0.7] },
  { asset: 'table.cafe', at: [7.8, 4.0] },
  { asset: 'table.cafe', at: [12.8, 4.2], ry: 0.3 },
  { asset: 'plant.potted', at: [10.3, 5.4] },
  { asset: 'silo', at: [10.6, -10.2] },
  { asset: 'windmill', at: [14.0, -9.7] },
  { asset: 'beehive', at: [3.8, -10.7] },
  { asset: 'beehive', at: [4.8, -10.7] },
  { asset: 'boat', at: [7.9, 20.6] },
  { asset: 'snowman', at: [-7.6, 8.4], ry: 0.4 },
  { asset: 'pumpkin.deco', at: [-13.6, -1.4] },
  { asset: 'pumpkin.deco', at: [-11.2, -1.35], ry: 1.3, scale: 0.8 },
];

/** Trees: [x, z, scale]. The orchard grows the island's native fruit. */
export const ORCHARD: readonly (readonly [number, number, number])[] = [
  [-14.4, -9.6, 0.95], [-10.6, -9.6, 0.95], [-6.8, -9.6, 0.95], [-3.0, -9.6, 0.95], [0.8, -9.6, 0.95],
];
export const ROUND_TREES: readonly (readonly [number, number, number])[] = [[4.0, -1.6, 0.8], [-6.5, 11.0, 0.9]];
export const BLOSSOM_TREES: readonly (readonly [number, number, number])[] = [[-0.4, -5.9, 0.8], [4.3, 11.2, 0.85]];
export const PINES: readonly (readonly [number, number, number])[] = [
  [-16.2, 0.8, 1], [-16.0, 4.6, 0.9], [16.2, -4.6, 0.95], [15.9, 11.4, 1], [11.4, 12.1, 0.8],
  [-16.0, -11.0, 1], [2.2, -11.6, 0.9], [16.1, -8.1, 0.9], [-16.1, -8.0, 0.85],
];
/** Palms on the beach: [x, z, scale, lean direction in radians]. */
export const PALMS: readonly (readonly [number, number, number, number])[] = [
  [-15.2, 15.3, 1, 0], [16.4, 14.9, 1, Math.PI], [-4.2, 15.7, 0.8, 0.4],
];
export const BUSHES: readonly XZ[] = [
  [-7.0, -5.6], [-9.6, 6.1], [-3.0, 12.2], [6.9, 11.9], [-16.3, 7.0], [10.9, 10.2], [4.4, -8.9], [-12.2, -7.4],
];
/** Beach rocks: [x, z, size]. */
export const ROCKS: readonly (readonly [number, number, number])[] = [
  [-12, 16.2, 0.55], [-11.3, 16.6, 0.4], [5, 16.4, 0.5], [15.3, 16.3, 0.6], [18.6, 8, 0.7], [-18.8, 4, 0.6], [-18.7, -6, 0.7], [18.8, -3, 0.65], [7.2, 16.5, 0.35],
];

/** Flower patches: [x, z, count, radius, colors?]. */
export const FLOWER_PATCHES: readonly (readonly [number, number, number, number, (readonly string[])?])[] = [
  [-14.6, -0.6, 7, 0.7], [-10.4, -0.6, 5, 0.5], [-11, 6.2, 7, 0.7], [-6.4, 6.05, 5, 0.35], [1.8, 6.05, 5, 0.35],
  [-2.0, 10.6, 7, 0.8], [2.4, 10.5, 7, 0.8], [-4.6, 12.1, 6, 0.7], [1.2, 12.4, 6, 0.6], [7.4, 10.4, 6, 0.7],
  [11.9, 9.4, 6, 0.6], [4.6, -3.2, 5, 0.5], [8.6, -8.1, 8, 0.8, ['#FFFFFF', '#FFE680']],
];
/** A row of white and yellow flowers along the edge of the upper level. */
export const UPPER_FLOWER_ROW = { x0: -15.8, x1: 4.6, z: -7.0, step: 0.55 } as const;
export const FLOWER_COLORS = ['#F27BA5', '#FFD166', '#FFFFFF', '#B892FF', '#FF8C69'] as const;

/** Centre of the island for the overview camera, and the area it should fit on screen. */
export const OVERVIEW = { x: 0, z: 3.5, width: 41, depth: 38 } as const;

/** Standing spot just outside the house door; going to bed works from here (the interior arrives in stage 5). */
export const HOUSE_DOOR: XZ = [HOUSE.x, HOUSE.z + 2.75];
/** How close a player must be to the door to go to bed. */
export const BED_REACH = 2.2;

/** Where a new player appears: on the path in front of the house, facing the camera. */
export const PLAYER_START = { x: HOUSE.x, z: HOUSE.z + 3.6, facing: 0 } as const;

/** How close a player must be to a fruit tree to shake it. */
export const TREE_REACH = 2.2;
export const orchardTreeId = (index: number) => `orchard-${index}`;

/** Places of the first request ("Passeio pela ilha"): visit each one. */
export const TOUR_PLACES: readonly { id: 'beach' | 'orchard' | 'market'; at: XZ; radius: number }[] = [
  { id: 'beach', at: [10, 15.6], radius: 3.2 },
  { id: 'orchard', at: [-6.8, -8.2], radius: 3.4 },
  { id: 'market', at: [10.3, 3.0], radius: 3.6 },
];
export const TOUR_REWARD = 100;

// ---------------------------------------------------------------------------------------------
// Stage 3: farm, animals, water, smithy and the other places of daily work.
// ---------------------------------------------------------------------------------------------

/** A farm tile: one planting spot of a bed (4 x 3 per bed) or of the greenhouse bed (3 x 2). */
export interface FarmTile {
  id: string;
  bed: string;
  x: number;
  z: number;
  /** Size of the tile. */
  w: number;
  d: number;
  /** Column and row inside the bed. */
  col: number;
  row: number;
  greenhouse: boolean;
}

/** The greenhouse on the upper level (glass house with one raised bed inside). */
export const GREENHOUSE = { x: 7.5, z: -10.85, w: 3.4, d: 2.9, door: 1.1 } as const;
export const GREENHOUSE_BED = { id: 'GH', x0: 6.3, z0: -12.0, x1: 8.7, z1: -10.6, columns: 3, rows: 2 } as const;

function bedTiles(id: string, x0: number, z0: number, x1: number, z1: number, columns: number, rows: number, greenhouse: boolean): FarmTile[] {
  const w = (x1 - x0) / columns, d = (z1 - z0) / rows, tiles: FarmTile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      tiles.push({ id: `${id}-${col}-${row}`, bed: id, x: x0 + (col + 0.5) * w, z: z0 + (row + 0.5) * d, w, d, col, row, greenhouse });
    }
  }
  return tiles;
}

export const FARM_TILES: readonly FarmTile[] = [
  ...BEDS.flatMap(b => bedTiles(b.id, b.x0, b.z0, b.x1, b.z1, BED_COLUMNS, BED_ROWS, false)),
  ...bedTiles(GREENHOUSE_BED.id, GREENHOUSE_BED.x0, GREENHOUSE_BED.z0, GREENHOUSE_BED.x1, GREENHOUSE_BED.z1, GREENHOUSE_BED.columns, GREENHOUSE_BED.rows, true),
];
const TILE_BY_ID = new Map(FARM_TILES.map(t => [t.id, t]));
export const farmTile = (id: unknown): FarmTile | undefined => (typeof id === 'string' ? TILE_BY_ID.get(id) : undefined);

/** The farm tile under a point, or null. */
export function farmTileAt(x: number, z: number): FarmTile | null {
  for (const t of FARM_TILES) if (Math.abs(x - t.x) <= t.w / 2 && Math.abs(z - t.z) <= t.d / 2) return t;
  return null;
}

/** How far from a farm tile the player may work on it. */
export const FARM_REACH = 2.4;

/** Animal pen in the south-west: barn and coop along the back, a gate on the east side. */
export const PEN = { x0: -16.4, z0: 8.4, x1: -9.2, z1: 12.7, gate: [10.6, 11.7] as const } as const;
export const BARN = { x: -14.6, z: 9.6, w: 3.2, d: 2.2 } as const;
export const COOP = { x: -11.4, z: 9.3, w: 2.2, d: 1.6 } as const;
/** Where the animals walk around (inside the pen, in front of the buildings). */
export const PEN_YARD = { x0: -15.9, z0: 11.0, x1: -9.8, z1: 12.3 } as const;
export const PEN_REACH = 7;

/** Pond and creek in the south-east; the creek falls off the cliff and crosses the beach to the sea. */
export const POND = { x: 13.2, z: 10.4, rx: 1.9, rz: 1.3 } as const;
export const CREEK: readonly XZ[] = [[13.4, 11.4], [13.7, 12.3], [13.7, 13.0]];
export const CREEK_WIDTH = 0.8;
export const CREEK_BEACH = { x: 13.7, z0: 13.0, z1: 17.6 } as const;

/** The smithy behind the market stalls, where Bento improves tools. */
export const SMITHY = { x: 12.0, z: -4.75, w: 3.4, d: 1.7 } as const;
export const BENTO_SPOT: XZ = [10.0, -3.55];

/** Daily work spots next to the house. */
export const SHIPPING_BIN: XZ = [-9.9, -2.7];
export const KITCHEN: XZ = [-14.6, -2.0];
export const WORKBENCH: XZ = [-10.2, -6.0];
/** Places where a machine can be set down (keg, cheese press, spinning wheel). */
export const MACHINE_PADS: readonly XZ[] = [[1.2, -6.0], [2.4, -6.0], [3.6, -6.0]];
export const STATION_REACH = 1.9;

/** Rocks that can be broken with the pickaxe; they come back a few days later. */
export const MINE_NODES: readonly XZ[] = [
  [12.3, -11.9], [13.6, -11.8], [15.2, -11.5], [-8.7, -11.6], [-1.1, -11.6], [-18.3, 1.5], [-18.4, -1.8], [-18.1, 7.6],
];
/** Old stumps that give wood to the axe; the wood grows back. */
export const STUMPS: readonly XZ[] = [[-15.1, 2.7], [-14.9, 5.9], [-1.4, 12.4], [2.3, -8.3]];
export const WORK_REACH = 1.7;

/** Beehives give honey every few days (the two beehive props). */
export const HIVES: readonly XZ[] = PROPS.filter(p => p.asset === 'beehive').map(p => p.at);
export const HONEY_DAYS = 3;
