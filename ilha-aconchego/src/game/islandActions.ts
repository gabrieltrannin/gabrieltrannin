import * as THREE from 'three';
import { absoluteDay, formatClock, seasonOf } from '../core/clock';
import type { Command } from '../core/commands';
import type { Game } from '../core/game';
import { countItem } from '../core/inventory';
import { eatEnergy, plotOf, tilesInArea } from '../core/rules';
import type { Actor, PlayerState } from '../core/types';
import { ANIMAL_DEFS } from '../data/animals';
import { FARM_CROP_DEFS, isFarmCrop, type FarmCropId } from '../data/crops';
import { ITEMS, type ItemId } from '../data/items';
import {
  BEDS, BENTO_SPOT, FARM_TILES, farmTileAt, GRASS_PATCHES, grassPatchCenter, GREENHOUSE, HIVES, KITCHEN, MACHINE_PADS, MINE_NODES, SHIPPING_BIN, STALLS,
  STATION_REACH, STUMPS, WORK_REACH, WORKBENCH, type FarmTile,
} from '../data/map';
import { GREENHOUSE_COST, MACHINES, machineOfItem } from '../data/recipes';
import type { ShopId } from '../data/shops';
import { toolOfItem, type ToolId } from '../data/tools';
import { BRIDGE_SIGN, MUSEUM_DOOR, NOTICE_BOARD, SEED_SHOP_COUNTER } from '../data/village';
import { VILLAGERS } from '../data/villagers';
import { shopOpen } from '../core/villagers';
import { t } from '../i18n';
import type { Bubbles } from '../ui/bubbles';
import type { PanelHost } from '../ui/panels';
import type { BugSystem } from '../world/bugs';
import type { World } from '../world/world';
import { heightAt } from '../world/terrain';
import type { FishingSession } from './fishing';
import { waterAhead } from './fishing';
import type { Interactions } from './interactions';
import type { PlayerController } from './playerController';

export interface IslandAction {
  label: string;
  run(): void;
  /** A ripe crop is in front: harvesting wins over what is close by. */
  ripe?: boolean;
}

export interface ActionContext {
  game: Game;
  actor: Actor;
  player: PlayerController;
  world: World;
  bubbles: Bubbles;
  panels: PanelHost;
  bugs: BugSystem;
  fishing: FishingSession;
  interactions: Interactions;
  toast(text: string): void;
  errorText(error: string): string;
  /** Writes the walked position into the state before acting (commands check distance). */
  commitMove(): void;
}

const SHOP_OF: Record<string, ShopId> = { 'stall.bread': 'bread', 'stall.honey': 'honey', 'stall.flowers': 'flowers' };
const seedCrop = (item: ItemId | undefined): FarmCropId | null => {
  if (!item?.startsWith('seed.')) return null;
  const crop = item.slice(5);
  return isFarmCrop(crop) ? crop : null;
};

/**
 * Decides what E / Ação does right now: harvest or work the farm tile in front with the item in hand,
 * catch a bug, use what is close by (animals, rocks, machines, the shops...), cast the line toward
 * water, or eat the food in hand. Registers the stage-3 places on the shared Interactions list.
 */
