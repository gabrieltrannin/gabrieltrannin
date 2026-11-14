import { describe, expect, it } from 'vitest';
import { PROJECTS } from '../data/community';
import { MAILBOX } from '../data/map';
import { MUSEUM_DOOR, NOTICE_BOARD } from '../data/village';
import { hearts, villager, type NpcId } from '../data/villagers';
import { applyCommand, type Command } from './commands';
import { addItem, countItem } from './inventory';
import { readSaveFile, toSaveFile } from './save';
import { createInitialState, SAVE_VERSION } from './state';
import type { Actor, GameState } from './types';
import { reactionTo, scheduleAt, shopOpen, villagerSpot } from './villagers';

const host: Actor = { id: 'local', role: 'host' };
const SYSTEM: Actor = { id: 'system', role: 'system' };
const setup = () => createInitialState({ seed: 7 });
const me = (s: GameState) => s.players.local!;
const run = (s: GameState, cmd: Command) => applyCommand(s, cmd, host);
const ok = (s: GameState, cmd: Command) => {
  const r = run(s, cmd);
  if (!r.ok) throw new Error(`${cmd.type} failed: ${r.error}`);
  return r.events;
};
const sleep = (s: GameState) => applyCommand(s, { type: 'sleep' }, SYSTEM);
const goTo = (s: GameState, [x, z]: readonly [number, number]) => (me(s).position = { x, z, facing: 0 });
const goToNpc = (s: GameState, npc: NpcId) => goTo(s, villagerSpot(s, npc).at);
const slotOf = (s: GameState, item: string) => me(s).inventory.findIndex(x => x?.item === item);

describe('villagers', () => {
  it('each one has a house, a routine and gift tastes', () => {
    expect(reactionTo(villager('lumi'), 'dish.blackberryPie')).toBe('love');
    expect(reactionTo(villager('lumi'), 'animal.egg')).toBe('like');
    expect(reactionTo(villager('lumi'), 'fish.sardine')).toBe('dislike');
    expect(reactionTo(villager('lumi'), 'crop.kale')).toBe('neutral');
    expect(reactionTo(villager('pipo'), 'fish.moonfish')).toBe('love');
  });

  it('follow their routine by the clock and by the weather', () => {
    const lumi = villager('lumi'), dudu = villager('dudu');
    expect(scheduleAt(lumi.routine, 400).place).toBe('home');
    expect(scheduleAt(lumi.routine, 600).place).toBe('stall.bread');
    expect(scheduleAt(lumi.routine, 1300).place).toBe('home');
    const s = setup();
    s.time.minuteOfDay = 450;
    s.weather = 'sun';
    expect(villagerSpot(s, 'dudu').place).toBe('hives');
    s.weather = 'rain';
    expect(villagerSpot(s, 'dudu').place).toBe('home');
    expect(dudu.rain).toBeDefined();
  });

  it('shops open only while their keeper is at the counter', () => {
    const s = setup();
    s.time.minuteOfDay = 600;
    expect(shopOpen(s, 'bread')).toBe(true);
    s.time.minuteOfDay = 1300;
    expect(shopOpen(s, 'bread')).toBe(false);
  });
});

describe('friendship', () => {
  it('a chat a day and gifts raise the hearts; gifts are remembered', () => {
    const s = setup();
    s.time.minuteOfDay = 600;
    goToNpc(s, 'lumi');
    ok(s, { type: 'npc.talk', npc: 'lumi' });
    ok(s, { type: 'npc.talk', npc: 'lumi' });
    expect(me(s).friends.lumi.points).toBe(20);
    addItem(me(s).inventory, 'dish.blackberryPie', 2);
    ok(s, { type: 'npc.gift', npc: 'lumi', slot: slotOf(s, 'dish.blackberryPie') });
    expect(me(s).friends.lumi.points).toBe(100);
    expect(hearts(me(s).friends.lumi.points)).toBe(1);
    expect(run(s, { type: 'npc.gift', npc: 'lumi', slot: slotOf(s, 'dish.blackberryPie') })).toEqual({ ok: false, error: 'already' });
    expect(me(s).friends.lumi.known['dish.blackberryPie']).toBe('love');
    expect(me(s).friends.lumi.lastGift?.item).toBe('dish.blackberryPie');
  });

  it('birthday gifts count double, and a special scene comes every 2 hearts', () => {
    const s = setup();
    s.time.day = 9;
    s.time.minuteOfDay = 600;
    goToNpc(s, 'lumi');
    addItem(me(s).inventory, 'crop.strawberry', 1);
    ok(s, { type: 'npc.gift', npc: 'lumi', slot: slotOf(s, 'crop.strawberry') });
    expect(me(s).friends.lumi.points).toBe(160);
    me(s).friends.lumi.points = 200;
    const events = ok(s, { type: 'npc.talk', npc: 'lumi' });
    expect(events.find(e => e.type === 'npc.talked')).toMatchObject({ scene: 2 });
  });

  it('sends a letter with a present at 4 hearts', () => {
    const s = setup();
    me(s).friends.pipo.points = 420;
    sleep(s);
    const letter = me(s).mail.find(m => m.from === 'pipo');
    expect(letter).toMatchObject({ key: 'mail.friend', item: 'fish.sardine' });
    goTo(s, MAILBOX);
    ok(s, { type: 'mail.take', id: letter!.id });
    expect(countItem(me(s).inventory, 'fish.sardine')).toBe(1);
  });
});

