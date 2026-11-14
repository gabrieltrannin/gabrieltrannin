import { isValidAppearance, BASE_ACCESSORIES, BASE_OUTFITS, BOTTOM_COLORS, SHOE_COLORS, TOP_COLORS, type Appearance } from '../../data/appearance';
import { DYES, SALON_PRICE, WEARABLE } from '../../data/clothing';
import { catalogPrice, COLLECTION_STARS, DECOR, isDecorItem, type DecorItem } from '../../data/decor';
import { arrivalSpot, DOOR_REACH, DOOR_SPOT, ENTRY_SPOT, floorShape, isFloorId, MAX_HOME_LEVEL, HOME_LEVELS, reservedTiles, STAIRS_REACH, stairsOn, stairsSpot } from '../../data/house';
import { INVENTORY_SIZE, ITEMS, isItemId } from '../../data/items';
import { BED_REACH, HOUSE_DOOR, PLAYER_START } from '../../data/map';
import { absoluteDay } from '../clock';
import { changed, distance, gained, hasRoom, homeDistance, isInt, near, playerOf, PLAYERS, RESIDENTS, type HandlersFor } from '../commandKit';
import type { GameEvent } from '../commands';
import { decorCenter, decorList, DECOR_REACH, placementError, spaceOf, tilesOf, usableNear, type DecorSpace } from '../decor';
import { addItem, countItem, removeItem, spaceFor, takeFromSlot } from '../inventory';
import { bump } from '../progress';
import { nearNpc } from './village';
import { shopOpen } from '../villagers';
import type { GameState, PlacedDecor, PlayerState } from '../types';

/**
 * Stage 5 commands for the house and decorating (docs/GAME_DESIGN.md, "Ilha e decoração"):
 * going in and out, the stairs, growing the house with Lino, placing, moving and putting away
 * furniture, the catalog, the wardrobe, the mirror and Pérola's salon.
 */

type HomeCommands =
  | 'home.enter' | 'home.exit' | 'home.stairs' | 'home.upgrade' | 'decor.place' | 'decor.move' | 'decor.store' | 'catalog.buy'
  | 'wardrobe.store' | 'wardrobe.dye' | 'look.change';

const slotOk = (n: unknown): n is number => isInt(n) && n >= 0 && n < INVENTORY_SIZE;
const spaceKey = (space: DecorSpace): string => (space.kind === 'island' ? 'island' : space.playerId);

/** Can this player reach a spot to decorate it? Outside: within a few steps. Inside: anywhere on the floor they stand on. */
function reaches(player: PlayerState, center: readonly [number, number]): boolean {
  return player.inside ? true : distance(player, center) <= DECOR_REACH;
}

function decorListMut(state: GameState, space: DecorSpace): PlacedDecor[] {
  if (space.kind === 'island') return state.decor;
  const home = state.players[space.playerId]!.home;
  return (home.floors[space.floor] ??= []);
}

/** Things that belong to the island (outside) only change for people who live here. */
function mayDecorate(player: PlayerState, space: DecorSpace, role: string): boolean {
  return space.kind === 'home' ? space.playerId === player.id : role !== 'visitor';
}

/** Fields each way of changing the look may touch. */
const LOOK_FIELDS: Record<'mirror' | 'salon' | 'wardrobe', readonly (keyof Appearance)[]> = {
  mirror: ['eyes', 'eyeColor', 'mouth', 'blush', 'hairStyle', 'hairColor'],
  salon: ['species', 'skin', 'eyes', 'eyeColor', 'mouth', 'blush', 'hairStyle', 'hairColor'],
  wardrobe: ['outfit', 'topColor', 'bottomColor', 'shoes', 'accessory'],
};

function wardrobeAllows(player: PlayerState, a: Appearance): boolean {
  const w = player.wardrobe;
  const color = (base: readonly string[], c: string) => base.includes(c) || w.colors.includes(c);
  return ((BASE_OUTFITS as readonly string[]).includes(a.outfit) || w.outfits.includes(a.outfit))
    && ((BASE_ACCESSORIES as readonly string[]).includes(a.accessory) || w.accessories.includes(a.accessory))
    && color(TOP_COLORS, a.topColor) && color(BOTTOM_COLORS, a.bottomColor) && color(SHOE_COLORS, a.shoes);
}

