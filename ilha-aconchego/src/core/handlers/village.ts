import { MUSEUM_EXTRA, MUSEUM_KINDS, PROJECTS, isProjectId } from '../../data/community';
import { INVENTORY_SIZE, ITEMS, isItemId, type ItemId } from '../../data/items';
import { MAILBOX } from '../../data/map';
import { MUSEUM_DOOR, NOTICE_BOARD } from '../../data/village';
import { FRIEND_POINTS, HEART_POINTS, MAX_HEARTS, hearts, isNpcId, villager, type NpcId } from '../../data/villagers';
import { absoluteDay } from '../clock';
import { changed, gained, hasRoom, isInt, near, playerOf, PLAYERS, RESIDENTS, xp, type HandlersFor } from '../commandKit';
import type { GameEvent } from '../commands';
import { addItem, countItem, removeItem, takeFromSlot } from '../inventory';
import type { FriendState, GameState, PlayerState } from '../types';
import { giftPoints, isBirthday, reactionTo, villagerSpot } from '../villagers';

type VillageCommands = 'npc.talk' | 'npc.gift' | 'request.deliver' | 'project.contribute' | 'museum.donate' | 'mail.read' | 'mail.take';

/** Villagers walk between places: the player must be near where they are now or were just before. */
const NPC_REACH = 9;
function nearNpc(state: Readonly<GameState>, player: PlayerState, npc: NpcId): boolean {
  const spot = villagerSpot(state, npc);
  return near(player, spot.at, NPC_REACH) || near(player, spot.previous, NPC_REACH);
}

const MAX_POINTS = HEART_POINTS * MAX_HEARTS;
function addPoints(friend: FriendState, points: number): void {
  friend.points = Math.max(0, Math.min(MAX_POINTS, friend.points + points));
}

/** Heart level of the next special scene, if one is due (every 2 hearts, one at a time). */
export function sceneDue(friend: FriendState): number {
  const next = friend.scene + 2;
  return next <= MAX_HEARTS && hearts(friend.points) >= next ? next : 0;
}

const museumItem = (item: ItemId) => (MUSEUM_KINDS as readonly string[]).includes(ITEMS[item].kind) || MUSEUM_EXTRA.includes(item);