describe('notice board and projects', () => {
  it("Lumi's first request: 3 strawberries for 300 coins", () => {
    const s = setup();
    const request = s.requests[0]!;
    expect(request).toMatchObject({ npc: 'lumi', item: 'crop.strawberry', qty: 3, reward: 300 });
    s.time.minuteOfDay = 600;
    goToNpc(s, 'lumi');
    expect(run(s, { type: 'request.deliver', request: request.id })).toEqual({ ok: false, error: 'missing' });
    addItem(me(s).inventory, 'crop.strawberry', 3);
    const coins = me(s).coins;
    ok(s, { type: 'request.deliver', request: request.id });
    expect(me(s).coins).toBe(coins + 300);
    expect(countItem(me(s).inventory, 'crop.strawberry')).toBe(0);
    expect(me(s).friends.lumi.points).toBe(100);
    sleep(s);
    expect(s.requests.length).toBe(3);
    expect(s.requests.every(r => !r.done && r.qty > 0 && r.reward > 0)).toBe(true);
  });

  it('fixing the bridge and opening the museum unlock new things', () => {
    const s = setup();
    goTo(s, NOTICE_BOARD);
    const bridge = PROJECTS.find(p => p.id === 'bridge')!;
    me(s).coins = 5000;
    for (const need of bridge.needs) {
      addItem(me(s).inventory, need.item, need.qty);
      ok(s, { type: 'project.contribute', project: 'bridge', item: need.item, qty: need.qty });
    }
    expect(s.projects.bridge.done).toBe(false);
    const events = ok(s, { type: 'project.contribute', project: 'bridge', item: 'coins', qty: bridge.coins });
    expect(s.projects.bridge.done).toBe(true);
    expect(events.some(e => e.type === 'project.done')).toBe(true);
    expect(me(s).mail.some(m => m.key === 'mail.project.bridge')).toBe(true);

    goTo(s, MUSEUM_DOOR);
    addItem(me(s).inventory, 'fish.sardine', 2);
    expect(run(s, { type: 'museum.donate', slot: slotOf(s, 'fish.sardine') })).toEqual({ ok: false, error: 'not_available' });
    s.projects.museum.done = true;
    ok(s, { type: 'museum.donate', slot: slotOf(s, 'fish.sardine') });
    expect(run(s, { type: 'museum.donate', slot: slotOf(s, 'fish.sardine') })).toEqual({ ok: false, error: 'already' });
    expect(s.museum).toEqual(['fish.sardine']);
  });
});

describe('saves', () => {
  it('keeps friendships, mail and projects, and brings stage 3 saves up to date', () => {
    const s = setup();
    me(s).friends.lumi.points = 250;
    const loaded = readSaveFile(JSON.parse(JSON.stringify(toSaveFile(s, 'sleep', 1))));
    expect(loaded?.state).toEqual(s);
    const old = JSON.parse(JSON.stringify(toSaveFile(setup(), 'sleep', 1)));
    old.version = 3;
    old.state.version = 3;
    for (const key of ['requests', 'requestSeq', 'projects', 'museum']) delete old.state[key];
    for (const key of ['friends', 'mail', 'mailSeq']) delete old.state.players.local[key];
    const migrated = readSaveFile(old);
    expect(migrated?.state.version).toBe(SAVE_VERSION);
    expect(migrated?.state.requests[0]?.npc).toBe('lumi');
    expect(migrated?.state.players.local!.friends.nico.points).toBe(0);
  });
});