export const homeHandlers: HandlersFor<HomeCommands> = {
  'home.enter': {
    roles: RESIDENTS,
    validate(state, _cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      return distance(player, HOUSE_DOOR) <= BED_REACH ? null : 'too_far';
    },
    apply(state, _cmd, actor) {
      const player = state.players[actor.id]!;
      player.inside = 'ground';
      player.position = { x: ENTRY_SPOT[0], z: ENTRY_SPOT[1], facing: Math.PI };
      return [{ type: 'home.changed', playerId: actor.id }, { type: 'player.moved', playerId: actor.id }];
    },
  },

  'home.exit': {
    roles: PLAYERS,
    validate(state, _cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (player.inside !== 'ground') return 'not_available';
      return homeDistance(player, DOOR_SPOT) <= DOOR_REACH + 0.4 ? null : 'too_far';
    },
    apply(state, _cmd, actor) {
      const player = state.players[actor.id]!;
      player.inside = null;
      player.position = { ...PLAYER_START };
      return [{ type: 'home.changed', playerId: actor.id }, { type: 'player.moved', playerId: actor.id }];
    },
  },

  'home.stairs': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!player.inside || !isFloorId(cmd.to)) return 'invalid';
      const stairs = stairsOn(player.home.level, player.inside).find(s => s.to === cmd.to);
      if (!stairs) return 'not_available';
      return homeDistance(player, stairsSpot(stairs)) <= STAIRS_REACH ? null : 'too_far';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const [x, z] = arrivalSpot(player.home.level, cmd.to, player.inside!);
      player.inside = cmd.to;
      player.position = { x, z, facing: 0 };
      return [{ type: 'home.changed', playerId: actor.id }, { type: 'player.moved', playerId: actor.id }];
    },
  },

  'home.upgrade': {
    roles: RESIDENTS,
    validate(state, _cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (player.home.level >= MAX_HOME_LEVEL) return 'not_available';
      if (!nearNpc(state, player, 'lino')) return 'too_far';
      const cost = HOME_LEVELS[player.home.level + 1]!.cost!;
      if (player.coins < cost.coins) return 'no_money';
      return cost.items.every(c => countItem(player.inventory, c.item) >= c.qty) ? null : 'missing';
    },
    apply(state, _cmd, actor) {
      const player = state.players[actor.id]!;
      const level = player.home.level + 1;
      const cost = HOME_LEVELS[level]!.cost!;
      player.coins -= cost.coins;
      for (const c of cost.items) removeItem(player.inventory, c.item, c.qty);
      player.home.level = level;
      // New stairs need their tiles: whatever stood there goes back to the backpack (or the mailbox).
      for (const [floor, list] of Object.entries(player.home.floors)) {
        if (!isFloorId(floor) || !list) continue;
        const reserved = reservedTiles(level, floor);
        player.home.floors[floor] = list.filter(p => {
          if (!isDecorItem(p.item)) return false;
          const blocked = tilesOf(p.item, p.x, p.z, p.rot).some(([tx, tz]) => reserved.some(([rx, rz]) => rx === tx && rz === tz));
          if (!blocked) return true;
          if (addItem(player.inventory, p.item, 1) < 1) {
            player.mailSeq += 1;
            player.mail.push({ id: player.mailSeq, from: 'lino', key: 'mail.moved', params: {}, item: p.item, qty: 1, taken: false, read: false, day: absoluteDay(state.time) });
          }
          return false;
        });
      }
      for (const floor of Object.keys(HOME_LEVELS[level]!.floors)) if (isFloorId(floor)) player.home.floors[floor] ??= [];
      return [{ type: 'home.upgraded', playerId: actor.id, level }, { type: 'home.changed', playerId: actor.id }, { type: 'decor.changed', space: actor.id }, ...changed(actor.id)];
    },
  },

  'decor.place': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!slotOk(cmd.slot)) return 'invalid';
      const stack = player.inventory[cmd.slot];
      if (!stack || !isDecorItem(stack.item)) return 'invalid';
      const space = spaceOf(player);
      if (!mayDecorate(player, space, actor.role)) return 'forbidden';
      const error = placementError(state, space, stack.item, cmd.x, cmd.z, cmd.rot);
      if (error) return error;
      return reaches(player, decorCenter({ item: stack.item, x: cmd.x, z: cmd.z, rot: cmd.rot })) ? null : 'too_far';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const space = spaceOf(player);
      const item = takeFromSlot(player.inventory, cmd.slot, 1)!.item;
      const list = decorListMut(state, space);
      let id: number;
      if (space.kind === 'island') id = ++state.decorSeq;
      else id = ++player.home.seq;
      list.push({ id, item, x: cmd.x, z: cmd.z, rot: cmd.rot, ...(space.kind === 'island' ? { by: actor.id } : {}) });
      bump(player, 'decorPlaced');
      return [{ type: 'decor.changed', space: spaceKey(space) }, ...changed(actor.id)];
    },
  },

  'decor.move': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const space = spaceOf(player);
      if (!mayDecorate(player, space, actor.role)) return 'forbidden';
      const placed = decorList(state, space).find(p => p.id === cmd.id);
      if (!placed || !isDecorItem(placed.item)) return 'invalid';
      const error = placementError(state, space, placed.item, cmd.x, cmd.z, cmd.rot, placed.id);
      if (error) return error;
      return reaches(player, decorCenter(placed)) && reaches(player, decorCenter({ item: placed.item, x: cmd.x, z: cmd.z, rot: cmd.rot })) ? null : 'too_far';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const space = spaceOf(player);
      const placed = decorListMut(state, space).find(p => p.id === cmd.id)!;
      placed.x = cmd.x;
      placed.z = cmd.z;
      placed.rot = cmd.rot;
      return [{ type: 'decor.changed', space: spaceKey(space) }];
    },
  },

  'decor.store': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const space = spaceOf(player);
      if (!mayDecorate(player, space, actor.role)) return 'forbidden';
      const placed = decorList(state, space).find(p => p.id === cmd.id);
      if (!placed) return 'invalid';
      if (!reaches(player, decorCenter(placed))) return 'too_far';
      return hasRoom(player.inventory, placed.item) ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const space = spaceOf(player);
      const list = decorListMut(state, space);
      const index = list.findIndex(p => p.id === cmd.id);
      const [placed] = list.splice(index, 1);
      addItem(player.inventory, placed!.item, 1);
      return [{ type: 'decor.changed', space: spaceKey(space) }, ...changed(actor.id)];
    },
  },

  'catalog.buy': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!isDecorItem(cmd.item) || !isInt(cmd.qty) || cmd.qty < 1 || cmd.qty > 10) return 'invalid';
      if (state.stars < COLLECTION_STARS[DECOR[cmd.item].collection]) return 'not_available';
      if (player.coins < catalogPrice(cmd.item) * cmd.qty) return 'no_money';
      return spaceFor(player.inventory, cmd.item) >= cmd.qty ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const item = cmd.item as DecorItem;
      player.coins -= catalogPrice(item) * cmd.qty;
      addItem(player.inventory, cmd.item, cmd.qty);
      return [gained(actor.id, cmd.item, cmd.qty), ...changed(actor.id)];
    },
  },

  'wardrobe.store': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!slotOk(cmd.slot)) return 'invalid';
      const stack = player.inventory[cmd.slot];
      const piece = stack ? WEARABLE[stack.item] : undefined;
      if (!piece) return 'invalid';
      const owned = 'outfit' in piece ? player.wardrobe.outfits.includes(piece.outfit) : player.wardrobe.accessories.includes(piece.accessory);
      return owned ? 'already' : null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const piece = WEARABLE[player.inventory[cmd.slot]!.item]!;
      takeFromSlot(player.inventory, cmd.slot, 1);
      if ('outfit' in piece) player.wardrobe.outfits.push(piece.outfit);
      else player.wardrobe.accessories.push(piece.accessory);
      return [{ type: 'wardrobe.changed', playerId: actor.id }, ...changed(actor.id)];
    },
  },

  'wardrobe.dye': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!slotOk(cmd.slot)) return 'invalid';
      const stack = player.inventory[cmd.slot];
      const color = stack ? DYES[stack.item] : undefined;
      if (!color) return 'invalid';
      return player.wardrobe.colors.includes(color) ? 'already' : null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const color = DYES[player.inventory[cmd.slot]!.item]!;
      takeFromSlot(player.inventory, cmd.slot, 1);
      player.wardrobe.colors.push(color);
      return [{ type: 'wardrobe.changed', playerId: actor.id }, ...changed(actor.id)];
    },
  },

  'look.change': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (cmd.via !== 'mirror' && cmd.via !== 'wardrobe' && cmd.via !== 'salon') return 'invalid';
      if (!isValidAppearance(cmd.appearance)) return 'invalid';
      const allowed = LOOK_FIELDS[cmd.via];
      const keys = Object.keys(player.appearance) as (keyof Appearance)[];
      if (keys.some(k => !allowed.includes(k) && cmd.appearance[k] !== player.appearance[k])) return 'invalid';
      if (!keys.some(k => cmd.appearance[k] !== player.appearance[k])) return 'invalid';
      if (cmd.via === 'wardrobe') {
        if (!wardrobeAllows(player, cmd.appearance)) return 'not_available';
        return usableNear(state, player, 'wardrobe') ? null : 'too_far';
      }
      if (cmd.via === 'mirror') return usableNear(state, player, 'mirror') ? null : 'too_far';
      if (!nearNpc(state, player, 'perola')) return 'too_far';
      if (!shopOpen(state, 'salon')) return 'closed';
      return player.coins >= SALON_PRICE ? null : 'no_money';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const keys = Object.keys(player.appearance) as (keyof Appearance)[];
      player.appearance = Object.fromEntries(keys.map(k => [k, cmd.appearance[k]])) as unknown as Appearance;
      if (cmd.via === 'salon') player.coins -= SALON_PRICE;
      return [{ type: 'player.look', playerId: actor.id }, { type: 'player.changed', playerId: actor.id }];
    },
  },
};

/** Sleep: in a bed at home, or (as before stage 5) at the front door. */
export function canSleep(state: Readonly<GameState>, player: PlayerState): boolean {
  if (player.inside) return !!usableNear(state, player, 'bed');
  return distance(player, HOUSE_DOOR) <= BED_REACH;
}

/** Walking inside: anywhere on the floor the player is on. */
export function insideFloor(player: PlayerState, x: number, z: number): boolean {
  const shape = player.inside ? floorShape(player.home.level, player.inside) : null;
  return !!shape && x >= 0.2 && z >= 0.2 && x <= shape.w - 0.2 && z <= shape.d - 0.1;
}

export { isItemId, ITEMS, near, type GameEvent };
