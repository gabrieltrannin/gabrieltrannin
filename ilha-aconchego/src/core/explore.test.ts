import { describe, expect, it } from 'vitest';
import { MINE_DOOR, MINE_D, MINE_START, MINE_W } from '../data/mine';
import { HOME_BOAT, REGIONS } from '../data/regions';
import { FESTIVAL_CENTER } from '../data/festivals';
import { MUSEUM_DOOR } from '../data/village';
import { applyCommand, type Command } from './commands';
import { mineFloor, mineWall, regionUnlocked } from './explore';
import { addItem, countItem } from './inventory';
import { readSaveFile, toSaveFile } from './save';
import { createInitialState, SAVE_VERSION } from './state';
import type { Actor, GameState } from './types';
import { villagerSpot } from './villagers';
import { absoluteDay } from './clock';

const host: Actor = { id: 'local', role: 'host' };
const SYSTEM: Actor = { id: 'system', role: 'system' };
const setup = () => createInitialState({ seed: 21 });
const me = (s: GameState) => s.players.local!;
const run = (s: GameState, cmd: Command) => applyCommand(s, cmd, host);
const ok = (s: GameState, cmd: Command) => {
  const r = run(s, cmd);
  if (!r.ok) throw new Error(`${cmd.type} failed: ${r.error}`);
  return r.events;
};
const goTo = (s: GameState, [x, z]: readonly [number, number]) => (me(s).position = { x, z, facing: 0 });
const slotOf = (s: GameState, item: string) => me(s).inventory.findIndex(x => x?.item === item);
const sleep = (s: GameState) => applyCommand(s, { type: 'sleep' }, SYSTEM);

describe('regions by boat', () => {
  it('open with friendship and tools, and the boat takes you there and back', () => {
    const s = setup();
    goTo(s, HOME_BOAT);
    expect(run(s, { type: 'travel.go', region: 'beach' })).toEqual({ ok: false, error: 'not_available' });
    me(s).friends.pipo.points = 200;
    expect(regionUnlocked(me(s), 'beach')).toBe(true);
    expect(regionUnlocked(me(s), 'forest')).toBe(false);
    ok(s, { type: 'travel.go', region: 'beach' });
    expect(me(s).away).toEqual({ kind: 'region', id: 'beach' });
    expect(me(s).explore.visited).toEqual(['beach']);
    expect(me(s).achievements).toContain('regions1');
    // Walking on the region's land; the sea is not walkable; home spots are out of reach.
    ok(s, { type: 'player.move', x: 10, z: 15, facing: 0 });
    expect(run(s, { type: 'player.move', x: 40, z: 40, facing: 0 })).toEqual({ ok: false, error: 'invalid' });
    expect(run(s, { type: 'mine.enter' })).toEqual({ ok: false, error: 'too_far' });
    goTo(s, REGIONS.beach.boat);
    ok(s, { type: 'travel.home' });
    expect(me(s).away).toBeNull();
    // The other three: tools and friends.
    me(s).toolLevels.axe = 2;
    me(s).friends.flora.points = 200;
    me(s).toolLevels.pickaxe = 3;
    me(s).friends.bento.points = 400;
    me(s).toolLevels.bugNet = 2;
    me(s).friends.juca.points = 400;
    for (const region of ['forest', 'volcano', 'clouds'] as const) {
      goTo(s, HOME_BOAT);
      ok(s, { type: 'travel.go', region });
      goTo(s, REGIONS[region].boat);
      ok(s, { type: 'travel.home' });
    }
    expect(me(s).achievements).toContain('regions4');
  });

  it('picking things up, tall grass and the region rocks, once a day', () => {
    const s = setup();
    me(s).friends.pipo.points = 200;
    goTo(s, HOME_BOAT);
    ok(s, { type: 'travel.go', region: 'beach' });
    goTo(s, REGIONS.beach.forage[0]!.at);
    const got = ok(s, { type: 'explore.forage', spot: 0 }).find(e => e.type === 'item.gained');
    expect(got).toBeTruthy();
    expect(run(s, { type: 'explore.forage', spot: 0 })).toEqual({ ok: false, error: 'not_available' });
    goTo(s, REGIONS.beach.grass[0]!);
    const grass = ok(s, { type: 'explore.grass', clump: 0 }).find(e => e.type === 'grass.searched');
    expect(grass).toBeTruthy();
    sleep(s);
    expect(s.explore.taken).toEqual([]);
    expect(me(s).away).toBeNull();
  });
});

