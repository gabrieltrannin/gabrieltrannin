import type { ItemId } from './items';
import type { XZ } from './map';
import type { ToolId } from './tools';
import type { NpcId } from './villagers';

/**
 * Stage 6: the regions reached by boat from the pier (docs/GAME_DESIGN.md, "Regiões que se abrem com
 * amizades e ferramentas novas: praia, floresta, vulcão e ilha nas nuvens"). Each one is its own scene with
 * its own look, music and resources. Coordinates are local to the region; its ground is at height 0.
 */

export const REGION_IDS = ['beach', 'forest', 'volcano', 'clouds'] as const;
export type RegionId = (typeof REGION_IDS)[number];
export const isRegionId = (v: unknown): v is RegionId => typeof v === 'string' && (REGION_IDS as readonly string[]).includes(v);

/** Walkable land: rounded rectangles and circles. */
export type Shape = { kind: 'rect'; x0: number; z0: number; x1: number; z1: number; r: number } | { kind: 'circle'; x: number; z: number; r: number };
/** A wall that blocks the way (rocks, brambles, steam); `gate` walls open when the region's puzzle is solved. */
export interface Wall {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  gate?: boolean;
}

export type CreatureKind = 'bubble' | 'moss' | 'ember' | 'puff' | 'dust';
export interface Prop {
  asset: string;
  at: XZ;
  ry?: number;
  scale?: number;
  /** Collision radius (0 = walk through). */
  r?: number;
}

/** Things that can be found at a spot: [item, quantity, weight]. */
export type Loot = readonly (readonly [ItemId, number, number])[];

export type PuzzleDef =
  /** Push blocks (E next to one pushes it a tile away from you) until every plate has a block on it. */
  | { kind: 'push'; bounds: { x0: number; z0: number; x1: number; z1: number }; blocks: readonly XZ[]; plates: readonly XZ[]; chest: XZ }
  /** Press the switches in the right order (`order` lists switch indexes); a wrong one starts over. */
  | { kind: 'switches'; switches: readonly XZ[]; sizes: readonly number[]; order: readonly number[]; chest: XZ }
  /** Ring every bell to wake up a wind current. */
  | { kind: 'bells'; bells: readonly XZ[]; lane: number; chest: XZ };

export interface Unlock {
  hearts?: { npc: NpcId; hearts: number };
  tool?: { tool: ToolId; level: number };
}

export interface RegionDef {
  id: RegionId;
  unlock: readonly Unlock[];
  /** Colors of the region: ground, side, sea (or void), sky, fog and the light. */
  look: { ground: number; ground2: number; side: number; water: number; sky: number; fog: number; light: number; lava?: boolean };
  /** Music theme (audio/music.ts). */
  music: 'beach' | 'forest' | 'volcano' | 'clouds';
  land: readonly Shape[];
  walls: readonly Wall[];
  /** Where the boat waits; where you step off. */
  boat: XZ;
  arrive: XZ;
  props: readonly Prop[];
  /** Spots with something to pick up once a day. */
  forage: readonly { at: XZ; loot: Loot }[];
  /** Rocks for the pickaxe (volcano). */
  nodes: readonly { at: XZ; loot: Loot }[];
  /** Tall grass: a bug or a hidden item once a day. */
  grass: readonly XZ[];
  grassLoot: Loot;
  creatures: readonly { at: XZ; kind: CreatureKind }[];
  puzzle: PuzzleDef;
  /** Wind currents between two pads (both ways); `needs` = only after the puzzle is solved. */
  winds: readonly { a: XZ; b: XZ; needs?: boolean }[];
  /** Prize in the puzzle's chest (once per player). */
  chest: Loot;
}

const pier = (x: number): Shape => ({ kind: 'rect', x0: x - 0.8, z0: 21, x1: x + 0.8, z1: 25.5, r: 0.2 });

