import type { BuffId, ItemId, Quality } from '../data/items';
import { DAYS_PER_SEASON, SEASONS, TIME_STEP_MINUTES } from '../data/calendar';
import type { FishSpot } from '../data/fish';
import { fruitItem, HOTBAR_SIZE, INVENTORY_SIZE } from '../data/items';
import { BED_REACH, HOUSE_DOOR, ORCHARD, orchardTreeId, TOUR_PLACES, TOUR_REWARD, TREE_REACH } from '../data/map';
import type { ShopId } from '../data/shops';
import type { SkillId } from '../data/skills';
import type { ToolId } from '../data/tools';
import type { ProjectId } from '../data/community';
import type { NpcId } from '../data/villagers';
import type { WeatherId } from '../data/weather';
import { groundHeight } from '../world/terrain';
import { STEPS_PER_DAY, absoluteDay, advanceSteps, seasonOf } from './clock';
import { distance, isInt, isNum, playerOf, PLAYERS, type Handler } from './commandKit';
import { startNewDay } from './day';
import { economyHandlers } from './handlers/economy';
import { farmHandlers } from './handlers/farm';
import { gatherHandlers } from './handlers/gather';
import { addItem, moveSlot, spaceFor } from './inventory';
import { nextInt } from './rng';
import type { Actor, GameState, GameTime, GiftReaction } from './types';
import { villageHandlers } from './handlers/village';
import { isWeatherId } from './weather';

/**
 * Every change to the game goes through one of these commands.
 * The multiplayer server (stage 7) will run this same file, so commands must be plain JSON.
 */
export type Command =
  /** System only: the clock moved forward by whole 10-minute steps. */
  | { type: 'time.advance'; steps: number }
  /** System only: set the time of day directly ("Horário real" option, server sync, test panel). */
  | { type: 'time.sync'; minuteOfDay: number }
  /** System only: jump to a season and day (test panel, server sync). Keeps the time of day. */
  | { type: 'time.setDate'; seasonIndex: number; day: number }
  /** System only: change today's weather (test panel, server sync). */
  | { type: 'weather.set'; weather: WeatherId }
  /** Go to bed at home: the next day starts at 06:00 with newly rolled weather and full energy. */
  | { type: 'sleep' }
  /** The player's character moved (sent every so often while walking, not every frame). */
  | { type: 'player.move'; x: number; z: number; facing: number }
  /** Pick a slot of the item bar. */
  | { type: 'inventory.select'; slot: number }
  /** Drag an item to another backpack slot (swap, or merge equal items). */
  | { type: 'inventory.move'; from: number; to: number }
  /** Shake a fruit tree of the orchard: 1 to 3 fruits, once a day, not in winter. */
  | { type: 'tree.shake'; treeId: string }
  /** The player reached one of the places of the first request. */
  | { type: 'place.visit'; placeId: string }
  // Farm (stage 3). `tile` is a farm tile id from data/map (FARM_TILES).
  | { type: 'farm.till'; tile: string }
  | { type: 'farm.plant'; tile: string; item: ItemId }
  | { type: 'farm.water'; tile: string }
  | { type: 'farm.harvest'; tile: string }
  | { type: 'farm.fertilize'; tile: string; item: 'supply.fertilizer' | 'supply.growth' }
  | { type: 'farm.sprinkler'; tile: string }
  | { type: 'greenhouse.repair' }
  // Gathering.
  | { type: 'grass.cut'; patch: number }
  | { type: 'node.mine'; node: string }
  | { type: 'stump.chop'; stump: string }
  | { type: 'hive.collect'; hive: string }
  | { type: 'bug.catch'; item: ItemId }
  /** Cast the line: the fish on the hook is rolled now; the minigame decides if it is caught. */
  | { type: 'fishing.cast'; spot: FishSpot }
  | { type: 'fishing.finish'; caught: boolean }
  // Animals.
  | { type: 'animal.feed'; animal: string }
  | { type: 'animal.pet'; animal: string }
  | { type: 'animal.collect'; animal: string }
  // Food, making things, buying and selling.
  | { type: 'item.eat'; slot: number }
  | { type: 'cook'; recipe: string }
  | { type: 'craft'; recipe: string }
  | { type: 'shop.buy'; shop: ShopId; item: ItemId; qty: number }
  | { type: 'ship.add'; slot: number; qty: number }
  | { type: 'ship.take'; index: number }
  | { type: 'tool.upgrade'; tool: ToolId }
  | { type: 'machine.place'; pad: number; slot: number }
  | { type: 'machine.load'; pad: number; slot: number }
  | { type: 'machine.collect'; pad: number }
  // Village (stage 4).
  | { type: 'npc.talk'; npc: NpcId }
  | { type: 'npc.gift'; npc: NpcId; slot: number }
  | { type: 'request.deliver'; request: number }
  | { type: 'project.contribute'; project: ProjectId; item: ItemId | 'coins'; qty: number }
  | { type: 'museum.donate'; slot: number }
  | { type: 'mail.read'; id: number }
  | { type: 'mail.take'; id: number };

