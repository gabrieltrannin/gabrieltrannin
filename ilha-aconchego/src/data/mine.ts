import type { ItemId } from './items';
import type { XZ } from './map';

/**
 * Stage 6: the mines (docs/GAME_DESIGN.md, "Minas com andares, minérios e cristais"). The entrance is a cave
 * in the cliff of the west beach. Each floor is generated from the island's seed, the floor number and
 * the day (core/mine.ts): rock walls, rocks to break with the pickaxe, creatures, and a ladder hidden
 * under one of the rocks. Every 5 floors there is an elevator stop.
 */

/** The cave in the west cliff of the home island, and where to stand to go in. */
export const MINE_CAVE: XZ = [-17.5, 9.6];
export const MINE_DOOR: XZ = [-18.8, 9.6];
export const MINE_DOOR_REACH = 1.6;

export const MINE_W = 14;
export const MINE_D = 12;
export const MAX_MINE_FLOOR = 30;
export const ELEVATOR_EVERY = 5;
/** Where you arrive on each floor (the rope up and the elevator are here). */
export const MINE_START: XZ = [2.5, 9.5];
export const MINE_START_REACH = 1.6;
export const ROCK_REACH = 1.6;

/** Floors with an elevator stop: 1, 5, 10, 15... */
export const isElevatorFloor = (floor: number): boolean => floor === 1 || floor % ELEVATOR_EVERY === 0;

/** What rocks hold, deeper means richer: [item, quantity, weight]. */
export function rockLoot(floor: number): readonly (readonly [ItemId, number, number])[] {
  if (floor < 10) return [['res.stone', 2, 6], ['res.copper', 1, 5], ['res.silver', 1, 1], ['fossil.fern', 1, 0.4], ['res.fossil', 1, 0.3]];
  if (floor < 20) return [['res.stone', 2, 4], ['res.copper', 1, 3], ['res.silver', 1, 4], ['res.gold', 1, 1], ['fossil.ammonite', 1, 0.5], ['fossil.trilobite', 1, 0.4]];
  return [['res.stone', 2, 3], ['res.silver', 1, 3], ['res.gold', 1, 4], ['res.crystal', 1, 2], ['fossil.tooth', 1, 0.4], ['fossil.egg', 1, 0.3]];
}

/** Rocks with a crystal look give more (shown in a different color). */
export const CRYSTAL_ROCK_CHANCE = 0.12;
/** The treasure at the bottom (once per player). */
export const MINE_TREASURE: readonly (readonly [ItemId, number])[] = [['res.crystal', 5], ['fossil.egg', 1], ['res.gold', 5]];
