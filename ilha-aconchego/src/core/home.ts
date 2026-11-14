import { DIG_LOOT, DIG_SPOTS, DIGS_PER_DAY } from '../data/rating';
import { STARTING_HOME, type FloorId } from '../data/house';
import type { ItemId } from '../data/items';
import { pickWeighted, roll } from './rules';
import { islandTalent } from './talents';
import type { GameState, HomeState, PlacedDecor, PlayerState } from './types';

/** Stage 5 parts of a new player and a new island; also used to bring older saves up to date. */

export function newHome(): HomeState {
  const ground: PlacedDecor[] = STARTING_HOME.map((d, i) => ({ id: i + 1, item: d.item, x: d.x, z: d.z, rot: d.rot }));
  return { level: 0, floors: { ground }, seq: ground.length };
}

export function newPlayerHome(inventory: PlayerState['inventory']): Pick<PlayerState, 'inside' | 'home' | 'recipes' | 'wardrobe' | 'talents' | 'stats' | 'discovered' | 'achievements' | 'title' | 'pet'> {
  return {
    inside: null,
    home: newHome(),
    recipes: [],
    wardrobe: { outfits: [], accessories: [], colors: [] },
    talents: [],
    stats: {},
    discovered: [...new Set(inventory.filter(s => s !== null).map(s => s!.item))],
    achievements: [],
    title: null,
    pet: { accessory: null },
  };
}

export function newIslandHome(): Pick<GameState, 'decor' | 'decorSeq' | 'stars' | 'stalls' | 'hidden' | 'hiddenSeq' | 'arrived'> {
  return { decor: [], decorSeq: 0, stars: 1, stalls: {}, hidden: [], hiddenSeq: 0, arrived: [] };
}

/** Buries today's finds for the pet: a few spots, each with something from its kind of place. */
export function rollHidden(state: GameState): void {
  const spots = DIG_SPOTS.filter(s => s.area !== 'wood' || state.projects.bridge.done);
  const count = Math.min(spots.length, DIGS_PER_DAY + islandTalent(state, 'petFind'));
  const pool = [...spots];
  state.hidden = [];
  for (let i = 0; i < count && pool.length; i++) {
    const spot = pool.splice(Math.floor(roll(state) * pool.length), 1)[0]!;
    const loot = DIG_LOOT[spot.area];
    const pick = pickWeighted(state, loot.map(([item, qty, w]) => [[item, qty] as const, w] as const));
    if (!pick) continue;
    state.hiddenSeq += 1;
    state.hidden.push({ id: state.hiddenSeq, x: spot.at[0], z: spot.at[1], item: pick[0] as ItemId, qty: pick[1] });
  }
}

/** All the floors a player's house has furniture on. */
export const homeFloors = (player: PlayerState): FloorId[] => Object.keys(player.home.floors) as FloorId[];