export type CommandType = Command['type'];

export type GameEvent =
  | { type: 'time.changed'; time: GameTime }
  | { type: 'day.ended'; time: GameTime }
  | { type: 'day.started'; time: GameTime; newSeason: boolean; newYear: boolean; weather: WeatherId }
  | { type: 'date.changed'; time: GameTime }
  | { type: 'weather.changed'; weather: WeatherId }
  | { type: 'player.moved'; playerId: string }
  | { type: 'inventory.changed'; playerId: string }
  | { type: 'tree.shaken'; playerId: string; treeId: string; item: ItemId; qty: number }
  | { type: 'quest.updated'; questId: string; done: boolean; reward: number }
  /** Coins, energy, tool levels or today's bonus changed. */
  | { type: 'player.changed'; playerId: string }
  | { type: 'item.gained'; playerId: string; item: ItemId; qty: number; q: Quality }
  | { type: 'skill.up'; playerId: string; skill: SkillId; level: number }
  | { type: 'farm.changed' }
  | { type: 'farm.watered'; tiles: string[] }
  | { type: 'farm.withered' }
  | { type: 'farm.rained' }
  /** Rocks, stumps, grass, hives, machines or the greenhouse changed. */
  | { type: 'world.changed' }
  | { type: 'animals.changed' }
  | { type: 'shipping.changed'; playerId: string }
  | { type: 'shipping.paid'; playerId: string; coins: number }
  | { type: 'fishing.cast'; playerId: string; item: ItemId | null }
  | { type: 'fishing.done'; playerId: string; item: ItemId; caught: boolean }
  | { type: 'ate'; playerId: string; item: ItemId; energy: number; buff: BuffId | null }
  | { type: 'made'; playerId: string; item: ItemId; qty: number }
  | { type: 'tool.upgraded'; playerId: string; tool: ToolId; level: number }
  | { type: 'npc.talked'; playerId: string; npc: NpcId; first: boolean; scene: number }
  | { type: 'npc.gifted'; playerId: string; npc: NpcId; item: ItemId; reaction: GiftReaction; birthday: boolean }
  | { type: 'npc.heart'; playerId: string; npc: NpcId; hearts: number }
  | { type: 'request.done'; playerId: string; request: number; npc: NpcId; reward: number }
  | { type: 'board.changed' }
  | { type: 'project.done'; project: ProjectId }
  | { type: 'museum.donated'; playerId: string; item: ItemId; total: number }
  | { type: 'mail.changed'; playerId: string };

export type CommandError =
  | 'unknown_command' | 'forbidden' | 'invalid' | 'day_ended' | 'too_far' | 'inventory_full' | 'not_available'
  | 'tired' | 'no_tool' | 'no_money' | 'missing' | 'not_tilled' | 'occupied' | 'wrong_season' | 'not_ready' | 'already' | 'closed';

export type CommandResult = { ok: true; events: GameEvent[] } | { ok: false; error: CommandError };

type HandlerMap = { [K in CommandType]: Handler<Extract<Command, { type: K }>> };

const orchardIndex = (treeId: unknown) => ORCHARD.findIndex((_, i) => orchardTreeId(i) === treeId);

