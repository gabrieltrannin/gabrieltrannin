import { describe, expect, it } from 'vitest';
import { FARM_TILES, KITCHEN, MACHINE_PADS, MINE_NODES, PEN, PIER, SHIPPING_BIN, STUMPS, WORKBENCH, BENTO_SPOT, POND, grassPatchCenter, type XZ } from '../data/map';
import { MAX_ENERGY } from '../data/items';
import { skillLevel } from '../data/skills';
import { applyCommand, type Command } from './commands';
import { TensionGame, zoneSize } from './fishingGame';
import { addItem, countItem } from './inventory';
import { shopSpot } from './handlers/economy';
import { migrateSave, readSaveFile, toSaveFile } from './save';
import { createInitialState, SAVE_VERSION } from './state';
import type { Actor, GameState } from './types';

const host: Actor = { id: 'local', role: 'host' };
const SYSTEM: Actor = { id: 'system', role: 'system' };

function setup(): GameState {
  return createInitialState({ seed: 42 });
}
const me = (s: GameState) => s.players.local!;
const run = (s: GameState, cmd: Command, actor = host) => applyCommand(s, cmd, actor);
const ok = (s: GameState, cmd: Command, actor = host) => {
  const r = run(s, cmd, actor);
  if (!r.ok) throw new Error(`${cmd.type} failed: ${r.error}`);
  return r.events;
};
const goTo = (s: GameState, [x, z]: XZ) => {
  me(s).position = { x, z, facing: 0 };
};
const sleep = (s: GameState) => ok(s, { type: 'sleep' }, SYSTEM);
const tile = (id: string) => FARM_TILES.find(t => t.id === id)!;
const at = (id: string): XZ => [tile(id).x, tile(id).z];

describe('farm', () => {
  it('tills, plants, waters, grows by day and harvests', () => {
    const s = setup();
    goTo(s, at('SW-0-0'));
    expect(run(s, { type: 'farm.plant', tile: 'SW-0-0', item: 'seed.lettuce' })).toEqual({ ok: false, error: 'not_tilled' });
    ok(s, { type: 'farm.till', tile: 'SW-0-0' });
    expect(me(s).energy).toBe(MAX_ENERGY - 3);
    ok(s, { type: 'farm.plant', tile: 'SW-0-0', item: 'seed.lettuce' });
    expect(run(s, { type: 'farm.plant', tile: 'SW-0-0', item: 'seed.lettuce' })).toEqual({ ok: false, error: 'occupied' });
    // Lettuce needs 4 watered days. A dry day does not count (and does not kill it).
    s.forecast = 'sun';
    for (let day = 0; day < 4; day++) {
      ok(s, { type: 'farm.water', tile: 'SW-0-0' });
      s.forecast = 'sun';
      sleep(s);
    }
    expect(s.plots['SW-0-0']!.ripe).toBe(true);
    ok(s, { type: 'farm.harvest', tile: 'SW-0-0' });
    expect(countItem(me(s).inventory, 'crop.lettuce')).toBeGreaterThanOrEqual(1);
    expect(s.plots['SW-0-0']!.crop).toBeNull();
    expect(s.plots['SW-0-0']!.tilled).toBe(true);
    expect(me(s).skills.farming).toBeGreaterThan(0);
  });

  it('does not grow without water, and rain waters every outdoor plot', () => {
    const s = setup();
    goTo(s, at('NW-1-1'));
    ok(s, { type: 'farm.plant', tile: 'NW-1-1', item: 'seed.strawberry' });
    s.forecast = 'sun';
    sleep(s);
    expect(s.plots['NW-1-1']!.growth).toBe(0);
    s.forecast = 'rain';
    sleep(s);
    expect(s.plots['NW-1-1']!.watered).toBe(true);
    s.forecast = 'sun';
    sleep(s);
    expect(s.plots['NW-1-1']!.growth).toBe(1);
  });

  it('regrows strawberries after a harvest', () => {
    const s = setup();
    goTo(s, at('NW-0-0'));
    ok(s, { type: 'farm.plant', tile: 'NW-0-0', item: 'seed.strawberry' });
    Object.assign(s.plots['NW-0-0']!, { growth: 6, ripe: true });
    ok(s, { type: 'farm.harvest', tile: 'NW-0-0' });
    expect(s.plots['NW-0-0']).toMatchObject({ crop: 'strawberry', ripe: false, growth: 3 });
  });

  it('refuses seeds out of season, and out-of-season crops wither when the season turns', () => {
    const s = setup();
    goTo(s, at('NW-0-0'));
    addItem(me(s).inventory, 'seed.pumpkin', 1);
    expect(run(s, { type: 'farm.plant', tile: 'NW-0-0', item: 'seed.pumpkin' })).toEqual({ ok: false, error: 'wrong_season' });
    ok(s, { type: 'farm.plant', tile: 'NW-0-0', item: 'seed.lettuce' });
    s.time.day = 28;
    sleep(s);
    expect(s.time.seasonIndex).toBe(1);
    expect(s.plots['NW-0-0']!.crop).toBeNull();
  });

  it('greenhouse grows any season once repaired, and sprinklers water around them', () => {
    const s = setup();
    goTo(s, at('GH-0-0'));
    expect(run(s, { type: 'farm.till', tile: 'GH-0-0' })).toEqual({ ok: false, error: 'not_available' });
    s.greenhouse = true;
    ok(s, { type: 'farm.till', tile: 'GH-0-0' });
    addItem(me(s).inventory, 'seed.kale', 1);
    ok(s, { type: 'farm.plant', tile: 'GH-0-0', item: 'seed.kale' });
    goTo(s, at('NW-1-1'));
    addItem(me(s).inventory, 'place.sprinkler', 1);
    ok(s, { type: 'farm.sprinkler', tile: 'NW-1-1' });
    s.forecast = 'sun';
    sleep(s);
    expect(s.plots['NW-0-0']!.watered).toBe(true);
    expect(s.plots['NW-2-2']!.watered).toBe(true);
    expect(s.plots['NW-3-0']!.watered).toBe(false);
  });

  it('a better hoe works a whole row, and an empty energy bar stops tools', () => {
    const s = setup();
    me(s).toolLevels.hoe = 2;
    goTo(s, at('SE-1-1'));
    ok(s, { type: 'farm.till', tile: 'SE-1-1' });
    expect(['SE-0-1', 'SE-1-1', 'SE-2-1'].every(id => s.plots[id]?.tilled)).toBe(true);
    me(s).energy = 1;
    expect(run(s, { type: 'farm.till', tile: 'SE-1-0' })).toEqual({ ok: false, error: 'tired' });
  });
});