export const REGIONS: Record<RegionId, RegionDef> = {
  beach: {
    id: 'beach',
    unlock: [{ hearts: { npc: 'pipo', hearts: 2 } }],
    look: { ground: 0xf1dca4, ground2: 0xe8cf92, side: 0xd9b979, water: 0x3ec6d6, sky: 0xbfe9f7, fog: 0xbfe9f7, light: 0xfff2d8 },
    music: 'beach',
    land: [{ kind: 'rect', x0: 2, z0: 2, x1: 30, z1: 22, r: 5 }, pier(16)],
    walls: [
      // The rocky cove in the north-east corner; its middle stones are the tide gate.
      { x0: 21.6, z0: 2, x1: 22.4, z1: 7.4 }, { x0: 21.6, z0: 6.6, x1: 25, z1: 7.4 }, { x0: 27, z0: 6.6, x1: 30, z1: 7.4 },
      { x0: 25, z0: 6.6, x1: 27, z1: 7.4, gate: true },
    ],
    boat: [16, 24.2],
    arrive: [16, 20.4],
    props: [
      { asset: 'tree.palm', at: [5, 5], r: 0.35 }, { asset: 'tree.palm', at: [8, 15], r: 0.35, ry: 1 }, { asset: 'tree.palm', at: [12, 20], r: 0.35, ry: 2 },
      { asset: 'tree.palm', at: [27, 17], r: 0.35, ry: 3 }, { asset: 'tree.palm', at: [29, 10], r: 0.35, ry: 4 },
      { asset: 'rock', at: [10, 10], r: 0.8, scale: 0.6 }, { asset: 'rock', at: [18, 4], r: 0.8, scale: 0.55 }, { asset: 'rock', at: [21, 20], r: 0.8, scale: 0.5 },
      { asset: 'region.tidepool', at: [6, 13], r: 1.1 }, { asset: 'region.tidepool', at: [13, 17], r: 1.0, scale: 0.85 },
      { asset: 'region.coral', at: [3.6, 19], r: 0.4 }, { asset: 'region.coral', at: [28.4, 20], r: 0.4 },
      { asset: 'region.sign', at: [17.6, 16.4], r: 0.3 },
    ],
    forage: [
      { at: [4, 10], loot: [['shell.scallop', 1, 6], ['shell.cowrie', 1, 4], ['shell.starfish', 1, 3]] },
      { at: [7, 19], loot: [['shell.scallop', 1, 5], ['shell.conch', 1, 3]] },
      { at: [10, 4], loot: [['shell.cowrie', 1, 5], ['shell.starfish', 1, 4]] },
      { at: [14, 13], loot: [['fruit.coconut', 1, 6], ['shell.scallop', 1, 2]] },
      { at: [19, 18], loot: [['shell.conch', 1, 4], ['shell.starfish', 1, 4]] },
      { at: [25, 20], loot: [['shell.scallop', 1, 4], ['shell.nautilus', 1, 1]] },
      { at: [6, 6], loot: [['fruit.coconut', 2, 5]] },
      { at: [28, 4], loot: [['shell.pearl', 1, 2], ['shell.nautilus', 1, 3], ['shell.conch', 1, 4]] },
    ],
    nodes: [],
    grass: [[9, 7], [10.5, 16.5], [24, 16], [27, 13]],
    grassLoot: [['bug.ladybug', 1, 3], ['shell.cowrie', 1, 3], ['seed.wheat', 3, 2], ['fruit.coconut', 1, 2], ['res.hay', 2, 2]],
    creatures: [{ at: [9, 12], kind: 'bubble' }, { at: [20, 15], kind: 'bubble' }, { at: [15, 7], kind: 'bubble' }],
    puzzle: { kind: 'push', bounds: { x0: 17, z0: 9, x1: 28, z1: 16 }, blocks: [[20, 11], [24, 13]], plates: [[19, 13], [25, 10]], chest: [27, 4] },
    winds: [],
    chest: [['shell.pearl', 1, 1]],
  },

  forest: {
    id: 'forest',
    unlock: [{ tool: { tool: 'axe', level: 2 }, hearts: { npc: 'flora', hearts: 2 } }],
    look: { ground: 0x6fb85a, ground2: 0x5ea64c, side: 0x8a6a45, water: 0x2f8f8a, sky: 0xcfe7c9, fog: 0xb9d9b0, light: 0xfff0c8 },
    music: 'forest',
    land: [{ kind: 'rect', x0: 2, z0: 2, x1: 30, z1: 22, r: 4 }, pier(16)],
    walls: [
      // Brambles around the hollow in the north-west; the middle bush is the gate.
      { x0: 8.6, z0: 2, x1: 9.4, z1: 7.4 }, { x0: 2, z0: 6.6, x1: 4, z1: 7.4 }, { x0: 6, z0: 6.6, x1: 9.4, z1: 7.4 },
      { x0: 4, z0: 6.6, x1: 6, z1: 7.4, gate: true },
    ],
    boat: [16, 24.2],
    arrive: [16, 20.4],
    props: [
      ...([[7, 3.5], [12, 4], [25, 4], [28, 6], [3.5, 10], [29, 13], [4, 17], [28, 19], [10, 9], [22.5, 10.5], [13, 15.5], [19, 5.5]] as const).map(([x, z], i) => ({ asset: 'region.bigTree', at: [x, z] as XZ, r: 0.8, ry: i, scale: 0.9 + (i % 3) * 0.12 })),
      { asset: 'region.mushrooms', at: [17, 10], r: 0.4 }, { asset: 'region.mushrooms', at: [6, 20], r: 0.4 }, { asset: 'region.log', at: [24, 15], r: 0.9, ry: 0.6 },
      { asset: 'region.sign', at: [11, 12.2], r: 0.3 },
    ],
    forage: [
      { at: [14, 8], loot: [['fruit.blackberry', 3, 6]] }, { at: [24.5, 7], loot: [['fruit.blackberry', 2, 6]] },
      { at: [7, 15], loot: [['fruit.blackberry', 3, 6]] }, { at: [26, 16.5], loot: [['fruit.blackberry', 2, 6]] },
      { at: [11.5, 10.8], loot: [['crop.mushroom', 2, 6], ['res.moss', 1, 2]] }, { at: [18, 12.5], loot: [['crop.mushroom', 1, 6]] },
      { at: [21, 19], loot: [['crop.mushroom', 2, 5], ['res.wood', 5, 3]] }, { at: [5, 4], loot: [['fossil.fern', 1, 3], ['crop.mushroom', 3, 3]] },
    ],
    nodes: [],
    grass: [[18, 15], [22, 17.5], [25.5, 12.5], [6, 11.5], [10, 19], [20, 8.5]],
    grassLoot: [['bug.blueFirefly', 1, 3], ['bug.caterpillar', 1, 2], ['bug.snail', 1, 2], ['crop.mushroom', 1, 2], ['fossil.fern', 1, 1], ['seed.carrot', 2, 2]],
    creatures: [{ at: [15, 11], kind: 'moss' }, { at: [23, 14], kind: 'moss' }, { at: [9, 16], kind: 'moss' }],
    puzzle: { kind: 'switches', switches: [[9, 13], [12.5, 14], [16, 13]], sizes: [2, 0, 1], order: [1, 2, 0], chest: [5, 4] },
    winds: [],
    chest: [['book.knitting', 1, 1]],
  },

  volcano: {
    id: 'volcano',
    unlock: [{ tool: { tool: 'pickaxe', level: 3 }, hearts: { npc: 'bento', hearts: 4 } }],
    look: { ground: 0x5a4b4b, ground2: 0x4a3d3e, side: 0x3a2f30, water: 0xff6a2a, sky: 0xf2b38f, fog: 0xd98d6a, light: 0xffd2a8, lava: true },
    music: 'volcano',
    land: [{ kind: 'rect', x0: 2, z0: 2, x1: 30, z1: 22, r: 4 }, pier(16)],
    walls: [
      // The crater rim in the north-east, closed by a wall of steam until both vents are covered.
      { x0: 21.6, z0: 2, x1: 22.4, z1: 7.4 }, { x0: 21.6, z0: 6.6, x1: 24, z1: 7.4 }, { x0: 28, z0: 6.6, x1: 30, z1: 7.4 },
      { x0: 24, z0: 6.6, x1: 28, z1: 7.4, gate: true },
    ],
    boat: [16, 24.2],
    arrive: [16, 20.4],
    props: [
      { asset: 'region.lava', at: [10, 10], r: 1.8 }, { asset: 'region.lava', at: [13, 4.5], r: 1.4, scale: 0.8 }, { asset: 'region.lava', at: [8, 15], r: 1.4, scale: 0.8 },
      { asset: 'region.basalt', at: [4, 4], r: 0.7 }, { asset: 'region.basalt', at: [28, 20], r: 0.7, ry: 1 }, { asset: 'region.basalt', at: [3.6, 19], r: 0.7, ry: 2 },
      { asset: 'region.vent', at: [26, 4], r: 0.5 }, { asset: 'region.sign', at: [17.6, 17.6], r: 0.3 },
    ],
    forage: [
      { at: [5, 13], loot: [['fossil.ammonite', 1, 3], ['fossil.trilobite', 1, 2], ['res.obsidian', 1, 4]] },
      { at: [24, 19.5], loot: [['fossil.tooth', 1, 2], ['fossil.feather', 1, 2], ['res.obsidian', 1, 4]] },
      { at: [27, 3.5], loot: [['fossil.egg', 1, 2], ['res.fireCrystal', 1, 3]] },
    ],
    nodes: [
      { at: [6, 7], loot: [['res.obsidian', 2, 5], ['res.stone', 3, 3]] }, { at: [6, 18.5], loot: [['res.gold', 1, 4], ['res.silver', 2, 3]] },
      { at: [14, 7.5], loot: [['res.fireCrystal', 1, 3], ['res.crystal', 1, 2]] }, { at: [19.5, 19.5], loot: [['res.gold', 2, 3], ['fossil.ammonite', 1, 1]] },
      { at: [27, 14], loot: [['res.crystal', 1, 3], ['res.obsidian', 2, 3]] }, { at: [28.4, 17.4], loot: [['res.fireCrystal', 1, 2], ['fossil.trilobite', 1, 1]] },
    ],
    grass: [[12.5, 13.5], [26, 10.5]],
    grassLoot: [['bug.lavaBeetle', 1, 3], ['res.ember', 1, 2], ['res.obsidian', 1, 2]],
    creatures: [{ at: [10, 14], kind: 'ember' }, { at: [19, 11], kind: 'ember' }, { at: [24, 17], kind: 'ember' }],
    puzzle: { kind: 'push', bounds: { x0: 16, z0: 11, x1: 24, z1: 17 }, blocks: [[17, 12], [22, 15]], plates: [[18, 14], [20, 16]], chest: [27, 4] },
    winds: [],
    chest: [['res.fireCrystal', 3, 1]],
  },

  clouds: {
    id: 'clouds',
    unlock: [{ tool: { tool: 'bugNet', level: 2 }, hearts: { npc: 'juca', hearts: 4 } }],
    look: { ground: 0xfbfbff, ground2: 0xeef0ff, side: 0xdfe3f7, water: 0xa8d8f5, sky: 0xc9e8ff, fog: 0xd8efff, light: 0xffffff },
    music: 'clouds',
    land: [
      { kind: 'circle', x: 16, z: 19, r: 4.6 }, { kind: 'circle', x: 6, z: 11, r: 3.6 }, { kind: 'circle', x: 16, z: 9.5, r: 3.4 },
      { kind: 'circle', x: 26, z: 11, r: 3.6 }, { kind: 'circle', x: 16, z: -1, r: 3.0 }, pier(16),
    ],
    walls: [],
    boat: [16, 24.2],
    arrive: [16, 20.4],
    props: [
      { asset: 'region.rainbow', at: [16, 16.4], r: 0 }, { asset: 'region.starLamp', at: [12.6, 19.5], r: 0.25 }, { asset: 'region.starLamp', at: [19.4, 19.5], r: 0.25 },
      { asset: 'region.cloudPuff', at: [3.4, 10.2], r: 0.6 }, { asset: 'region.cloudPuff', at: [28.2, 12.2], r: 0.6, ry: 2 }, { asset: 'region.crystalPillar', at: [18, 8.5], r: 0.4 },
      { asset: 'region.sign', at: [14.4, 9.6], r: 0.3 },
    ],
    forage: [
      { at: [6, 9.4], loot: [['res.stardust', 1, 5], ['res.cloudCotton', 2, 3]] }, { at: [26, 13], loot: [['res.stardust', 1, 5]] },
      { at: [17.2, 10.6], loot: [['res.stardust', 1, 4], ['res.crystal', 1, 1]] }, { at: [13.6, 20.6], loot: [['res.cloudCotton', 2, 6]] },
      { at: [18.6, 21], loot: [['res.cloudCotton', 2, 6]] }, { at: [4.4, 12.4], loot: [['res.cloudCotton', 3, 5]] },
    ],
    nodes: [],
    grass: [[19.4, 18], [7.4, 12.6], [24.6, 10]],
    grassLoot: [['bug.cloudMoth', 1, 3], ['res.cloudCotton', 1, 3], ['res.stardust', 1, 1]],
    creatures: [{ at: [15, 18], kind: 'puff' }, { at: [16, 10.5], kind: 'puff' }],
    puzzle: { kind: 'bells', bells: [[5, 10], [27, 10]], lane: 3, chest: [16, -1.6] },
    winds: [
      { a: [12.7, 16.9], b: [8.6, 12.8] },
      { a: [16, 15.0], b: [16, 12.5] },
      { a: [19.3, 16.9], b: [23.4, 12.8] },
      { a: [16, 6.6], b: [16, 1.4], needs: true },
    ],
    chest: [['res.stardust', 5, 1]],
  },
};