export const villageHandlers: HandlersFor<VillageCommands> = {
  'npc.talk': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!isNpcId(cmd.npc)) return 'invalid';
      return nearNpc(state, player, cmd.npc) ? null : 'too_far';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const friend = player.friends[cmd.npc];
      const today = absoluteDay(state.time);
      const first = friend.talkedDay !== today;
      const before = hearts(friend.points);
      if (first) {
        friend.talkedDay = today;
        addPoints(friend, FRIEND_POINTS.talk);
      }
      const scene = sceneDue(friend);
      if (scene) {
        friend.scene = scene;
        addPoints(friend, 10);
      }
      const events: GameEvent[] = [{ type: 'npc.talked', playerId: actor.id, npc: cmd.npc, first, scene }];
      if (hearts(friend.points) > before) events.push({ type: 'npc.heart', playerId: actor.id, npc: cmd.npc, hearts: hearts(friend.points) });
      return events.concat({ type: 'player.changed', playerId: actor.id }, first ? xp(player, 'charisma', 3) : []);
    },
  },

  'npc.gift': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!isNpcId(cmd.npc) || !isInt(cmd.slot) || cmd.slot < 0 || cmd.slot >= INVENTORY_SIZE) return 'invalid';
      const slot = player.inventory[cmd.slot];
      if (!slot) return 'invalid';
      const kind = ITEMS[slot.item].kind;
      if (kind === 'tool' || kind === 'placeable') return 'not_available';
      if (!nearNpc(state, player, cmd.npc)) return 'too_far';
      return player.friends[cmd.npc].giftDay === absoluteDay(state.time) ? 'already' : null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const friend = player.friends[cmd.npc];
      const item = player.inventory[cmd.slot]!.item;
      const def = villager(cmd.npc);
      const reaction = reactionTo(def, item);
      const birthday = isBirthday(def, state.time);
      const before = hearts(friend.points);
      takeFromSlot(player.inventory, cmd.slot, 1);
      addPoints(friend, giftPoints(reaction, birthday));
      const today = absoluteDay(state.time);
      friend.giftDay = today;
      friend.known[item] = reaction;
      friend.lastGift = { item, day: today };
      const events: GameEvent[] = [{ type: 'npc.gifted', playerId: actor.id, npc: cmd.npc, item, reaction, birthday }, ...changed(actor.id)];
      if (hearts(friend.points) > before) events.push({ type: 'npc.heart', playerId: actor.id, npc: cmd.npc, hearts: hearts(friend.points) });
      return events.concat(xp(player, 'charisma', reaction === 'love' ? 12 : 6));
    },
  },

  'request.deliver': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const request = state.requests.find(r => r.id === cmd.request);
      if (!request || request.done) return 'invalid';
      if (request.until >= 0 && request.until < absoluteDay(state.time)) return 'not_available';
      if (!nearNpc(state, player, request.npc)) return 'too_far';
      return countItem(player.inventory, request.item) >= request.qty ? null : 'missing';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const request = state.requests.find(r => r.id === cmd.request)!;
      removeItem(player.inventory, request.item, request.qty);
      player.coins += request.reward;
      request.done = true;
      const friend = player.friends[request.npc];
      const before = hearts(friend.points);
      addPoints(friend, FRIEND_POINTS.request);
      const events: GameEvent[] = [{ type: 'request.done', playerId: actor.id, request: request.id, npc: request.npc, reward: request.reward }, { type: 'board.changed' }, ...changed(actor.id)];
      if (hearts(friend.points) > before) events.push({ type: 'npc.heart', playerId: actor.id, npc: request.npc, hearts: hearts(friend.points) });
      return events.concat(xp(player, 'charisma', 15));
    },
  },

  'project.contribute': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!isProjectId(cmd.project)) return 'invalid';
      const def = PROJECTS.find(p => p.id === cmd.project)!;
      const project = state.projects[cmd.project];
      if (project.done) return 'not_available';
      if (!near(player, NOTICE_BOARD, 3.2)) return 'too_far';
      if (!isInt(cmd.qty) || cmd.qty < 1) return 'invalid';
      if (cmd.item === 'coins') {
        if (cmd.qty > def.coins - project.coins) return 'invalid';
        return player.coins >= cmd.qty ? null : 'no_money';
      }
      const need = def.needs.find(n => n.item === cmd.item);
      if (!need) return 'invalid';
      if (cmd.qty > need.qty - (project.given[need.item] ?? 0)) return 'invalid';
      return countItem(player.inventory, need.item) >= cmd.qty ? null : 'missing';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const def = PROJECTS.find(p => p.id === cmd.project)!;
      const project = state.projects[cmd.project];
      if (cmd.item === 'coins') {
        player.coins -= cmd.qty;
        project.coins += cmd.qty;
      } else {
        removeItem(player.inventory, cmd.item, cmd.qty);
        project.given[cmd.item] = (project.given[cmd.item] ?? 0) + cmd.qty;
      }
      const events: GameEvent[] = [{ type: 'board.changed' }, ...changed(actor.id), ...xp(player, 'charisma', 2)];
      if (project.coins >= def.coins && def.needs.every(n => (project.given[n.item] ?? 0) >= n.qty)) {
        project.done = true;
        // Everyone gets a thank-you letter from the villager who led the project.
        for (const p of Object.values(state.players)) {
          p.mailSeq += 1;
          p.mail.push({ id: p.mailSeq, from: def.npc, key: `mail.project.${def.id}`, params: {}, taken: false, read: false, day: absoluteDay(state.time) });
        }
        events.push({ type: 'project.done', project: def.id }, { type: 'world.changed' }, { type: 'mail.changed', playerId: actor.id });
      }
      return events;
    },
  },

  'museum.donate': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!state.projects.museum.done) return 'not_available';
      if (!near(player, MUSEUM_DOOR, 3)) return 'too_far';
      if (!isInt(cmd.slot) || cmd.slot < 0 || cmd.slot >= INVENTORY_SIZE) return 'invalid';
      const slot = player.inventory[cmd.slot];
      if (!slot || !museumItem(slot.item)) return 'invalid';
      return state.museum.includes(slot.item) ? 'already' : null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const item = player.inventory[cmd.slot]!.item;
      takeFromSlot(player.inventory, cmd.slot, 1);
      state.museum.push(item);
      addPoints(player.friends.celeste, 15);
      return [{ type: 'museum.donated', playerId: actor.id, item, total: state.museum.length }, ...changed(actor.id), ...xp(player, 'charisma', 5)];
    },
  },

  'mail.read': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      return player.mail.some(m => m.id === cmd.id) ? null : 'invalid';
    },
    apply(state, cmd, actor) {
      state.players[actor.id]!.mail.find(m => m.id === cmd.id)!.read = true;
      return [{ type: 'mail.changed', playerId: actor.id }];
    },
  },

  'mail.take': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      if (!near(player, MAILBOX, 3)) return 'too_far';
      const mail = player.mail.find(m => m.id === cmd.id);
      if (!mail?.item || mail.taken || !isItemId(mail.item)) return 'invalid';
      return hasRoom(player.inventory, mail.item, mail.qty ?? 1) ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const mail = player.mail.find(m => m.id === cmd.id)!;
      const qty = addItem(player.inventory, mail.item!, mail.qty ?? 1);
      mail.taken = true;
      mail.read = true;
      return [{ type: 'mail.changed', playerId: actor.id }, gained(actor.id, mail.item!, qty), ...changed(actor.id)];
    },
  },
};
