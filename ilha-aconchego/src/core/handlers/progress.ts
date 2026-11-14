import { achievementById } from '../../data/achievements';
import { EMOTE_POINTS, isEmoteId } from '../../data/emotes';
import { INVENTORY_SIZE, ITEMS } from '../../data/items';
import { DIG_REACH, MADE_KINDS, PLAYER_STALL_SPOT, STALL_CHANCE, STALL_PRICE, STALL_SLOTS, visitorsFor } from '../../data/rating';
import { talentById } from '../../data/talents';
import { isNpcId } from '../../data/villagers';
import { QUALITY_PRICE } from '../../data/items';
import { absoluteDay } from '../clock';
import { changed, gained, hasRoom, isInt, near, playerOf, PLAYERS, RESIDENTS, type HandlersFor } from '../commandKit';
import type { GameEvent } from '../commands';
import { addItem, spaceFor, takeFromSlot } from '../inventory';
import { bump } from '../progress';
import { levelOf, roll } from '../rules';
import { chance, talent } from '../talents';
import type { GameState, ItemStack } from '../types';
import { isPresent } from '../villagers';
import { addPoints, nearNpc } from './village';

/**
 * Stage 5: the player's market stall, the talent tree, titles, the pet's finds and accessories,
 * emotes and photos (docs/GAME_DESIGN.md, "Talentos e progressão" and "Personagem e companheiro").
 */

type ProgressCommands =
  | 'stall.put' | 'stall.take' | 'talent.choose' | 'title.set' | 'pet.dig' | 'pet.dress' | 'pet.undress' | 'emote' | 'photo.taken';

const STALL_REACH = 2.0;
const slotOk = (n: unknown): n is number => isInt(n) && n >= 0 && n < INVENTORY_SIZE;

/** What one piece sells for at the player's stall. */
export function stallPrice(state: Readonly<GameState>, playerId: string, stack: ItemStack): number {
  const player = state.players[playerId];
  const made = MADE_KINDS.includes(ITEMS[stack.item].kind);
  const bonus = player ? 1 + talent(player, 'stallPrice') / 100 : 1;
  return Math.round(ITEMS[stack.item].sell * (made ? STALL_PRICE.made : STALL_PRICE.raw) * (QUALITY_PRICE[stack.q ?? 0] ?? 1) * bonus);
}

/** One hour of the market: each stack on display may sell one piece (stars, visitors and talents help). */
export function stallHour(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  for (const [playerId, stall] of Object.entries(state.stalls)) {
    const player = state.players[playerId];
    if (!player) continue;
    const odds = STALL_CHANCE.base + STALL_CHANCE.perStar * (state.stars - 1) + 0.02 * visitorsFor(state.stars) + chance(player, 'stallChance');
    for (const stack of [...stall.items]) {
      if (roll(state) >= odds) continue;
      const coins = stallPrice(state, playerId, stack);
      stack.qty -= 1;
      if (stack.qty <= 0) stall.items.splice(stall.items.indexOf(stack), 1);
      player.coins += coins;
      bump(player, 'stallSold');
      bump(player, 'earned', coins);
      events.push({ type: 'stall.sold', playerId, item: stack.item, coins }, { type: 'stall.changed', playerId }, { type: 'player.changed', playerId });
    }
  }
  return events;
}

