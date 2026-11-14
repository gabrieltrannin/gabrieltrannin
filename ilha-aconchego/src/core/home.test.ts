import { describe, expect, it } from 'vitest';
import { DIG_SPOTS, PLAYER_STALL_SPOT, STAR_POINTS } from '../data/rating';
import { DOOR_SPOT, ENTRY_SPOT, stairsOn, stairsSpot } from '../data/house';
import { HOUSE_DOOR, KITCHEN, PLAYER_START } from '../data/map';
import { talentsAt } from '../data/talents';
import { villager, type NpcId } from '../data/villagers';
import { applyCommand, type Command } from './commands';
import { outdoorTileFree, placementError } from './decor';
import { addItem, countItem } from './inventory';
import { islandScore } from './rating';
import { energyCost } from './rules';
import { readSaveFile, toSaveFile } from './save';
import { createInitialState, SAVE_VERSION } from './state';
import type { Actor, GameState } from './types';
import { villagerSpot } from './villagers';

const host: Actor = { id: 'local', role: 'host' };
const SYSTEM: Actor = { id: 'system', role: 'system' };
const setup = () => createInitialState({ seed: 11 });
const me = (s: GameState) => s.players.local!;
const run = (s: GameState, cmd: Command) => applyCommand(s, cmd, host);
const ok = (s: GameState, cmd: Command) => {
  const r = run(s, cmd);
  if (!r.ok) throw new Error(`${cmd.type} failed: ${r.error}`);
  return r.events;
};
const goTo = (s: GameState, [x, z]: readonly [number, number]) => (me(s).position = { x, z, facing: 0 });
const goToNpc = (s: GameState, npc: NpcId) => goTo(s, villagerSpot(s, npc).at);
const slotOf = (s: GameState, item: string) => me(s).inventory.findIndex(x => x?.item === item);
const give = (s: GameState, item: Parameters<typeof addItem>[1], qty = 1) => addItem(me(s).inventory, item, qty);

/** A free 2 × 2 patch of tiles near a spot outside. */
function freeTileNear(s: GameState, cx: number, cz: number): [number, number] {
  for (let r = 0; r < 6; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const x = Math.floor(cx) + dx, z = Math.floor(cz) + dz;
        if ([0, 1].every(i => [0, 1].every(j => outdoorTileFree(x + i, z + j))) && placementError(s, { kind: 'island' }, 'furn.fountain', x, z, 0) === null) return [x, z];
      }
    }
  }
  throw new Error('no free tile');
}