describe('animals', () => {
  it('give a product the morning after being fed and petted', () => {
    const s = setup();
    goTo(s, [(PEN.x0 + PEN.x1) / 2, (PEN.z0 + PEN.z1) / 2]);
    ok(s, { type: 'animal.feed', animal: 'cow-1' });
    expect(run(s, { type: 'animal.feed', animal: 'cow-1' })).toEqual({ ok: false, error: 'not_available' });
    sleep(s);
    expect(s.animals.find(a => a.id === 'cow-1')!.ready).toBe(false);
    ok(s, { type: 'animal.feed', animal: 'cow-1' });
    ok(s, { type: 'animal.pet', animal: 'cow-1' });
    sleep(s);
    expect(s.animals.find(a => a.id === 'cow-1')!.ready).toBe(true);
    ok(s, { type: 'animal.collect', animal: 'cow-1' });
    expect(countItem(me(s).inventory, 'animal.milk')).toBeGreaterThanOrEqual(1);
  });

  it('need hay to eat', () => {
    const s = setup();
    goTo(s, [(PEN.x0 + PEN.x1) / 2, (PEN.z0 + PEN.z1) / 2]);
    me(s).inventory = me(s).inventory.map(slot => (slot?.item === 'res.hay' ? null : slot));
    expect(run(s, { type: 'animal.feed', animal: 'chicken-1' })).toEqual({ ok: false, error: 'missing' });
  });
});