/** Where the boat waits at the home island's pier (the "boat" prop), and where you step back on land. */
export const HOME_BOAT: XZ = [8.9, 20.6];
export const HOME_LANDING: XZ = [10.0, 20.2];
export const BOAT_REACH = 2.4;
export const DOCK_REACH = 2.6;
export const FORAGE_REACH = 1.6;
export const NODE_REACH = 1.7;
export const GRASS_REACH = 1.4;
export const PUZZLE_REACH = 1.5;
/** A creature's spot (they wander around it). */
export const CREATURE_REACH = 7;
/** Energy lost when a creature bumps into you. */
export const BUMP_ENERGY = 6;
export const WIND_REACH = 0.9;

/** What each kind of creature leaves behind when calmed. */
export const CREATURE_DROPS: Record<CreatureKind, Loot> = {
  bubble: [['res.jelly', 1, 4], ['shell.scallop', 1, 1]],
  moss: [['res.moss', 1, 4], ['crop.mushroom', 1, 1]],
  ember: [['res.ember', 1, 4], ['res.obsidian', 1, 1]],
  puff: [['res.puff', 1, 4], ['res.stardust', 1, 1]],
  dust: [['res.stone', 2, 3], ['res.copper', 1, 2], ['res.jelly', 1, 1]],
};
/** Bubbles it takes to calm each creature. */
export const CREATURE_HITS = 3;
