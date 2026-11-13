import { describe, expect, it } from 'vitest';
import { HOUSE_DOOR, ORCHARD, TOUR_PLACES, TOUR_REWARD, orchardTreeId } from '../data/map';
import { MAX_ENERGY } from '../data/items';
import { applyCommand } from './commands';
import { SYSTEM } from './game';
import { countItem } from './inventory';
import { createInitialState } from './state';
import type { Actor, GameState } from './types';

const host: Actor = { id: 'local', role: 'host' };
const ghost: Actor = { id: 'nobody', role: 'host' };

const moveTo = (state: GameState, x: number, z: number) => applyCommand(state, { type: 'player.move', x, z, facing: 0 }, host);

describe('player.move', () => {
  it('moves the player on land and on the pier', () => {
    const state = createInitialState();
    expect(moveTo(state, 0, 5).ok).toBe(true);
    expect(state.players.local!.position).toMatchObject({ x: 0, z: 5 });
    expect(moveTo(state, 10, 20).ok).toBe(true);
  });

  it('refuses the open sea, bad numbers and unknown players', () => {
    const state = createInitialState();
    expect(moveTo(state, 40, 0)).toEqual({ ok: false, error: 'invalid' });
    expect(moveTo(state, Number.NaN, 0)).toEqual({ ok: false, error: 'invalid' });
    expect(applyCommand(state, { type: 'player.move', x: 0, z: 5, facing: 0 }, ghost)).toEqual({ ok: false, error: 'forbidden' });
  });
});

describe('inventory commands', () => {
  it('selects item bar slots 0 to 7 only', () => {
    const state = createInitialState();
    expect(applyCommand(state, { type: 'inventory.select', slot: 3 }, host).ok).toBe(true);
    expect(state.players.local!.activeSlot).toBe(3);
    expect(applyCommand(state, { type: 'inventory.select', slot: 8 }, host)).toEqual({ ok: false, error: 'invalid' });
  });

  it('moves items between backpack slots', () => {
    const state = createInitialState();
    expect(applyCommand(state, { type: 'inventory.move', from: 0, to: 20 }, host).ok).toBe(true);
    expect(state.players.local!.inventory[20]).toEqual({ item: 'tool.hoe', qty: 1 });
    expect(applyCommand(state, { type: 'inventory.move', from: 0, to: 1 }, host)).toEqual({ ok: false, error: 'invalid' });
    expect(applyCommand(state, { type: 'inventory.move', from: 1, to: 24 }, host)).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('tree.shake', () => {
  const treeId = orchardTreeId(0);
  const [tx, tz] = ORCHARD[0]!;

  it('needs the player next to the tree', () => {
    const state = createInitialState();
    expect(applyCommand(state, { type: 'tree.shake', treeId }, host)).toEqual({ ok: false, error: 'too_far' });
  });

  it('gives 1 to 3 native fruits, once a day', () => {
    const state = createInitialState({ nativeFruit: 'peach' });
    moveTo(state, tx, tz + 1.2);
    const r = applyCommand(state, { type: 'tree.shake', treeId }, host);
    expect(r.ok).toBe(true);
    const got = countItem(state.players.local!.inventory, 'fruit.peach');
    expect(got).toBeGreaterThanOrEqual(1);
    expect(got).toBeLessThanOrEqual(3);
    expect(applyCommand(state, { type: 'tree.shake', treeId }, host)).toEqual({ ok: false, error: 'not_available' });
    moveTo(state, HOUSE_DOOR[0], HOUSE_DOOR[1]);
    applyCommand(state, { type: 'sleep' }, host);
    moveTo(state, tx, tz + 1.2);
    expect(applyCommand(state, { type: 'tree.shake', treeId }, host).ok).toBe(true);
  });

  it('has no fruit in winter and rejects unknown trees', () => {
    const state = createInitialState();
    moveTo(state, tx, tz + 1.2);
    applyCommand(state, { type: 'time.setDate', seasonIndex: 3, day: 1 }, SYSTEM);
    expect(applyCommand(state, { type: 'tree.shake', treeId }, host)).toEqual({ ok: false, error: 'not_available' });
    expect(applyCommand(state, { type: 'tree.shake', treeId: 'orchard-99' }, host)).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('sleep', () => {
  it('only works at the house door, and restores energy', () => {
    const state = createInitialState();
    moveTo(state, 0, 5);
    expect(applyCommand(state, { type: 'sleep' }, host)).toEqual({ ok: false, error: 'too_far' });
    moveTo(state, HOUSE_DOOR[0], HOUSE_DOOR[1]);
    state.players.local!.energy = 10;
    expect(applyCommand(state, { type: 'sleep' }, host).ok).toBe(true);
    expect(state.players.local!.energy).toBe(MAX_ENERGY);
    expect(state.time.day).toBe(2);
  });
});

describe('place.visit (first request)', () => {
  it('counts each place once and pays the reward at the end', () => {
    const state = createInitialState();
    const coins = state.players.local!.coins;
    for (const [i, place] of TOUR_PLACES.entries()) {
      expect(applyCommand(state, { type: 'place.visit', placeId: place.id }, host).ok).toBe(i === -1);
      moveTo(state, place.at[0], place.at[1]);
      const r = applyCommand(state, { type: 'place.visit', placeId: place.id }, host);
      expect(r.ok).toBe(true);
      expect(applyCommand(state, { type: 'place.visit', placeId: place.id }, host)).toEqual({ ok: false, error: 'not_available' });
    }
    expect(state.quests[0]).toMatchObject({ done: true });
    expect(state.players.local!.coins).toBe(coins + TOUR_REWARD);
  });
});