describe('gathering', () => {
  it('mines rocks, chops stumps and cuts grass, which come back days later', () => {
    const s = setup();
    goTo(s, MINE_NODES[0]!);
    ok(s, { type: 'node.mine', node: 'node-0' });
    expect(countItem(me(s).inventory, 'res.copper')).toBeGreaterThanOrEqual(1);
    expect(run(s, { type: 'node.mine', node: 'node-0' })).toEqual({ ok: false, error: 'not_ready' });
    goTo(s, STUMPS[0]!);
    ok(s, { type: 'stump.chop', stump: 'stump-0' });
    expect(countItem(me(s).inventory, 'res.wood')).toBeGreaterThanOrEqual(3);
    goTo(s, grassPatchCenter(0));
    ok(s, { type: 'grass.cut', patch: 0 });
    for (let i = 0; i < 2; i++) sleep(s);
    expect(s.nodes['node-0']!.ore).not.toBeNull();
    expect(s.stumps['stump-0']).toBeUndefined();
    expect(s.grass[0]).toBeUndefined();
  });

  it('fishes: casting rolls a fish, the minigame decides', () => {
    const s = setup();
    s.time.minuteOfDay = 600;
    goTo(s, [(PIER.x0 + PIER.x1) / 2, PIER.z1 - 0.5]);
    ok(s, { type: 'fishing.cast', spot: 'pier' });
    const fish = me(s).fishing!.item;
    expect(fish.startsWith('fish.')).toBe(true);
    ok(s, { type: 'fishing.finish', caught: true });
    expect(countItem(me(s).inventory, fish)).toBe(1);
    expect(me(s).skills.fishing).toBeGreaterThan(0);
    goTo(s, [POND.x - POND.rx - 0.5, POND.z]);
    ok(s, { type: 'fishing.cast', spot: 'river' });
    expect(me(s).fishing!.item).toMatch(/^fish\./);
    goTo(s, [0, 0]);
    expect(run(s, { type: 'fishing.cast', spot: 'pier' })).toEqual({ ok: false, error: 'too_far' });
  });

  it('tension minigame: steady play catches, never reeling loses the fish, always reeling snaps the line', () => {
    const play = (policy: (g: TensionGame) => boolean) => {
      const g = new TensionGame({ difficulty: 2, zone: zoneSize(1, 0, false), seed: 9 });
      for (let i = 0; i < 4000 && g.result === 'playing'; i++) g.step(0.02, policy(g));
      return g.result;
    };
    expect(play(g => g.tension < (g.zoneLow + g.zoneHigh) / 2)).toBe('caught');
    expect(play(() => false)).toBe('escaped');
    expect(play(() => true)).toBe('snapped');
  });
});

describe('kitchen, workbench, shops and the shipping bin', () => {
  it('cooks a dish, eats it for energy and a bonus', () => {
    const s = setup();
    goTo(s, KITCHEN);
    addItem(me(s).inventory, 'animal.egg', 1);
    addItem(me(s).inventory, 'animal.milk', 1);
    addItem(me(s).inventory, 'crop.wheat', 1);
    expect(run(s, { type: 'cook', recipe: 'pancakes' })).toEqual({ ok: false, error: 'not_available' });
    me(s).skills.cooking = 100;
    ok(s, { type: 'cook', recipe: 'pancakes' });
    const slot = me(s).inventory.findIndex(x => x?.item === 'dish.pancakes');
    me(s).energy = 20;
    ok(s, { type: 'item.eat', slot });
    expect(me(s).energy).toBeGreaterThan(70);
    expect(me(s).buff).toBe('speed');
  });

  it('crafts a sprinkler and a keg, and the keg turns fruit into juice', () => {
    const s = setup();
    goTo(s, WORKBENCH);
    addItem(me(s).inventory, 'res.copper', 3);
    addItem(me(s).inventory, 'res.stone', 4);
    addItem(me(s).inventory, 'res.wood', 20);
    ok(s, { type: 'craft', recipe: 'sprinkler' });
    me(s).skills.crafting = 100;
    ok(s, { type: 'craft', recipe: 'keg' });
    goTo(s, MACHINE_PADS[0]!);
    ok(s, { type: 'machine.place', pad: 0, slot: me(s).inventory.findIndex(x => x?.item === 'place.keg') });
    addItem(me(s).inventory, 'fruit.peach', 1);
    ok(s, { type: 'machine.load', pad: 0, slot: me(s).inventory.findIndex(x => x?.item === 'fruit.peach') });
    expect(run(s, { type: 'machine.collect', pad: 0 })).toEqual({ ok: false, error: 'not_ready' });
    sleep(s);
    ok(s, { type: 'machine.collect', pad: 0 });
    expect(countItem(me(s).inventory, 'artisan.juice')).toBe(1);
  });

  it('buys seeds in season, ships goods and gets paid in the morning', () => {
    const s = setup();
    s.time.minuteOfDay = 600;
    goTo(s, shopSpot('seeds'));
    const coins = me(s).coins;
    ok(s, { type: 'shop.buy', shop: 'seeds', item: 'seed.carrot', qty: 2 });
    expect(me(s).coins).toBe(coins - 50);
    expect(run(s, { type: 'shop.buy', shop: 'seeds', item: 'seed.pumpkin', qty: 1 })).toEqual({ ok: false, error: 'not_available' });
    goTo(s, SHIPPING_BIN);
    addItem(me(s).inventory, 'crop.pumpkin', 2, 2);
    ok(s, { type: 'ship.add', slot: me(s).inventory.findIndex(x => x?.item === 'crop.pumpkin'), qty: 2 });
    const before = me(s).coins;
    const events = sleep(s);
    expect(me(s).coins).toBe(before + 2 * Math.round(170 * 1.5));
    expect(events.some(e => e.type === 'shipping.paid')).toBe(true);
  });

  it('Bento upgrades a tool for coins and ore', () => {
    const s = setup();
    s.time.minuteOfDay = 600;
    goTo(s, BENTO_SPOT);
    expect(run(s, { type: 'tool.upgrade', tool: 'hoe' })).toEqual({ ok: false, error: 'no_money' });
    me(s).coins = 1000;
    expect(run(s, { type: 'tool.upgrade', tool: 'hoe' })).toEqual({ ok: false, error: 'missing' });
    addItem(me(s).inventory, 'res.copper', 5);
    ok(s, { type: 'tool.upgrade', tool: 'hoe' });
    expect(me(s).toolLevels.hoe).toBe(2);
    expect(me(s).coins).toBe(400);
    expect(countItem(me(s).inventory, 'res.copper')).toBe(0);
  });
});