export const progressHandlers: HandlersFor<ProgressCommands> = {
  'stall.put': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!near(player, PLAYER_STALL_SPOT, STALL_REACH)) return 'too_far';
      if (!slotOk(cmd.slot) || !isInt(cmd.qty) || cmd.qty < 1) return 'invalid';
      const stack = player.inventory[cmd.slot];
      if (!stack || stack.qty < cmd.qty) return 'invalid';
      if (ITEMS[stack.item].sell <= 0 || ITEMS[stack.item].kind === 'tool') return 'not_available';
      const items = state.stalls[actor.id]?.items ?? [];
      const merge = items.some(s => s.item === stack.item && (s.q ?? 0) === (stack.q ?? 0));
      return merge || items.length < STALL_SLOTS ? null : 'occupied';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const taken = takeFromSlot(player.inventory, cmd.slot, cmd.qty)!;
      const stall = (state.stalls[actor.id] ??= { items: [] });
      const same = stall.items.find(s => s.item === taken.item && (s.q ?? 0) === (taken.q ?? 0));
      if (same) same.qty += taken.qty;
      else stall.items.push(taken);
      return [{ type: 'stall.changed', playerId: actor.id }, ...changed(actor.id)];
    },
  },

  'stall.take': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!near(player, PLAYER_STALL_SPOT, STALL_REACH)) return 'too_far';
      const items = state.stalls[actor.id]?.items ?? [];
      if (!isInt(cmd.index) || cmd.index < 0 || cmd.index >= items.length) return 'invalid';
      const stack = items[cmd.index]!;
      return spaceFor(player.inventory, stack.item, stack.q ?? 0) >= stack.qty ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const [stack] = state.stalls[actor.id]!.items.splice(cmd.index, 1);
      addItem(player.inventory, stack!.item, stack!.qty, stack!.q ?? 0);
      return [{ type: 'stall.changed', playerId: actor.id }, ...changed(actor.id)];
    },
  },

  'talent.choose': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const t = talentById(cmd.talent);
      if (!t) return 'invalid';
      if (levelOf(player, t.skill) < t.level) return 'not_available';
      const prefix = `${t.skill}.${t.level}.`;
      return player.talents.some(id => id.startsWith(prefix)) ? 'already' : null;
    },
    apply(state, cmd, actor) {
      state.players[actor.id]!.talents.push(cmd.talent);
      return [{ type: 'talent.chosen', playerId: actor.id, talent: cmd.talent }, { type: 'player.changed', playerId: actor.id }];
    },
  },

  'title.set': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (cmd.title === null) return null;
      const a = achievementById(cmd.title);
      return a?.title && player.achievements.includes(a.id) ? null : 'invalid';
    },
    apply(state, cmd, actor) {
      state.players[actor.id]!.title = cmd.title;
      return [{ type: 'player.changed', playerId: actor.id }];
    },
  },

  'pet.dig': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const spot = state.hidden.find(h => h.id === cmd.id);
      if (!spot) return 'invalid';
      if (!near(player, [spot.x, spot.z], DIG_REACH)) return 'too_far';
      return hasRoom(player.inventory, spot.item, spot.qty) ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const index = state.hidden.findIndex(h => h.id === cmd.id);
      const [spot] = state.hidden.splice(index, 1);
      const qty = addItem(player.inventory, spot!.item, spot!.qty);
      bump(player, 'petFinds');
      return [{ type: 'pet.found', playerId: actor.id, item: spot!.item, qty }, { type: 'hidden.changed' }, gained(actor.id, spot!.item, qty), ...changed(actor.id)];
    },
  },

  'pet.dress': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!slotOk(cmd.slot)) return 'invalid';
      const stack = player.inventory[cmd.slot];
      if (!stack || ITEMS[stack.item].kind !== 'petwear') return 'invalid';
      // The accessory it wore comes back to the backpack.
      if (player.pet.accessory && stack.qty > 1 && !hasRoom(player.inventory, player.pet.accessory)) return 'inventory_full';
      return null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const item = takeFromSlot(player.inventory, cmd.slot, 1)!.item;
      // The one it wore goes back where the new one was (that slot is free now if it had only one).
      if (player.pet.accessory) addItem(player.inventory, player.pet.accessory, 1);
      player.pet.accessory = item;
      return [{ type: 'pet.changed', playerId: actor.id }, ...changed(actor.id)];
    },
  },

  'pet.undress': {
    roles: PLAYERS,
    validate(state, _cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!player.pet.accessory) return 'not_available';
      return hasRoom(player.inventory, player.pet.accessory) ? null : 'inventory_full';
    },
    apply(state, _cmd, actor) {
      const player = state.players[actor.id]!;
      addItem(player.inventory, player.pet.accessory!, 1);
      player.pet.accessory = null;
      return [{ type: 'pet.changed', playerId: actor.id }, ...changed(actor.id)];
    },
  },

  emote: {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!isEmoteId(cmd.emote)) return 'invalid';
      if (cmd.npc === undefined) return null;
      if (!isNpcId(cmd.npc) || !isPresent(state, cmd.npc)) return 'invalid';
      return nearNpc(state, player, cmd.npc) ? null : 'too_far';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      bump(player, 'emotes');
      let points = 0;
      if (cmd.npc) {
        const friend = player.friends[cmd.npc];
        const today = absoluteDay(state.time);
        if (friend.emoteDay !== today) {
          friend.emoteDay = today;
          points = EMOTE_POINTS;
          addPoints(friend, points);
        }
      }
      return [{ type: 'emoted', playerId: actor.id, emote: cmd.emote, ...(cmd.npc ? { npc: cmd.npc } : {}), points }];
    },
  },

  'photo.taken': {
    roles: PLAYERS,
    validate(state, _cmd, actor) {
      return playerOf(state, actor) ? null : 'forbidden';
    },
    apply(state, _cmd, actor) {
      bump(state.players[actor.id]!, 'photos');
      return [{ type: 'photo.saved', playerId: actor.id }];
    },
  },
};