export function createIslandActions(ctx: ActionContext): { resolve(): IslandAction | null } {
  const { game, actor, interactions, toast, errorText, world, bubbles, panels } = ctx;
  const me = (): PlayerState => game.state.players[actor.id]!;
  const held = (): ItemId | undefined => me().inventory[me().activeSlot]?.item;
  const has = (item: ItemId) => countItem(me().inventory, item) > 0;
  const send = (cmd: Command, ok?: () => void) => {
    ctx.commitMove();
    const r = game.dispatch(cmd, actor);
    if (!r.ok) toast(errorText(r.error));
    else ok?.();
    return r.ok;
  };
  const toolName = (tool: ToolId) => t(`item.tool.${tool}`);
  const needs = (tool: ToolId, label: string) => (has(`tool.${tool}`) ? label : t('act.needTool', { tool: toolName(tool) }));
  const above = (x: number, z: number, h: number) => () => new THREE.Vector3(x, heightAt(x, z) + h, z);
  const today = () => absoluteDay(game.state.time);

  // ---------- Places of daily work ----------
  interactions.add({ id: 'bin', at: () => ({ x: SHIPPING_BIN[0], z: SHIPPING_BIN[1] }), radius: STATION_REACH, label: () => t('act.ship'), act: () => panels.openShipping() });
  interactions.add({ id: 'kitchen', at: () => ({ x: KITCHEN[0], z: KITCHEN[1] }), radius: STATION_REACH, label: () => t('act.cook'), act: () => panels.openKitchen() });
  interactions.add({ id: 'workbench', at: () => ({ x: WORKBENCH[0], z: WORKBENCH[1] }), radius: STATION_REACH, label: () => t('act.craft'), act: () => panels.openWorkbench() });
  // Shops: their keeper serves them (talk to them); when the keeper is away, the counter says so.
  const closedAt = (id: string, at: () => { x: number; z: number }, shop: ShopId, radius = 2.0) => {
    const keeper = VILLAGERS.find(v => v.shop === shop);
    interactions.add({
      id, at, radius,
      enabled: () => !shopOpen(game.state, shop),
      label: () => t('act.closed'),
      act: () => {
        if (!keeper) return;
        const start = keeper.routine.find(([, place]) => place.startsWith('stall.') || place === 'seeds' || place === 'forge');
        const end = start ? keeper.routine[keeper.routine.indexOf(start) + 1] : undefined;
        toast(start && end ? t('msg.shopHours', { name: keeper.name, from: formatClock(start[0]), to: formatClock(end[0]) }) : t('msg.closed'));
      },
    });
  };
  for (const stall of STALLS) closedAt(stall.asset, () => ({ x: stall.at[0], z: stall.at[1] + 1.2 }), SHOP_OF[stall.asset]!);
  closedAt('seeds', () => ({ x: SEED_SHOP_COUNTER[0], z: SEED_SHOP_COUNTER[1] }), 'seeds');
  closedAt('forge', () => ({ x: BENTO_SPOT[0], z: BENTO_SPOT[1] }), 'smithy', 2.2);
  interactions.add({ id: 'board', at: () => ({ x: NOTICE_BOARD[0], z: NOTICE_BOARD[1] + 0.4 }), radius: 2.0, label: () => t('act.board'), act: () => panels.openBoard() });
  interactions.add({
    id: 'museum', at: () => ({ x: MUSEUM_DOOR[0], z: MUSEUM_DOOR[1] }), radius: 2.0,
    label: () => (game.state.projects.museum.done ? t('act.museum') : t('act.museumClosed')),
    act: () => (game.state.projects.museum.done ? panels.openMuseum() : toast(t('msg.museumClosed'))),
  });
  interactions.add({
    id: 'bridge-sign', at: () => ({ x: BRIDGE_SIGN[0], z: BRIDGE_SIGN[1] }), radius: 1.6,
    enabled: () => !game.state.projects.bridge.done,
    label: () => t('act.bridgeSign'),
    act: () => bubbles.show('bridge-sign', t('msg.bridgeSign'), above(BRIDGE_SIGN[0], BRIDGE_SIGN[1], 1.6), 4),
  });
  interactions.add({
    id: 'greenhouse',
    at: () => ({ x: GREENHOUSE.x, z: GREENHOUSE.z + GREENHOUSE.d / 2 + 0.3 }),
    radius: 1.8,
    enabled: () => !game.state.greenhouse,
    label: () => t('act.greenhouse'),
    act: () => {
      const cost = t('greenhouse.cost', { coins: GREENHOUSE_COST.coins, wood: GREENHOUSE_COST.wood, stone: GREENHOUSE_COST.stone });
      if (!send({ type: 'greenhouse.repair' }, () => toast(t('msg.greenhouseRepaired')))) bubbles.show('greenhouse', cost, above(GREENHOUSE.x, GREENHOUSE.z + GREENHOUSE.d / 2, 2.4), 5, t('greenhouse.broken'));
    },
  });

  // ---------- Gathering ----------
  MINE_NODES.forEach(([x, z], i) => {
    interactions.add({
      id: `node-${i}`, at: () => ({ x, z }), radius: WORK_REACH,
      enabled: () => !!game.state.nodes[`node-${i}`]?.ore,
      label: () => needs('pickaxe', t('act.mine')),
      act: () => send({ type: 'node.mine', node: `node-${i}` }),
    });
  });
  STUMPS.forEach(([x, z], i) => {
    interactions.add({
      id: `stump-${i}`, at: () => ({ x, z }), radius: WORK_REACH,
      enabled: () => game.state.stumps[`stump-${i}`] === undefined,
      label: () => needs('axe', t('act.chop')),
      act: () => send({ type: 'stump.chop', stump: `stump-${i}` }),
    });
  });
  for (let i = 0; i < GRASS_PATCHES.columns * GRASS_PATCHES.rows; i++) {
    const [x, z] = grassPatchCenter(i);
    interactions.add({
      id: `grass-${i}`, at: () => ({ x, z }), radius: 1.5,
      enabled: () => game.state.grass[i] === undefined,
      label: () => t('act.cutGrass'),
      act: () => send({ type: 'grass.cut', patch: i }),
    });
  }
  HIVES.forEach(([x, z], i) => {
    interactions.add({
      id: `hive-${i}`, at: () => ({ x, z: z + 0.5 }), radius: 1.6,
      enabled: () => seasonOf(game.state.time) !== 'winter' && today() >= (game.state.hives[`hive-${i}`] ?? 0),
      label: () => t('act.honey'),
      act: () => send({ type: 'hive.collect', hive: `hive-${i}` }),
    });
  });

  // ---------- Animals ----------
  for (const animal of game.state.animals) {
    const id = animal.id;
    const state = () => game.state.animals.find(a => a.id === id)!;
    const where = () => world.farm.animalAt(id);
    interactions.add({
      id: `animal-${id}`,
      at: () => {
        const p = where();
        return p ? { x: p.x, z: p.z } : { x: 999, z: 999 };
      },
      radius: 1.4,
      enabled: () => {
        const a = state();
        return a.ready || !a.fedToday || !a.pettedToday;
      },
      label: () => {
        const a = state();
        if (a.ready) return t('act.collect', { item: t(`item.${ANIMAL_DEFS[a.kind].product}`) });
        if (!a.fedToday) return t('act.feed', { name: a.name });
        return t('act.petAnimal', { name: a.name });
      },
      act: () => {
        const a = state();
        const p = where();
        const bubble = (text: string) => p && bubbles.show(`animal-${id}`, text, () => where()!.clone().setY(where()!.y + 1.3), 2, a.name);
        if (a.ready) send({ type: 'animal.collect', animal: id });
        else if (!a.fedToday) send({ type: 'animal.feed', animal: id }, () => bubble(t('msg.fed', { name: a.name })));
        else send({ type: 'animal.pet', animal: id }, () => bubble('♥'));
        world.farm.cheerAnimal(id);
      },
    });
  }

  // ---------- Machine pads ----------
  const now = () => absoluteDay(game.state.time) * 1440 + game.state.time.minuteOfDay;
  const machineInputSlot = (pad: number): number => {
    const m = game.state.machines[String(pad)];
    if (!m) return -1;
    const def = MACHINES[m.kind];
    const ok = (item: ItemId) => def.inputs.includes(item) || def.accepts.includes(ITEMS[item].kind);
    const active = me().activeSlot;
    const heldStack = me().inventory[active];
    if (heldStack && ok(heldStack.item)) return active;
    return me().inventory.findIndex(s => !!s && ok(s.item));
  };
  MACHINE_PADS.forEach(([x, z], pad) => {
    interactions.add({
      id: `pad-${pad}`, at: () => ({ x, z }), radius: 1.6,
      enabled: () => {
        const m = game.state.machines[String(pad)];
        if (!m) return me().inventory.some(s => !!s && !!machineOfItem(s.item));
        return !!m.output || machineInputSlot(pad) >= 0;
      },
      label: () => {
        const m = game.state.machines[String(pad)];
        if (!m) {
          const item = me().inventory.find(s => !!s && !!machineOfItem(s.item))!.item;
          return t('act.place', { item: t(`item.${item}`) });
        }
        if (m.output) return now() >= m.readyAt ? t('act.collect', { item: t(`item.${m.output}`) }) : t('act.machineBusy');
        return t('act.machine', { item: t(`item.${me().inventory[machineInputSlot(pad)]!.item}`) });
      },
      act: () => {
        const m = game.state.machines[String(pad)];
        if (!m) {
          const slot = me().inventory.findIndex(s => !!s && !!machineOfItem(s.item));
          send({ type: 'machine.place', pad, slot }, () => toast(t('msg.placed', { item: t(`item.${me().inventory[slot]?.item ?? 'place.keg'}`) })));
          return;
        }
        if (m.output) {
          if (now() >= m.readyAt) send({ type: 'machine.collect', pad });
          else {
            const sameDay = Math.floor(m.readyAt / 1440) === absoluteDay(game.state.time);
            toast(sameDay ? t('msg.machineWorking', { time: formatClock(m.readyAt % 1440) }) : t('msg.machineWorkingTomorrow'));
          }
          return;
        }
        send({ type: 'machine.load', pad, slot: machineInputSlot(pad) }, () => toast(t('msg.machineLoaded')));
      },
    });
  });

  // ---------- The farm tile in front ----------
  const tileAhead = (): FarmTile | null => {
    const { x, z } = ctx.player, f = ctx.player.facing;
    for (const d of [0.55, 0.95, 1.35, 1.75, 2.15]) {
      const tile = farmTileAt(x + Math.sin(f) * d, z + Math.cos(f) * d);
      if (tile && (!tile.greenhouse || game.state.greenhouse)) return tile;
    }
    return null;
  };

  const farmAction = (): IslandAction | null => {
    const tile = tileAhead();
    if (!tile) return null;
    const plot = plotOf(game.state, tile.id);
    const item = held();
    const tool = toolOfItem(item);
    if (plot.crop && plot.ripe) {
      return { label: t('act.harvest', { crop: t(`item.crop.${plot.crop}`) }), run: () => send({ type: 'farm.harvest', tile: tile.id }), ripe: true };
    }
    if (tool === 'hoe' && tilesInArea(tile, me().toolLevels.hoe).some(tt => !plotOf(game.state, tt.id).tilled)) {
      return { label: t('act.till'), run: () => send({ type: 'farm.till', tile: tile.id }) };
    }
    if (tool === 'wateringCan' && tilesInArea(tile, me().toolLevels.wateringCan).some(tt => plotOf(game.state, tt.id).tilled && !plotOf(game.state, tt.id).watered)) {
      return { label: t('act.water'), run: () => send({ type: 'farm.water', tile: tile.id }) };
    }
    const crop = seedCrop(item);
    if (crop && item && plot.tilled && !plot.crop && !plot.sprinkler) {
      return { label: t('act.plant', { crop: t(`item.crop.${crop}`) }), run: () => send({ type: 'farm.plant', tile: tile.id, item }) };
    }
    if ((item === 'supply.fertilizer' || item === 'supply.growth') && plot.tilled && !plot.fertilizer && !plot.ripe && !plot.sprinkler) {
      return { label: t('act.fertilize', { item: t(`item.${item}`) }), run: () => send({ type: 'farm.fertilize', tile: tile.id, item }) };
    }
    if (item === 'place.sprinkler' && !plot.crop && !plot.sprinkler) {
      return { label: t('act.sprinkler'), run: () => send({ type: 'farm.sprinkler', tile: tile.id }, () => toast(t('msg.placed', { item: t('item.place.sprinkler') }))) };
    }
    return null;
  };

  // Signs tell what grows in their bed and how many days are left.
  for (const bed of BEDS) {
    const [x, z] = bed.sign;
    interactions.add({
      id: `sign-${bed.id}`, at: () => ({ x, z }), radius: 1.5,
      label: () => t('interact.sign'),
      act: () => {
        const tiles = FARM_TILES.filter(tt => tt.bed === bed.id).map(tt => plotOf(game.state, tt.id)).filter(p => p.crop);
        const text = tiles.length === 0
          ? t('msg.signEmpty')
          : tiles.some(p => p.ripe)
            ? t('msg.signRipe', { crop: t(`item.crop.${tiles[0]!.crop!}`) })
            : t('msg.signDays', { crop: t(`item.crop.${tiles[0]!.crop!}`), days: Math.max(...tiles.map(p => FARM_CROP_DEFS[p.crop!].days - p.growth)) });
        bubbles.show(`sign-${bed.id}`, text, above(x, z, 1.2), 3.5);
      },
    });
  }

  return {
    resolve() {
      const item = held();
      // A bug close in front, with the net in hand.
      if (item === 'tool.bugNet') {
        const f = ctx.player.facing;
        const bug = ctx.bugs.nearest(ctx.player.x + Math.sin(f) * 0.6, ctx.player.z + Math.cos(f) * 0.6, 1.2);
        if (bug) {
          return {
            label: t('act.catchBug', { item: t(`item.${bug.item}`) }),
            run: () => send({ type: 'bug.catch', item: bug.item }, () => ctx.bugs.remove(bug.id)),
          };
        }
      }
      const farm = farmAction();
      const farmItem = !!item && (seedCrop(item) !== null || item.startsWith('supply.') || item === 'place.sprinkler' || toolOfItem(item) === 'hoe' || toolOfItem(item) === 'wateringCan');
      if (farm && farmItem) return farm;
      const near = interactions.nearest(ctx.player.x, ctx.player.z, ctx.player.facing);
      if (farm && (!near || farm.ripe)) return farm;
      if (near) return { label: near.label(), run: () => near.act() };
      if (farm) return farm;
      if (item === 'tool.fishingRod') {
        const water = waterAhead(ctx.player.x, ctx.player.z, ctx.player.facing);
        if (water) return { label: t('act.fish'), run: () => { ctx.commitMove(); ctx.fishing.start(water.spot, water.point, errorText); } };
      }
      const slot = me().activeSlot;
      if (item && eatEnergy(me(), item) > 0) {
        return { label: t('act.eat', { item: t(`item.${item}`), energy: eatEnergy(me(), item) }), run: () => send({ type: 'item.eat', slot }) };
      }
      return null;
    },
  };
}