describe('a week on the island', () => {
  it('money and skills go up, and everything survives a save', () => {
    const s = setup();
    const start = { coins: me(s).coins };
    for (let day = 0; day < 7; day++) {
      // Farm: plant what is free, water everything, harvest what is ripe.
      for (const t of FARM_TILES.filter(t => t.bed === 'NW')) {
        goTo(s, [t.x, t.z]);
        const plot = s.plots[t.id]!;
        if (plot.ripe) ok(s, { type: 'farm.harvest', tile: t.id });
        if (!plot.crop && countItem(me(s).inventory, 'seed.lettuce') > 0) ok(s, { type: 'farm.plant', tile: t.id, item: 'seed.lettuce' });
        if (plot.crop && !plot.watered && me(s).energy > 5) run(s, { type: 'farm.water', tile: t.id });
      }
      // Animals.
      goTo(s, [(PEN.x0 + PEN.x1) / 2, (PEN.z0 + PEN.z1) / 2]);
      for (const a of s.animals) {
        if (a.ready) ok(s, { type: 'animal.collect', animal: a.id });
        if (countItem(me(s).inventory, 'res.hay') === 0) {
          goTo(s, grassPatchCenter(day % 6));
          run(s, { type: 'grass.cut', patch: day % 6 });
          goTo(s, [(PEN.x0 + PEN.x1) / 2, (PEN.z0 + PEN.z1) / 2]);
        }
        run(s, { type: 'animal.feed', animal: a.id });
        ok(s, { type: 'animal.pet', animal: a.id });
      }
      // Sell everything sellable that is not seeds.
      goTo(s, SHIPPING_BIN);
      me(s).inventory.forEach((slot, i) => {
        if (slot && (slot.item.startsWith('crop.') || slot.item.startsWith('animal.'))) ok(s, { type: 'ship.add', slot: i, qty: slot.qty });
      });
      sleep(s);
    }
    expect(me(s).coins).toBeGreaterThan(start.coins);
    expect(skillLevel(me(s).skills.farming)).toBeGreaterThanOrEqual(1);
    expect(skillLevel(me(s).skills.charisma)).toBeGreaterThanOrEqual(1);
    const loaded = readSaveFile(JSON.parse(JSON.stringify(toSaveFile(s, 'sleep', 1))));
    expect(loaded?.state).toEqual(s);
  });
});

describe('older saves', () => {
  it('brings a stage 2 save up to date', () => {
    const v3 = toSaveFile(setup(), 'sleep', 1);
    const old = JSON.parse(JSON.stringify(v3));
    old.version = 2;
    old.state.version = 2;
    for (const key of ['forecast', 'plots', 'animals', 'machines', 'nodes', 'stumps', 'grass', 'hives', 'shipping', 'greenhouse']) delete old.state[key];
    for (const key of ['toolLevels', 'skills', 'buff', 'fishing']) delete old.state.players.local[key];
    const migrated = readSaveFile(old);
    expect(migrated?.state.version).toBe(SAVE_VERSION);
    expect(migrated?.state.animals).toHaveLength(4);
    expect(migrated?.state.players.local!.toolLevels.hoe).toBe(1);
    expect(migrateSave({ version: 1 })).toBeNull();
  });
});
