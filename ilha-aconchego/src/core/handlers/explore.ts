import { FESTIVAL_CENTER, FESTIVAL_COINS, FESTIVAL_REACH } from '../../data/festivals';
import { isElevatorFloor, MAX_MINE_FLOOR, MINE_DOOR, MINE_DOOR_REACH, MINE_START, MINE_START_REACH, MINE_TREASURE, ROCK_REACH, rockLoot } from '../../data/mine';
import { PLAYER_START } from '../../data/map';
import {
  BOAT_REACH, BUMP_ENERGY, CREATURE_DROPS, CREATURE_REACH, DOCK_REACH, FORAGE_REACH, GRASS_REACH, HOME_BOAT, HOME_LANDING, isRegionId, NODE_REACH, PUZZLE_REACH, REGIONS,
  type CreatureKind, type RegionId,
} from '../../data/regions';
import { XP } from '../../data/skills';
import { addPoints } from './village';
import { absoluteDay } from '../clock';
import { awayDistance, changed, distance, gained, hasItem, hasRoom, isInt, playerOf, PLAYERS, RESIDENTS, xp, type HandlersFor } from '../commandKit';
import type { GameEvent } from '../commands';
import { dailyRoll, DIRS, festivalActive, festivalKey, mineFloor, newPuzzle, pickLoot, pushSolved, pushTarget, regionUnlocked, type Dir } from '../explore';
import { addItem } from '../inventory';
import { bump } from '../progress';
import { energyCost, roll } from '../rules';
import type { GameState, PlayerState, PuzzleState } from '../types';

/**
 * Stage 6 commands (docs/GAME_DESIGN.md, "Exploração e aventura" and "Atividades e eventos"): the boat to
 * the regions, the mines, picking things up, tall grass, the cute creatures, the puzzles, the festival game
 * and the peaceful option.
 */

type ExploreCommands =
  | 'travel.go' | 'travel.home' | 'mine.enter' | 'mine.exit' | 'mine.down' | 'mine.elevator' | 'mine.break' | 'mine.treasure'
  | 'explore.forage' | 'explore.node' | 'explore.grass' | 'creature.calm' | 'creature.bump'
  | 'puzzle.push' | 'puzzle.press' | 'puzzle.reset' | 'puzzle.chest' | 'festival.play' | 'options.set';

const today = (state: Readonly<GameState>) => absoluteDay(state.time);
const regionOf = (p: PlayerState): RegionId | null => (p.away?.kind === 'region' ? p.away.id : null);
const floorOf = (p: PlayerState): number | null => (p.away?.kind === 'mine' ? p.away.floor : null);
const taken = (state: Readonly<GameState>, key: string) => state.explore.taken.includes(key);
const center = ([x, z]: readonly [number, number]): [number, number] => [x + 0.5, z + 0.5];

function puzzleOf(state: Readonly<GameState>, region: RegionId): PuzzleState {
  return state.explore.puzzles[region] ?? newPuzzle(REGIONS[region].puzzle);
}
function puzzleMut(state: GameState, region: RegionId): PuzzleState {
  return (state.explore.puzzles[region] ??= newPuzzle(REGIONS[region].puzzle));
}

/** A creature by id ("beach:2" or "mine:7:0"): its kind and its spot, if it is where the player is. */
export function creatureAt(state: Readonly<GameState>, p: PlayerState, id: unknown): { kind: CreatureKind; at: [number, number] } | null {
  if (typeof id !== 'string') return null;
  const parts = id.split(':');
  const region = regionOf(p);
  if (region && parts.length === 2 && parts[0] === region) {
    const c = REGIONS[region].creatures[Number(parts[1])];
    return c ? { kind: c.kind, at: [c.at[0], c.at[1]] } : null;
  }
  const floor = floorOf(p);
  if (floor !== null && parts.length === 3 && parts[0] === 'mine' && Number(parts[1]) === floor) {
    const c = mineFloor(state.seed, floor, today(state)).creatures[Number(parts[2])];
    return c ? { kind: 'dust', at: center(c) } : null;
  }
  return null;
}