describe('decorating the island', () => {
  it('places, turns, moves and puts away furniture on the grid', () => {
    const s = setup();
    const [x, z] = freeTileNear(s, 1.5, 3.5);
    goTo(s, [x + 1, z + 3]);
    give(s, 'furn.chair');
    give(s, 'furn.stonePath', 2);
    ok(s, { type: 'decor.place', slot: slotOf(s, 'furn.stonePath'), x, z, rot: 0 });
    // A chair may stand on a flat path, but not on another chair.
    ok(s, { type: 'decor.place', slot: slotOf(s, 'furn.chair'), x, z, rot: 0 });
    give(s, 'furn.chair');
    expect(run(s, { type: 'decor.place', slot: slotOf(s, 'furn.chair'), x, z, rot: 1 })).toEqual({ ok: false, error: 'occupied' });
    expect(s.decor.map(d => d.item)).toEqual(['furn.stonePath', 'furn.chair']);
    const chair = s.decor[1]!;
    ok(s, { type: 'decor.move', id: chair.id, x: x + 1, z, rot: 2 });
    expect(s.decor[1]).toMatchObject({ x: x + 1, z, rot: 2 });
    ok(s, { type: 'decor.store', id: chair.id });
    expect(countItem(me(s).inventory, 'furn.chair')).toBe(2);
    // A bed only goes inside, and nothing goes far from the player or on the house door.
    give(s, 'furn.bed');
    expect(run(s, { type: 'decor.place', slot: slotOf(s, 'furn.bed'), x, z, rot: 0 })).toEqual({ ok: false, error: 'invalid' });
    expect(run(s, { type: 'decor.place', slot: slotOf(s, 'furn.chair'), x: x + 20, z, rot: 0 })).toEqual({ ok: false, error: 'occupied' });
    expect(outdoorTileFree(Math.floor(HOUSE_DOOR[0]), Math.floor(HOUSE_DOOR[1]))).toBe(false);
  });

  it('the island rating goes up with decorations and brings a newcomer at 3 stars', () => {
    const s = setup();
    expect(s.stars).toBe(1);
    const before = islandScore(s).total;
    const [x, z] = freeTileNear(s, 1.5, 3.5);
    goTo(s, [x + 1, z + 3]);
    give(s, 'furn.fountain');
    ok(s, { type: 'decor.place', slot: slotOf(s, 'furn.fountain'), x, z, rot: 0 });
    expect(islandScore(s).total).toBeGreaterThan(before);
    // Lots of beauty at once: three stars, and Mel moves in (with a letter).
    s.decor.push(...Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, item: 'furn.umbrella' as const, x: 200 + i, z: 0, rot: 0 })));
    s.players.local!.home.level = 3;
    expect(islandScore(s).total).toBeGreaterThanOrEqual(STAR_POINTS[2]!);
    const events = ok(s, { type: 'photo.taken' });
    expect(events).toContainEqual({ type: 'stars.up', stars: s.stars });
    expect(s.stars).toBeGreaterThanOrEqual(3);
    expect(s.arrived).toContain('mel');
    expect(me(s).mail.some(m => m.key === 'mail.newcomer')).toBe(true);
    expect(villagerSpot(s, 'mel').place).not.toBe('away');
  });
});

describe('the house', () => {
  it('goes in and out, decorates inside, and sleeps in the bed', () => {
    const s = setup();
    goTo(s, HOUSE_DOOR);
    ok(s, { type: 'home.enter' });
    expect(me(s).inside).toBe('ground');
    expect(me(s).position).toMatchObject({ x: ENTRY_SPOT[0], z: ENTRY_SPOT[1] });
    // Outside things are out of reach from inside.
    give(s, 'crop.lettuce');
    give(s, 'crop.carrot');
    expect(run(s, { type: 'craft', station: 'kitchen', recipe: 'salad' })).toEqual({ ok: false, error: 'too_far' });
    // Starting furniture: the bed, the wardrobe and the mirror.
    expect(me(s).home.floors.ground!.map(d => d.item)).toContain('furn.bed');
    give(s, 'furn.plant');
    expect(run(s, { type: 'decor.place', slot: slotOf(s, 'furn.plant'), x: 3, z: 5, rot: 0 })).toEqual({ ok: false, error: 'occupied' });
    expect(run(s, { type: 'decor.place', slot: slotOf(s, 'furn.plant'), x: 9, z: 1, rot: 0 })).toEqual({ ok: false, error: 'invalid' });
    ok(s, { type: 'decor.place', slot: slotOf(s, 'furn.plant'), x: 6, z: 1, rot: 0 });
    expect(run(s, { type: 'sleep' })).toEqual({ ok: false, error: 'too_far' });
    goTo(s, [1, 2.4]);
    ok(s, { type: 'sleep' });
    expect(me(s).inside).toBe('ground');
    goTo(s, DOOR_SPOT);
    ok(s, { type: 'home.exit' });
    expect(me(s).inside).toBeNull();
    expect(me(s).position).toMatchObject({ x: PLAYER_START.x, z: PLAYER_START.z });
  });

  it('grows with Lino: a side room, stairs up and a cellar', () => {
    const s = setup();
    s.time.minuteOfDay = 600;
    goToNpc(s, 'lino');
    expect(run(s, { type: 'home.upgrade' })).toEqual({ ok: false, error: 'no_money' });
    me(s).coins = 50000;
    give(s, 'res.wood', 99);
    give(s, 'res.wood', 50);
    give(s, 'res.stone', 99);
    give(s, 'res.copper', 20);
    ok(s, { type: 'home.upgrade' });
    expect(me(s).home.level).toBe(1);
    // Furniture where the stairs will go comes back to the backpack.
    me(s).home.floors.ground!.push({ id: 99, item: 'furn.crate', x: 9, z: 1, rot: 0 });
    ok(s, { type: 'home.upgrade' });
    expect(me(s).home.level).toBe(2);
    expect(me(s).home.floors.ground!.some(d => d.id === 99)).toBe(false);
    expect(countItem(me(s).inventory, 'furn.crate')).toBe(1);
    ok(s, { type: 'home.upgrade' });
    expect(run(s, { type: 'home.upgrade' })).toEqual({ ok: false, error: 'not_available' });
    goTo(s, HOUSE_DOOR);
    ok(s, { type: 'home.enter' });
    const up = stairsOn(3, 'ground').find(x => x.to === 'upper')!;
    goTo(s, stairsSpot(up));
    ok(s, { type: 'home.stairs', to: 'upper' });
    expect(me(s).inside).toBe('upper');
    expect(me(s).achievements).toContain('home3');
  });
});

