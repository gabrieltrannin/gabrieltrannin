import type { ItemId } from './items';
import type { XZ } from './map';

/**
 * Stage 5: the island rating in stars (docs/GAME_DESIGN.md, "Nota da ilha: quanto mais bonita, mais
 * visitantes e moradores novos"). Points come from decorations (outside counts in full, inside by half),
 * their variety, finished themed collections, the house, the village projects, the museum and the farm.
 */

export const RATING = {
  /** Beauty points of decorations outside; inside they count this much. */
  insideFactor: 0.5,
  /** Points per different kind of decoration placed anywhere. */
  variety: 2,
  /** Points per finished themed collection (every piece placed somewhere). */
  collection: 15,
  /** Points per house level. */
  homeLevel: 10,
  /** Points per finished community project. */
  project: 8,
  /** Points per museum piece. */
  museum: 1,
  /** Points per planted farm tile, up to a limit. */
  crop: 0.5,
  cropMax: 15,
  /** Each part has a ceiling, so no single thing carries the island. */
  outsideMax: 120,
  insideMax: 40,
  varietyMax: 60,
} as const;

/** Points needed for 1 to 5 stars. */
export const STAR_POINTS: readonly number[] = [0, 40, 90, 160, 250];
export const MAX_STARS = 5;

export function starsFor(points: number): number {
  let stars = 1;
  for (let i = 1; i < STAR_POINTS.length; i++) if (points >= STAR_POINTS[i]!) stars = i + 1;
  return Math.min(MAX_STARS, stars);
}

/** Visitors that come over each day: one fewer than the stars (none at one star). */
export const visitorsFor = (stars: number): number => Math.max(0, stars - 1);

/** Where visitors stroll (render only; they are friendly tourists with a line or two). */
export const VISITOR_SPOTS: readonly XZ[] = [
  [9.0, 3.0], [11.8, 2.6], [8.6, 6.4], [3.0, 14.8], [-1.0, 9.0], [29.6, -1.0], [33.0, 3.4], [12.0, 6.6],
];
export const VISITOR_SPECIES = ['hedgehog', 'raccoon', 'mouse', 'duck', 'deer', 'panda'] as const;

/** The player's market stall (docs/GAME_DESIGN.md, "Barraca própria na feira"). */
export const PLAYER_STALL = { x: 13.9, z: 6.9, w: 1.7, d: 1.0 } as const;
/** Where to stand to use it. */
export const PLAYER_STALL_SPOT: XZ = [13.9, 5.85];
export const STALL_SLOTS = 6;
/** Sales happen every hour while the market is open. */
export const STALL_HOURS = { from: 8 * 60, to: 18 * 60 } as const;
/** Chance per hour that a stack sells one piece (more with stars and visitors). */
export const STALL_CHANCE = { base: 0.2, perStar: 0.06 } as const;
/** Price multiplier at the stall: things you make sell better than raw goods. */
export const STALL_PRICE = { made: 1.5, raw: 1.15 } as const;
/** Kinds of items the player makes (they sell for more at the stall). */
export const MADE_KINDS: readonly string[] = ['dish', 'artisan', 'furniture', 'clothing', 'jewelry', 'potion', 'dye'];

/** The pet sniffs out hidden things around the island every day (docs, "Bichinho companheiro"). */
export const DIG_SPOTS: readonly { at: XZ; area: 'grass' | 'beach' | 'village' | 'wood' }[] = [
  { at: [-6.0, 0.7], area: 'grass' },
  { at: [2.0, 9.4], area: 'grass' },
  { at: [-15.4, 0.4], area: 'grass' },
  { at: [-8.4, -2.6], area: 'grass' },
  { at: [-12.6, -9.6], area: 'grass' },
  { at: [-4.4, -9.4], area: 'grass' },
  { at: [2.0, 7.4], area: 'grass' },
  { at: [-2.0, 14.6], area: 'beach' },
  { at: [6.0, 15.2], area: 'beach' },
  { at: [-6.4, 15.6], area: 'beach' },
  { at: [15.6, 13.4], area: 'beach' },
  { at: [-17.4, 4.0], area: 'beach' },
  { at: [27.0, 1.4], area: 'village' },
  { at: [42.4, -6.4], area: 'village' },
  { at: [35.2, 12.8], area: 'village' },
  { at: [31.0, -25.6], area: 'wood' },
  { at: [38.4, -21.0], area: 'wood' },
];
export const DIGS_PER_DAY = 3;
export const DIG_REACH = 1.6;
/** How close the player must be for the pet to notice something. */
export const SNIFF_RANGE = 6;

/** What can be dug up in each kind of place, with weights. */
export const DIG_LOOT: Record<'grass' | 'beach' | 'village' | 'wood', readonly (readonly [ItemId, number, number])[]> = {
  grass: [['seed.strawberry', 3, 10], ['seed.carrot', 3, 10], ['flower.daisy', 2, 10], ['res.copper', 2, 8], ['res.fossil', 1, 3], ['book.kitchen', 1, 2], ['book.carpentry', 1, 2], ['pet.bow', 1, 2], ['furn.hayBale', 1, 3], ['furn.birdhouse', 1, 2]],
  beach: [['furn.sandcastle', 1, 6], ['furn.lifebuoy', 1, 4], ['furn.surfboard', 1, 3], ['furn.shellLamp', 1, 3], ['res.fossil', 1, 4], ['fish.crab', 1, 6], ['book.alchemy', 1, 2]],
  village: [['flower.tulip', 2, 8], ['res.silver', 1, 5], ['book.knitting', 1, 3], ['pet.bell', 1, 2], ['furn.chalkboard', 1, 3], ['furn.fruitCrate', 1, 3]],
  wood: [['res.fossil', 1, 8], ['res.crystal', 1, 3], ['res.gold', 1, 4], ['book.jewelry', 1, 3], ['pet.flowerCrown', 1, 2], ['furn.lantern', 1, 2]],
};

/** Moving in: villagers that arrive when the island reaches some stars, and where they set up camp. */
export const NEWCOMER_STARS: Record<string, number> = { mel: 3, gaspar: 5 };