describe('the mines', () => {
  it('floors are the same for everyone, every open tile is reachable, and the ladder hides under a rock', () => {
    for (const floor of [1, 7, 15, 30]) {
      const f = mineFloor(99, floor, 3);
      expect(mineFloor(99, floor, 3)).toEqual(f);
      const seen = new Set<string>();
      const queue: [number, number][] = [[Math.floor(MINE_START[0]), Math.floor(MINE_START[1])]];
      while (queue.length) {
        const [x, z] = queue.pop()!;
        const key = `${x},${z}`;
        if (seen.has(key) || mineWall(f, x + 0.5, z + 0.5)) continue;
        seen.add(key);
        queue.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
      }
      let open = 0;
      for (let z = 0; z < MINE_D; z++) for (let x = 0; x < MINE_W; x++) if (!mineWall(f, x + 0.5, z + 0.5)) open++;
      expect(seen.size).toBe(open);
      for (const r of f.rocks) expect(mineWall(f, r.x + 0.5, r.z + 0.5)).toBe(false);
      expect(floor === 30 ? f.ladder : f.rocks[f.ladder]).toBeTruthy();
      if (floor === 30) expect(f.treasure).toBeTruthy();
    }
  });

  it('go down by the ladder, use the elevator every 5 floors, and climb out', () => {
    const s = setup();
    goTo(s, MINE_DOOR);
    const events = ok(s, { type: 'mine.enter' });
    expect(me(s).away).toEqual({ kind: 'mine', floor: 1 });
    expect(events).toContainEqual({ type: 'item.gained', playerId: 'local', item: 'gear.wand', qty: 1, q: 0 });
    const f = mineFloor(s.seed, 1, absoluteDay(s.time));
    const ladder = f.rocks[f.ladder]!;
    expect(run(s, { type: 'mine.down' })).toEqual({ ok: false, error: 'not_available' });
    goTo(s, [ladder.x + 0.5, ladder.z + 1.2]);
    const broke = ok(s, { type: 'mine.break', rock: f.ladder });
    expect(broke.find(e => e.type === 'mine.broken')).toMatchObject({ ladder: true });
    expect(ok(s, { type: 'mine.down' })).toContainEqual({ type: 'mine.floor', playerId: 'local', floor: 2, first: true });
    expect(me(s).away).toEqual({ kind: 'mine', floor: 2 });
    expect(me(s).explore.deepest).toBe(2);
    // The elevator: only stops already reached.
    me(s).explore.deepest = 12;
    expect(run(s, { type: 'mine.elevator', floor: 5 })).toEqual({ ok: false, error: 'not_available' });
    me(s).away = { kind: 'mine', floor: 1 };
    goTo(s, MINE_START);
    ok(s, { type: 'mine.elevator', floor: 10 });
    expect(me(s).away).toEqual({ kind: 'mine', floor: 10 });
    expect(run(s, { type: 'mine.elevator', floor: 15 })).toEqual({ ok: false, error: 'invalid' });
    ok(s, { type: 'mine.exit' });
    expect(me(s).away).toBeNull();
    expect(me(s).position).toMatchObject({ x: MINE_DOOR[0], z: MINE_DOOR[1] });
  });
});