describe('crafting stations and recipes', () => {
  it('wool becomes yarn, yarn becomes fabric, fabric becomes a sweater at the knitting table', () => {
    const s = setup();
    give(s, 'furn.loom');
    goTo(s, HOUSE_DOOR);
    ok(s, { type: 'home.enter' });
    ok(s, { type: 'decor.place', slot: slotOf(s, 'furn.loom'), x: 6, z: 2, rot: 0 });
    goTo(s, [5.4, 2.5]);
    give(s, 'animal.wool', 8);
    for (let i = 0; i < 4; i++) ok(s, { type: 'craft', station: 'knitting', recipe: 'yarn' });
    expect(countItem(me(s).inventory, 'artisan.yarn')).toBe(4);
    ok(s, { type: 'craft', station: 'knitting', recipe: 'fabric' });
    ok(s, { type: 'craft', station: 'knitting', recipe: 'fabric' });
    // Four yarns and two fabrics later, crafting is at level 1: the sweater is known.
    expect(me(s).skills.crafting).toBeGreaterThanOrEqual(60);
    expect(run(s, { type: 'craft', station: 'knitting', recipe: 'sweater' })).toEqual({ ok: false, error: 'missing' });
    give(s, 'artisan.yarn');
    ok(s, { type: 'craft', station: 'knitting', recipe: 'sweater' });
    expect(countItem(me(s).inventory, 'cloth.sweater')).toBe(1);
    // A station of another kind is not here.
    expect(run(s, { type: 'craft', station: 'jewelry', recipe: 'copperRing' })).toEqual({ ok: false, error: 'too_far' });
  });

  it('finds secret recipes by experimenting, from books and from friends', () => {
    const s = setup();
    goTo(s, KITCHEN);
    give(s, 'fruit.peach', 3);
    give(s, 'crop.lettuce');
    expect(run(s, { type: 'craft', station: 'kitchen', recipe: 'jam' })).toEqual({ ok: false, error: 'not_available' });
    const miss = ok(s, { type: 'craft.experiment', station: 'kitchen', items: ['crop.lettuce', 'fruit.peach'] });
    expect(miss[0]).toMatchObject({ type: 'experiment.failed', known: null });
    expect(countItem(me(s).inventory, 'fruit.peach')).toBe(3);
    const found = ok(s, { type: 'craft.experiment', station: 'kitchen', items: ['fruit.peach'] });
    expect(found).toContainEqual({ type: 'recipe.learned', playerId: 'local', recipe: 'jam', how: 'experiment' });
    expect(countItem(me(s).inventory, 'dish.jam')).toBe(1);
    expect(me(s).achievements).toContain('experiment');
    // A book teaches its recipes once.
    give(s, 'book.alchemy');
    ok(s, { type: 'book.read', slot: slotOf(s, 'book.alchemy') });
    expect(me(s).recipes).toEqual(expect.arrayContaining(['dyeNavy', 'dyeLilac']));
    give(s, 'book.alchemy');
    expect(run(s, { type: 'book.read', slot: slotOf(s, 'book.alchemy') })).toEqual({ ok: false, error: 'already' });
    // A friend at 4 hearts teaches theirs by letter.
    me(s).friends.lumi.points = 420;
    applyCommand(s, { type: 'sleep' }, SYSTEM);
    expect(me(s).recipes).toContain(villager('lumi').teaches);
    expect(me(s).mail.some(m => m.key === 'mail.recipe')).toBe(true);
  });
});