const baseHandlers = {
  'time.advance': {
    roles: ['system'],
    validate(state, cmd) {
      if (!isInt(cmd.steps) || cmd.steps < 1 || cmd.steps > STEPS_PER_DAY) return 'invalid';
      if (state.time.dayEnded) return 'day_ended';
      return null;
    },
    apply(state, cmd) {
      const r = advanceSteps(state.time, cmd.steps);
      state.time = r.time;
      const events: GameEvent[] = [{ type: 'time.changed', time: { ...state.time } }];
      if (r.reachedDayEnd) events.push({ type: 'day.ended', time: { ...state.time } });
      return events;
    },
  },

  'time.sync': {
    roles: ['system'],
    validate(_state, cmd) {
      if (!isInt(cmd.minuteOfDay) || cmd.minuteOfDay < 0 || cmd.minuteOfDay >= 30 * 60) return 'invalid';
      if (cmd.minuteOfDay % TIME_STEP_MINUTES !== 0) return 'invalid';
      return null;
    },
    apply(state, cmd) {
      state.time = { ...state.time, minuteOfDay: cmd.minuteOfDay, dayEnded: false };
      return [{ type: 'time.changed', time: { ...state.time } }];
    },
  },

  'time.setDate': {
    roles: ['system'],
    validate(_state, cmd) {
      if (!isInt(cmd.seasonIndex) || cmd.seasonIndex < 0 || cmd.seasonIndex >= SEASONS.length) return 'invalid';
      if (!isInt(cmd.day) || cmd.day < 1 || cmd.day > DAYS_PER_SEASON) return 'invalid';
      return null;
    },
    apply(state, cmd) {
      state.time = { ...state.time, seasonIndex: cmd.seasonIndex, day: cmd.day };
      return [{ type: 'date.changed', time: { ...state.time } }];
    },
  },

  'weather.set': {
    roles: ['system'],
    validate(_state, cmd) {
      return isWeatherId(cmd.weather) ? null : 'invalid';
    },
    apply(state, cmd) {
      state.weather = cmd.weather;
      return [{ type: 'weather.changed', weather: state.weather }];
    },
  },

  sleep: {
    // Visitors sleep at home, on their own island. The system (test panel, server) can always end the day.
    roles: ['host', 'resident', 'system'],
    validate(state, _cmd, actor) {
      if (actor.role === 'system') return null;
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      return distance(player, HOUSE_DOOR) <= BED_REACH ? null : 'too_far';
    },
    apply(state) {
      return startNewDay(state);
    },
  },

  'player.move': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      if (!playerOf(state, actor)) return 'forbidden';
      if (!isNum(cmd.x) || !isNum(cmd.z) || !isNum(cmd.facing)) return 'invalid';
      return groundHeight(cmd.x, cmd.z) === null ? 'invalid' : null;
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      player.position = { x: cmd.x, z: cmd.z, facing: cmd.facing % (Math.PI * 2) };
      return [{ type: 'player.moved', playerId: actor.id }];
    },
  },

  'inventory.select': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      if (!playerOf(state, actor)) return 'forbidden';
      return isInt(cmd.slot) && cmd.slot >= 0 && cmd.slot < HOTBAR_SIZE ? null : 'invalid';
    },
    apply(state, cmd, actor) {
      state.players[actor.id]!.activeSlot = cmd.slot;
      return [{ type: 'inventory.changed', playerId: actor.id }];
    },
  },

  'inventory.move': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const ok = (n: unknown) => isInt(n) && n >= 0 && n < INVENTORY_SIZE;
      if (!ok(cmd.from) || !ok(cmd.to) || cmd.from === cmd.to) return 'invalid';
      return player.inventory[cmd.from] ? null : 'invalid';
    },
    apply(state, cmd, actor) {
      moveSlot(state.players[actor.id]!.inventory, cmd.from, cmd.to);
      return [{ type: 'inventory.changed', playerId: actor.id }];
    },
  },

  'tree.shake': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const index = orchardIndex(cmd.treeId);
      if (index < 0) return 'invalid';
      const [x, z] = ORCHARD[index]!;
      if (distance(player, [x, z]) > TREE_REACH) return 'too_far';
      if (seasonOf(state.time) === 'winter') return 'not_available';
      if (state.trees[cmd.treeId]?.shakenDay === absoluteDay(state.time)) return 'not_available';
      return spaceFor(player.inventory, fruitItem(state.island.nativeFruit)) > 0 ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const player = state.players[actor.id]!;
      const roll = nextInt(state.rng, 1, 3);
      state.rng = roll.state;
      const item = fruitItem(state.island.nativeFruit);
      const qty = addItem(player.inventory, item, roll.value);
      state.trees[cmd.treeId] = { shakenDay: absoluteDay(state.time) };
      return [
        { type: 'tree.shaken', playerId: actor.id, treeId: cmd.treeId, item, qty },
        { type: 'inventory.changed', playerId: actor.id },
      ];
    },
  },

  'place.visit': {
    roles: ['host', 'resident'],
    validate(state, cmd, actor) {
      const player = playerOf(state, actor);
      if (!player) return 'forbidden';
      const place = TOUR_PLACES.find(p => p.id === cmd.placeId);
      if (!place) return 'invalid';
      const quest = state.quests.find(q => q.id === 'tour');
      if (!quest || quest.done || quest.visited.includes(place.id)) return 'not_available';
      return distance(player, place.at) <= place.radius ? null : 'too_far';
    },
    apply(state, cmd, actor) {
      const quest = state.quests.find(q => q.id === 'tour')!;
      quest.visited.push(cmd.placeId);
      let reward = 0;
      if (quest.visited.length >= TOUR_PLACES.length) {
        quest.done = true;
        reward = TOUR_REWARD;
        state.players[actor.id]!.coins += reward;
      }
      return [{ type: 'quest.updated', questId: quest.id, done: quest.done, reward }];
    },
  },
} satisfies Partial<HandlerMap>;

const handlers: HandlerMap = { ...baseHandlers, ...farmHandlers, ...gatherHandlers, ...economyHandlers, ...villageHandlers };

/**
 * The single entry point that validates and applies a command.
 * Validation never touches the state; if it fails the state is exactly as before.
 * Commands may come from the network, so the shape is checked here too.
 */
export function applyCommand(state: GameState, cmd: Command, actor: Actor): CommandResult {
  const type = (cmd as { type?: unknown } | null)?.type;
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(handlers, type)) {
    return { ok: false, error: 'unknown_command' };
  }
  const handler = handlers[type as CommandType] as unknown as Handler<Command>;
  if (!handler.roles.includes(actor.role)) return { ok: false, error: 'forbidden' };
  const error = handler.validate(state, cmd, actor);
  if (error) return { ok: false, error };
  return { ok: true, events: handler.apply(state, cmd, actor) };
}