describe('creatures, puzzles and options', () => {
  it('the bubble wand calms creatures; bumps cost energy; the peaceful option turns them off', () => {
    const s = setup();
    me(s).friends.pipo.points = 200;
    goTo(s, HOME_BOAT);
    ok(s, { type: 'travel.go', region: 'beach' });
    const c = REGIONS.beach.creatures[0]!;
    goTo(s, c.at);
    expect(run(s, { type: 'creature.calm', id: 'beach:0' })).toEqual({ ok: false, error: 'no_tool' });
    const energy = me(s).energy;
    ok(s, { type: 'creature.bump', id: 'beach:0' });
    expect(me(s).energy).toBe(energy - 6);
    addItem(me(s).inventory, 'gear.wand', 1);
    ok(s, { type: 'creature.calm', id: 'beach:0' });
    expect(me(s).stats.calmed).toBe(1);
    expect(run(s, { type: 'creature.calm', id: 'beach:0' })).toEqual({ ok: false, error: 'not_available' });
    // Out of energy: wake up at home.
    me(s).energy = 3;
    goTo(s, REGIONS.beach.creatures[1]!.at);
    ok(s, { type: 'creature.bump', id: 'beach:1' });
    expect(me(s).away).toBeNull();
    expect(run(s, { type: 'options.set', peaceful: true })).toEqual({ ok: true, events: [{ type: 'options.changed' }] });
    expect(applyCommand(s, { type: 'options.set', peaceful: false }, { id: 'friend', role: 'resident' })).toEqual({ ok: false, error: 'forbidden' });
    goTo(s, HOME_BOAT);
    ok(s, { type: 'travel.go', region: 'beach' });
    goTo(s, REGIONS.beach.creatures[2]!.at);
    expect(run(s, { type: 'creature.bump', id: 'beach:2' })).toEqual({ ok: false, error: 'not_available' });
  });

  it('push blocks onto the plates, press switches in order, ring the bells; each chest opens once', () => {
    const s = setup();
    me(s).friends.pipo.points = 200;
    goTo(s, HOME_BOAT);
    ok(s, { type: 'travel.go', region: 'beach' });
    const push = (block: number, dir: 'n' | 's' | 'e' | 'w') => {
      const [x, z] = s.explore.puzzles.beach?.blocks[block] ?? (REGIONS.beach.puzzle as { blocks: readonly (readonly [number, number])[] }).blocks[block]!;
      const back = { n: [0, 1], s: [0, -1], e: [-1, 0], w: [1, 0] }[dir];
      goTo(s, [x + 0.5 + back[0]! * 0.9, z + 0.5 + back[1]! * 0.9]);
      return ok(s, { type: 'puzzle.push', block, dir });
    };
    // You cannot pull: standing on the wrong side is refused.
    goTo(s, [20.5 - 0.9, 11.5]);
    expect(run(s, { type: 'puzzle.push', block: 0, dir: 'w' })).toEqual({ ok: false, error: 'invalid' });
    push(0, 'w');
    push(0, 's');
    push(0, 's');
    push(1, 'e');
    push(1, 'n');
    push(1, 'n');
    const last = push(1, 'n');
    expect(last).toContainEqual({ type: 'puzzle.solved', region: 'beach' });
    goTo(s, REGIONS.beach.puzzle.chest);
    ok(s, { type: 'puzzle.chest' });
    expect(countItem(me(s).inventory, 'shell.pearl')).toBe(1);
    expect(run(s, { type: 'puzzle.chest' })).toEqual({ ok: false, error: 'not_available' });
    // The forest's mushrooms: small, medium, big.
    me(s).toolLevels.axe = 2;
    me(s).friends.flora.points = 200;
    goTo(s, REGIONS.beach.boat);
    ok(s, { type: 'travel.home' });
    goTo(s, HOME_BOAT);
    ok(s, { type: 'travel.go', region: 'forest' });
    const sw = REGIONS.forest.puzzle as { switches: readonly (readonly [number, number])[] };
    const press = (i: number) => {
      goTo(s, sw.switches[i]!);
      return ok(s, { type: 'puzzle.press', index: i });
    };
    expect(press(0)).toContainEqual({ type: 'puzzle.pressed', playerId: 'local', region: 'forest', correct: false });
    press(1);
    press(2);
    expect(press(0)).toContainEqual({ type: 'puzzle.solved', region: 'forest' });
  });
});

describe('festivals and the museum', () => {
  it('on the festival day the villagers gather and the game pays once', () => {
    const s = setup();
    applyCommand(s, { type: 'time.setDate', seasonIndex: 0, day: 13 }, SYSTEM);
    applyCommand(s, { type: 'time.sync', minuteOfDay: 600 }, SYSTEM);
    expect(villagerSpot(s, 'lumi').place).toBe('festival');
    expect(villagerSpot(s, 'margo').at).toEqual([FESTIVAL_CENTER[0], FESTIVAL_CENTER[1]]);
    goTo(s, FESTIVAL_CENTER);
    const coins = me(s).coins;
    const done = ok(s, { type: 'festival.play', score: 5 });
    expect(done[0]).toMatchObject({ type: 'festival.done', festival: 'flowers', score: 5, prize: 'furn.flowerArch' });
    expect(me(s).coins).toBe(coins + 5 * 25 + 100);
    expect(run(s, { type: 'festival.play', score: 6 })).toEqual({ ok: false, error: 'already' });
    expect(me(s).achievements).toContain('festival1');
    applyCommand(s, { type: 'time.setDate', seasonIndex: 0, day: 14 }, SYSTEM);
    expect(villagerSpot(s, 'lumi').place).not.toBe('festival');
  });

  it('takes shells and fossils too', () => {
    const s = setup();
    s.projects.museum.done = true;
    goTo(s, MUSEUM_DOOR);
    addItem(me(s).inventory, 'shell.nautilus', 1);
    addItem(me(s).inventory, 'fossil.ammonite', 1);
    ok(s, { type: 'museum.donate', slot: slotOf(s, 'shell.nautilus') });
    ok(s, { type: 'museum.donate', slot: slotOf(s, 'fossil.ammonite') });
    expect(s.museum).toEqual(['shell.nautilus', 'fossil.ammonite']);
  });
});