describe('the wardrobe, the mirror and the salon', () => {
  it('stores sewn clothes and dyes, and changes the look only where allowed', () => {
    const s = setup();
    give(s, 'cloth.sweater');
    give(s, 'dye.navy');
    ok(s, { type: 'wardrobe.store', slot: slotOf(s, 'cloth.sweater') });
    ok(s, { type: 'wardrobe.dye', slot: slotOf(s, 'dye.navy') });
    expect(me(s).wardrobe).toEqual({ outfits: ['sweater'], accessories: [], colors: ['#2E3A6B'] });
    const look = { ...me(s).appearance, outfit: 'sweater' as const, topColor: '#2E3A6B' };
    expect(run(s, { type: 'look.change', via: 'wardrobe', appearance: look })).toEqual({ ok: false, error: 'too_far' });
    goTo(s, HOUSE_DOOR);
    ok(s, { type: 'home.enter' });
    goTo(s, [6, 1.6]);
    ok(s, { type: 'look.change', via: 'wardrobe', appearance: look });
    expect(me(s).appearance.outfit).toBe('sweater');
    // The mirror changes face and hair, not clothes.
    goTo(s, [4.5, 1.6]);
    expect(run(s, { type: 'look.change', via: 'mirror', appearance: { ...me(s).appearance, outfit: 'dress' } })).toEqual({ ok: false, error: 'invalid' });
    ok(s, { type: 'look.change', via: 'mirror', appearance: { ...me(s).appearance, hairStyle: 'long', hairColor: '#7FB7E6' } });
    expect(me(s).appearance.hairStyle).toBe('long');
    // Pérola's salon (open in the day) changes everything but clothes, for coins.
    goTo(s, DOOR_SPOT);
    ok(s, { type: 'home.exit' });
    s.time.minuteOfDay = 600;
    goToNpc(s, 'perola');
    const coins = me(s).coins;
    ok(s, { type: 'look.change', via: 'salon', appearance: { ...me(s).appearance, species: 'cat', skin: '#C68642' } });
    expect(me(s).coins).toBe(coins - 200);
  });
});