/** Leaves the region or mine (also after fainting): back on the home island. */
function goHome(p: PlayerState, at: readonly [number, number], facing: number): void {
  p.away = null;
  p.inside = null;
  p.position = { x: at[0], z: at[1], facing };
}

export const exploreHandlers: HandlersFor<ExploreCommands> = {
  'travel.go': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      if (!isRegionId(cmd.region)) return 'invalid';
      if (distance(p, HOME_BOAT) > BOAT_REACH) return 'too_far';
      return regionUnlocked(p, cmd.region) ? null : 'not_available';
    },
    apply(state, cmd, actor) {
      const p = state.players[actor.id]!;
      const def = REGIONS[cmd.region];
      p.away = { kind: 'region', id: cmd.region };
      p.position = { x: def.arrive[0], z: def.arrive[1], facing: Math.PI };
      const first = !p.explore.visited.includes(cmd.region);
      if (first) p.explore.visited.push(cmd.region);
      return [{ type: 'travel', playerId: actor.id, region: cmd.region, first }, { type: 'player.moved', playerId: actor.id }];
    },
  },

  'travel.home': {
    roles: PLAYERS,
    validate(state, _cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const region = regionOf(p);
      if (!region) return 'not_available';
      return awayDistance(p, REGIONS[region].boat) <= DOCK_REACH + 1.2 ? null : 'too_far';
    },
    apply(state, _cmd, actor) {
      goHome(state.players[actor.id]!, HOME_LANDING, Math.PI);
      return [{ type: 'travel', playerId: actor.id, region: null, first: false }, { type: 'player.moved', playerId: actor.id }];
    },
  },

  'mine.enter': {
    roles: PLAYERS,
    validate(state, _cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      return distance(p, MINE_DOOR) <= MINE_DOOR_REACH ? null : 'too_far';
    },
    apply(state, _cmd, actor) {
      const p = state.players[actor.id]!;
      p.away = { kind: 'mine', floor: 1 };
      p.position = { x: MINE_START[0], z: MINE_START[1], facing: 0 };
      p.explore.deepest = Math.max(p.explore.deepest, 1);
      const events: GameEvent[] = [{ type: 'mine.floor', playerId: actor.id, floor: 1 }, { type: 'player.moved', playerId: actor.id }];
      // The first time in, a bubble wand waits at the entrance.
      if (!hasItem(p.inventory, 'gear.wand') && !p.explore.chests.includes('wand') && hasRoom(p.inventory, 'gear.wand')) {
        addItem(p.inventory, 'gear.wand', 1);
        p.explore.chests.push('wand');
        events.push(gained(actor.id, 'gear.wand', 1), ...changed(actor.id));
      }
      return events;
    },
  },

  'mine.exit': {
    roles: PLAYERS,
    validate(state, _cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      if (floorOf(p) === null) return 'not_available';
      return awayDistance(p, MINE_START) <= MINE_START_REACH ? null : 'too_far';
    },
    apply(state, _cmd, actor) {
      goHome(state.players[actor.id]!, MINE_DOOR, Math.PI / 2);
      return [{ type: 'mine.floor', playerId: actor.id, floor: 0 }, { type: 'player.moved', playerId: actor.id }];
    },
  },

  'mine.down': {
    roles: PLAYERS,
    validate(state, _cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const floor = floorOf(p);
      if (floor === null || floor >= MAX_MINE_FLOOR) return 'not_available';
      const f = mineFloor(state.seed, floor, today(state));
      const rock = f.rocks[f.ladder];
      if (!rock || !(state.explore.mine[String(floor)] ?? []).includes(f.ladder)) return 'not_available';
      return awayDistance(p, center([rock.x, rock.z])) <= ROCK_REACH ? null : 'too_far';
    },
    apply(state, _cmd, actor) {
      const p = state.players[actor.id]!;
      const floor = floorOf(p)! + 1;
      p.away = { kind: 'mine', floor };
      p.position = { x: MINE_START[0], z: MINE_START[1], facing: 0 };
      p.explore.deepest = Math.max(p.explore.deepest, floor);
      return [{ type: 'mine.floor', playerId: actor.id, floor }, { type: 'player.moved', playerId: actor.id }];
    },
  },

  'mine.elevator': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const floor = floorOf(p);
      if (floor === null || !isElevatorFloor(floor)) return 'not_available';
      if (!isInt(cmd.floor) || !isElevatorFloor(cmd.floor) || cmd.floor > p.explore.deepest || cmd.floor === floor) return 'invalid';
      return awayDistance(p, MINE_START) <= MINE_START_REACH ? null : 'too_far';
    },
    apply(state, cmd, actor) {
      const p = state.players[actor.id]!;
      p.away = { kind: 'mine', floor: cmd.floor };
      p.position = { x: MINE_START[0], z: MINE_START[1], facing: 0 };
      return [{ type: 'mine.floor', playerId: actor.id, floor: cmd.floor }, { type: 'player.moved', playerId: actor.id }];
    },
  },

  'mine.break': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const floor = floorOf(p);
      if (floor === null) return 'not_available';
      if (!hasItem(p.inventory, 'tool.pickaxe')) return 'no_tool';
      const f = mineFloor(state.seed, floor, today(state));
      const rock = isInt(cmd.rock) ? f.rocks[cmd.rock] : undefined;
      if (!rock) return 'invalid';
      if ((state.explore.mine[String(floor)] ?? []).includes(cmd.rock)) return 'not_available';
      if (awayDistance(p, center([rock.x, rock.z])) > ROCK_REACH) return 'too_far';
      if (!hasRoom(p.inventory, 'res.stone', 3)) return 'inventory_full';
      return p.energy >= energyCost(p, 'pickaxe') ? null : 'tired';
    },
    apply(state, cmd, actor) {
      const p = state.players[actor.id]!;
      const floor = floorOf(p)!;
      const f = mineFloor(state.seed, floor, today(state));
      const rock = f.rocks[cmd.rock]!;
      (state.explore.mine[String(floor)] ??= []).push(cmd.rock);
      p.energy -= energyCost(p, 'pickaxe');
      // Crystal rocks hold what deeper floors do.
      const loot = pickLoot(rockLoot(rock.crystal ? floor + 10 : floor), roll(state));
      const qty = addItem(p.inventory, loot.item, loot.qty + (rock.crystal ? 1 : 0));
      bump(p, 'ores', qty);
      const events: GameEvent[] = [{ type: 'mine.broken', playerId: actor.id, floor, rock: cmd.rock, ladder: cmd.rock === f.ladder }, gained(actor.id, loot.item, qty), ...changed(actor.id), ...xp(p, 'mining', XP.mine)];
      return events;
    },
  },

  'mine.treasure': {
    roles: PLAYERS,
    validate(state, _cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const floor = floorOf(p);
      const f = floor !== null ? mineFloor(state.seed, floor, today(state)) : null;
      if (!f?.treasure || p.explore.chests.includes('mine')) return 'not_available';
      if (awayDistance(p, center(f.treasure)) > ROCK_REACH) return 'too_far';
      return p.inventory.filter(s => s === null).length >= MINE_TREASURE.length ? null : 'inventory_full';
    },
    apply(state, _cmd, actor) {
      const p = state.players[actor.id]!;
      p.explore.chests.push('mine');
      const events: GameEvent[] = [{ type: 'chest.opened', playerId: actor.id, chest: 'mine' }];
      for (const [item, qty] of MINE_TREASURE) events.push(gained(actor.id, item, addItem(p.inventory, item, qty)));
      return [...events, ...changed(actor.id)];
    },
  },

  'explore.forage': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const region = regionOf(p);
      const spot = region && isInt(cmd.spot) ? REGIONS[region].forage[cmd.spot] : undefined;
      if (!region || !spot) return 'invalid';
      if (taken(state, `forage:${region}:${cmd.spot}`)) return 'not_available';
      if (awayDistance(p, spot.at) > FORAGE_REACH) return 'too_far';
      return hasRoom(p.inventory, pickLoot(spot.loot, dailyRoll(state, today(state), `forage:${region}:${cmd.spot}`)).item, 3) ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const p = state.players[actor.id]!;
      const region = regionOf(p)!;
      const key = `forage:${region}:${cmd.spot}`;
      const loot = pickLoot(REGIONS[region].forage[cmd.spot]!.loot, dailyRoll(state, today(state), key));
      state.explore.taken.push(key);
      const qty = addItem(p.inventory, loot.item, loot.qty);
      return [{ type: 'explore.changed' }, gained(actor.id, loot.item, qty), ...changed(actor.id)];
    },
  },

  'explore.node': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const region = regionOf(p);
      const node = region && isInt(cmd.node) ? REGIONS[region].nodes[cmd.node] : undefined;
      if (!region || !node) return 'invalid';
      if (!hasItem(p.inventory, 'tool.pickaxe')) return 'no_tool';
      if (taken(state, `node:${region}:${cmd.node}`)) return 'not_available';
      if (awayDistance(p, node.at) > NODE_REACH) return 'too_far';
      if (!hasRoom(p.inventory, 'res.stone', 3)) return 'inventory_full';
      return p.energy >= energyCost(p, 'pickaxe') ? null : 'tired';
    },
    apply(state, cmd, actor) {
      const p = state.players[actor.id]!;
      const region = regionOf(p)!;
      const key = `node:${region}:${cmd.node}`;
      state.explore.taken.push(key);
      p.energy -= energyCost(p, 'pickaxe');
      const loot = pickLoot(REGIONS[region].nodes[cmd.node]!.loot, roll(state));
      const qty = addItem(p.inventory, loot.item, loot.qty);
      bump(p, 'ores', qty);
      return [{ type: 'explore.changed' }, gained(actor.id, loot.item, qty), ...changed(actor.id), ...xp(p, 'mining', XP.mine)];
    },
  },

  'explore.grass': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const region = regionOf(p);
      const clump = region && isInt(cmd.clump) ? REGIONS[region].grass[cmd.clump] : undefined;
      if (!region || !clump) return 'invalid';
      if (taken(state, `grass:${region}:${cmd.clump}`)) return 'not_available';
      if (awayDistance(p, clump) > GRASS_REACH + 0.6) return 'too_far';
      return hasRoom(p.inventory, 'res.stone') ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const p = state.players[actor.id]!;
      const region = regionOf(p)!;
      const key = `grass:${region}:${cmd.clump}`;
      state.explore.taken.push(key);
      const loot = pickLoot(REGIONS[region].grassLoot, dailyRoll(state, today(state), key));
      // A little bug hops out: with the net in hand you catch it, otherwise it gets away.
      const isBug = loot.item.startsWith('bug.');
      if (isBug && !hasItem(p.inventory, 'tool.bugNet')) return [{ type: 'explore.changed' }, { type: 'grass.searched', playerId: actor.id, item: loot.item, caught: false }];
      const qty = addItem(p.inventory, loot.item, loot.qty);
      if (isBug) bump(p, 'bugs');
      return [{ type: 'explore.changed' }, { type: 'grass.searched', playerId: actor.id, item: loot.item, caught: true }, gained(actor.id, loot.item, qty), ...changed(actor.id), ...(isBug ? xp(p, 'charisma', XP.bug) : [])];
    },
  },

  'creature.calm': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      if (state.options.peaceful) return 'not_available';
      if (!hasItem(p.inventory, 'gear.wand')) return 'no_tool';
      const c = creatureAt(state, p, cmd.id);
      if (!c) return 'invalid';
      if (state.explore.calmed.includes(cmd.id)) return 'not_available';
      if (awayDistance(p, c.at) > CREATURE_REACH) return 'too_far';
      return hasRoom(p.inventory, 'res.stone', 2) ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const p = state.players[actor.id]!;
      const c = creatureAt(state, p, cmd.id)!;
      state.explore.calmed.push(cmd.id);
      const loot = pickLoot(CREATURE_DROPS[c.kind], roll(state));
      const qty = addItem(p.inventory, loot.item, loot.qty);
      bump(p, 'calmed');
      return [{ type: 'creature.calmed', playerId: actor.id, id: cmd.id }, gained(actor.id, loot.item, qty), ...changed(actor.id), ...xp(p, 'mining', 4)];
    },
  },

  'creature.bump': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      if (state.options.peaceful) return 'not_available';
      const c = creatureAt(state, p, cmd.id);
      if (!c || state.explore.calmed.includes(cmd.id)) return 'invalid';
      return awayDistance(p, c.at) <= CREATURE_REACH ? null : 'too_far';
    },
    apply(state, _cmd, actor) {
      const p = state.players[actor.id]!;
      p.energy = Math.max(0, p.energy - BUMP_ENERGY);
      const events: GameEvent[] = [{ type: 'player.changed', playerId: actor.id }];
      // Out of energy: you wake up at home, a little tired, with everything you found.
      if (p.energy <= 0) {
        goHome(p, [PLAYER_START.x, PLAYER_START.z], PLAYER_START.facing);
        p.energy = 10;
        events.push({ type: 'player.fainted', playerId: actor.id }, { type: 'player.moved', playerId: actor.id });
      }
      return events;
    },
  },

  'puzzle.push': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const region = regionOf(p);
      if (!region || !(cmd.dir in DIRS) || !isInt(cmd.block)) return 'invalid';
      const def = REGIONS[region].puzzle;
      const pz = puzzleOf(state, region);
      const from = pz.blocks[cmd.block];
      if (def.kind !== 'push' || !from) return 'invalid';
      const [cx, cz] = center(from);
      if (awayDistance(p, [cx, cz]) > PUZZLE_REACH) return 'too_far';
      // You push from the other side: the block moves away from you.
      const [dx, dz] = DIRS[cmd.dir as Dir];
      if ((p.position.x - cx) * dx + (p.position.z - cz) * dz > -0.3) return 'invalid';
      return pushTarget(def, pz, cmd.block, cmd.dir as Dir) ? null : 'occupied';
    },
    apply(state, cmd, actor) {
      const p = state.players[actor.id]!;
      const region = regionOf(p)!;
      const def = REGIONS[region].puzzle;
      const pz = puzzleMut(state, region);
      const to = pushTarget(def, pz, cmd.block, cmd.dir as Dir)!;
      pz.blocks[cmd.block] = [to[0], to[1]];
      const events: GameEvent[] = [{ type: 'puzzle.changed', region }];
      if (pushSolved(def, pz)) {
        pz.solved = true;
        events.push({ type: 'puzzle.solved', region });
      }
      return events;
    },
  },

  'puzzle.press': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const region = regionOf(p);
      if (!region || !isInt(cmd.index)) return 'invalid';
      const def = REGIONS[region].puzzle;
      const spots = def.kind === 'switches' ? def.switches : def.kind === 'bells' ? def.bells : [];
      const at = spots[cmd.index];
      if (!at) return 'invalid';
      const pz = puzzleOf(state, region);
      if (pz.solved || (def.kind === 'bells' && pz.pressed.includes(cmd.index))) return 'not_available';
      return awayDistance(p, at) <= PUZZLE_REACH ? null : 'too_far';
    },
    apply(state, cmd, actor) {
      const p = state.players[actor.id]!;
      const region = regionOf(p)!;
      const def = REGIONS[region].puzzle;
      const pz = puzzleMut(state, region);
      let correct = true;
      if (def.kind === 'switches') {
        if (def.order[pz.pressed.length] === cmd.index) pz.pressed.push(cmd.index);
        else {
          pz.pressed = [];
          correct = false;
        }
        pz.solved = pz.pressed.length === def.order.length;
      } else if (def.kind === 'bells') {
        pz.pressed.push(cmd.index);
        pz.solved = pz.pressed.length === def.bells.length;
      }
      const events: GameEvent[] = [{ type: 'puzzle.changed', region }, { type: 'puzzle.pressed', playerId: actor.id, region, correct }];
      if (pz.solved) events.push({ type: 'puzzle.solved', region });
      return events;
    },
  },

  'puzzle.reset': {
    roles: PLAYERS,
    validate(state, _cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const region = regionOf(p);
      if (!region) return 'invalid';
      return puzzleOf(state, region).solved ? 'not_available' : null;
    },
    apply(state, _cmd, actor) {
      const region = regionOf(state.players[actor.id]!)!;
      state.explore.puzzles[region] = newPuzzle(REGIONS[region].puzzle);
      return [{ type: 'puzzle.changed', region }];
    },
  },

  'puzzle.chest': {
    roles: PLAYERS,
    validate(state, _cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const region = regionOf(p);
      if (!region) return 'invalid';
      if (!puzzleOf(state, region).solved || p.explore.chests.includes(region)) return 'not_available';
      if (awayDistance(p, REGIONS[region].puzzle.chest) > PUZZLE_REACH + 0.4) return 'too_far';
      return p.inventory.some(s => s === null) ? null : 'inventory_full';
    },
    apply(state, _cmd, actor) {
      const p = state.players[actor.id]!;
      const region = regionOf(p)!;
      p.explore.chests.push(region);
      bump(p, 'puzzles');
      const events: GameEvent[] = [{ type: 'chest.opened', playerId: actor.id, chest: region }];
      for (const [item, qty] of REGIONS[region].chest) events.push(gained(actor.id, item, addItem(p.inventory, item, qty)));
      return [...events, ...changed(actor.id)];
    },
  },

  'festival.play': {
    roles: PLAYERS,
    validate(state, cmd, actor) {
      const p = playerOf(state, actor);
      if (!p) return 'forbidden';
      const f = festivalActive(state);
      if (!f) return 'not_available';
      if (!isInt(cmd.score) || cmd.score < 0 || cmd.score > f.maxScore) return 'invalid';
      if (p.explore.festivals.includes(festivalKey(state, f))) return 'already';
      if (distance(p, FESTIVAL_CENTER) > FESTIVAL_REACH) return 'too_far';
      return hasRoom(p.inventory, f.prize) ? null : 'inventory_full';
    },
    apply(state, cmd, actor) {
      const p = state.players[actor.id]!;
      const f = festivalActive(state)!;
      p.explore.festivals.push(festivalKey(state, f));
      const coins = cmd.score * FESTIVAL_COINS + 100;
      p.coins += coins;
      const prize = cmd.score >= f.prizeScore;
      if (prize) addItem(p.inventory, f.prize, 1);
      addPoints(p.friends[f.host], 30);
      return [{ type: 'festival.done', playerId: actor.id, festival: f.id, score: cmd.score, coins, prize: prize ? f.prize : null }, ...changed(actor.id), ...xp(p, 'charisma', 20)];
    },
  },

  'options.set': {
    roles: RESIDENTS,
    validate(state, cmd, actor) {
      if (actor.role !== 'host') return 'forbidden';
      return typeof cmd.peaceful === 'boolean' ? null : 'invalid';
      void state;
    },
    apply(state, cmd) {
      state.options.peaceful = cmd.peaceful;
      return [{ type: 'options.changed' }];
    },
  },
};