describe('saves (stage 6)', () => {
  it('keeps where you are and brings stage 5 saves up to date', () => {
    const s = setup();
    me(s).away = { kind: 'mine', floor: 4 };
    me(s).explore.deepest = 4;
    s.explore.puzzles.beach = { blocks: [[19, 13], [25, 10]], pressed: [], solved: true };
    const loaded = readSaveFile(JSON.parse(JSON.stringify(toSaveFile(s, 'resume', 1))));
    expect(loaded?.state).toEqual(s);
    const old = JSON.parse(JSON.stringify(toSaveFile(setup(), 'sleep', 1)));
    old.version = 5;
    old.state.version = 5;
    for (const key of ['explore', 'options']) delete old.state[key];
    for (const key of ['away', 'explore']) delete old.state.players.local[key];
    const migrated = readSaveFile(old);
    expect(migrated?.state.version).toBe(SAVE_VERSION);
    expect(migrated?.state.options.peaceful).toBe(false);
    expect(migrated?.state.players.local!.explore.deepest).toBe(0);
  });
});

describe('stage 6 places', () => {
  it('everything in the regions stands on land, and the mine door is on walkable beach', async () => {
    const { regionGround } = await import('./explore');
    const { buildColliders, resolve, walkableHeight } = await import('../world/collision');
    for (const def of Object.values(REGIONS)) {
      const spots: [string, readonly [number, number]][] = [
        ['arrive', def.arrive], ['chest', def.puzzle.chest],
        ...def.forage.map((f, i) => [`forage ${i}`, f.at] as [string, readonly [number, number]]),
        ...def.nodes.map((f, i) => [`node ${i}`, f.at] as [string, readonly [number, number]]),
        ...def.grass.map((g, i) => [`grass ${i}`, g] as [string, readonly [number, number]]),
        ...def.creatures.map((c, i) => [`creature ${i}`, c.at] as [string, readonly [number, number]]),
        ...def.winds.flatMap((w, i) => [[`wind ${i}a`, w.a], [`wind ${i}b`, w.b]] as [string, readonly [number, number]][]),
      ];
      if (def.puzzle.kind === 'switches') def.puzzle.switches.forEach((p, i) => spots.push([`switch ${i}`, p]));
      if (def.puzzle.kind === 'bells') def.puzzle.bells.forEach((p, i) => spots.push([`bell ${i}`, p]));
      if (def.puzzle.kind === 'push') [...def.puzzle.blocks, ...def.puzzle.plates].forEach((p, i) => spots.push([`cell ${i}`, [p[0] + 0.5, p[1] + 0.5]]));
      // Two things to act on never sit on top of each other, or one would hide the other's E.
      const acts = spots.filter(([n]) => !/^(arrive|creature|wind)/.test(n));
      for (const [i, [na, a]] of acts.entries()) {
        for (const [nb, b] of acts.slice(i + 1)) {
          if (na.startsWith('cell') && nb.startsWith('cell')) continue;
          expect(Math.hypot(a[0] - b[0], a[1] - b[1]), `${def.id} ${na} too close to ${nb}`).toBeGreaterThan(1.4);
        }
      }
      for (const [name, [x, z]] of spots) {
        expect(regionGround(def.id, x, z), `${def.id} ${name}`).not.toBeNull();
        for (const w of def.walls) expect(x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1, `${def.id} ${name} in a wall`).toBe(false);
        for (const p of def.props) if (p.r) expect(Math.hypot(x - p.at[0], z - p.at[1]), `${def.id} ${name} in ${p.asset}`).toBeGreaterThan(p.r + 0.2);
      }
    }
    expect(walkableHeight(MINE_DOOR[0], MINE_DOOR[1])).not.toBeNull();
    const [rx, rz] = resolve(MINE_DOOR[0], MINE_DOOR[1], buildColliders({ bridgeFixed: true }), 'summer');
    expect(Math.hypot(rx - MINE_DOOR[0], rz - MINE_DOOR[1])).toBeLessThan(0.05);
  });
});