describe('stall, talents, achievements, pet and emotes', () => {
  it('the market stall sells during the day', () => {
    const s = setup();
    goTo(s, PLAYER_STALL_SPOT);
    give(s, 'dish.jam', 20);
    ok(s, { type: 'stall.put', slot: slotOf(s, 'dish.jam'), qty: 20 });
    const coins = me(s).coins;
    applyCommand(s, { type: 'time.sync', minuteOfDay: 480 }, SYSTEM);
    for (let i = 0; i < 60; i++) applyCommand(s, { type: 'time.advance', steps: 1 }, SYSTEM);
    expect(me(s).coins).toBeGreaterThan(coins);
    expect(me(s).stats.stallSold).toBeGreaterThan(0);
    expect(s.stalls.local!.items[0]!.qty).toBeLessThan(20);
    ok(s, { type: 'stall.take', index: 0 });
    expect(s.stalls.local!.items).toEqual([]);
  });

  it('talents: one choice per level, once the level is reached, and they work', () => {
    const s = setup();
    const [a, b] = talentsAt('farming', 2);
    expect(run(s, { type: 'talent.choose', talent: a!.id })).toEqual({ ok: false, error: 'not_available' });
    me(s).skills.farming = 200;
    const before = energyCost(me(s), 'hoe');
    ok(s, { type: 'talent.choose', talent: b!.id });
    expect(run(s, { type: 'talent.choose', talent: a!.id })).toEqual({ ok: false, error: 'already' });
    expect(b!.mod).toBe('farmEnergy');
    expect(energyCost(me(s), 'hoe')).toBe(Math.max(1, before - b!.value));
  });

  it('achievements unlock titles; the pet digs up finds and wears accessories; emotes please villagers', () => {
    const s = setup();
    ok(s, { type: 'photo.taken' });
    expect(me(s).achievements).toContain('photo');
    ok(s, { type: 'title.set', title: 'photo' });
    expect(run(s, { type: 'title.set', title: 'stars5' })).toEqual({ ok: false, error: 'invalid' });
    const spot = s.hidden[0]!;
    expect(DIG_SPOTS.some(d => d.at[0] === spot.x && d.at[1] === spot.z)).toBe(true);
    goTo(s, [spot.x, spot.z + 1]);
    ok(s, { type: 'pet.dig', id: spot.id });
    expect(countItem(me(s).inventory, spot.item)).toBeGreaterThan(0);
    give(s, 'pet.bow');
    ok(s, { type: 'pet.dress', slot: slotOf(s, 'pet.bow') });
    expect(me(s).pet.accessory).toBe('pet.bow');
    ok(s, { type: 'pet.undress' });
    expect(countItem(me(s).inventory, 'pet.bow')).toBe(1);
    s.time.minuteOfDay = 600;
    goToNpc(s, 'lumi');
    const first = ok(s, { type: 'emote', emote: 'wave', npc: 'lumi' });
    expect(first[0]).toMatchObject({ type: 'emoted', points: 5 });
    expect(ok(s, { type: 'emote', emote: 'love', npc: 'lumi' })[0]).toMatchObject({ points: 0 });
    expect(run(s, { type: 'emote', emote: 'wave', npc: 'mel' })).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('saves (stage 5)', () => {
  it('keeps the house and decorations, and brings stage 4 saves up to date', () => {
    const s = setup();
    me(s).wardrobe.colors.push('#2E3A6B');
    s.decor.push({ id: 1, item: 'furn.bench', x: 1, z: 3, rot: 1, by: 'local' });
    const loaded = readSaveFile(JSON.parse(JSON.stringify(toSaveFile(s, 'sleep', 1))));
    expect(loaded?.state).toEqual(s);
    const old = JSON.parse(JSON.stringify(toSaveFile(setup(), 'sleep', 1)));
    old.version = 4;
    old.state.version = 4;
    for (const key of ['decor', 'decorSeq', 'stars', 'stalls', 'hidden', 'hiddenSeq', 'arrived']) delete old.state[key];
    for (const key of ['inside', 'home', 'recipes', 'wardrobe', 'talents', 'stats', 'discovered', 'achievements', 'title', 'pet']) delete old.state.players.local[key];
    delete old.state.players.local.friends.mel;
    for (const f of Object.values(old.state.players.local.friends) as Record<string, unknown>[]) delete f.emoteDay;
    const migrated = readSaveFile(old);
    expect(migrated?.state.version).toBe(SAVE_VERSION);
    expect(migrated?.state.players.local!.home.floors.ground!.length).toBeGreaterThan(3);
    expect(migrated?.state.players.local!.friends.mel.points).toBe(0);
    expect(migrated?.state.hidden.length).toBeGreaterThan(0);
  });
});

describe('stage 5 places on the map', () => {
  it('dig spots, tents, the salon and the stall stand on walkable ground, clear of obstacles', async () => {
    const { buildColliders, resolve, walkableHeight } = await import('../world/collision');
    const { TENTS, tentDoor } = await import('../data/village');
    const { PLACES } = await import('../data/villagers');
    const colliders = buildColliders({ bridgeFixed: true });
    const spots: [string, readonly [number, number]][] = [
      ...DIG_SPOTS.map((d, i) => [`dig ${i}`, d.at] as [string, readonly [number, number]]),
      ...TENTS.map(t => [`tent ${t.npc}`, tentDoor(t)] as [string, readonly [number, number]]),
      ['salon', PLACES.salon], ['stall', PLAYER_STALL_SPOT],
    ];
    for (const [name, [x, z]] of spots) {
      expect(walkableHeight(x, z), name).not.toBeNull();
      const [rx, rz] = resolve(x, z, colliders, 'summer');
      expect(Math.hypot(rx - x, rz - z), name).toBeLessThan(0.05);
    }
  });
});
