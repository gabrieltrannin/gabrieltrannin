import { describe, expect, it } from 'vitest';
import { readSaveFile, toSaveFile } from './save';
import { createInitialState } from './state';

describe('save files', () => {
  it('round-trips a new island through JSON', () => {
    const state = createInitialState({ islandName: 'Brisa', playerName: 'Bia', nativeFruit: 'cherry' });
    const file = JSON.parse(JSON.stringify(toSaveFile(state, 'sleep', 123)));
    const read = readSaveFile(file);
    expect(read?.state).toEqual(state);
    expect(read?.reason).toBe('sleep');
  });

  it('copies the state, so later changes do not leak into the save', () => {
    const state = createInitialState();
    const file = toSaveFile(state, 'resume', 1);
    state.players.local!.coins = 9999;
    expect(file.state.players.local!.coins).not.toBe(9999);
  });

  it('refuses old versions, missing data and tampered values', () => {
    const good = () => JSON.parse(JSON.stringify(toSaveFile(createInitialState(), 'sleep', 1)));
    expect(readSaveFile(null)).toBeNull();
    expect(readSaveFile({ ...good(), version: 1 })).toBeNull();

    const badItem = good();
    badItem.state.players.local.inventory[0] = { item: 'tool.laser', qty: 1 };
    expect(readSaveFile(badItem)).toBeNull();

    const badStack = good();
    badStack.state.players.local.inventory[0] = { item: 'tool.hoe', qty: 5 };
    expect(readSaveFile(badStack)).toBeNull();

    const badLook = good();
    badLook.state.players.local.appearance.hairColor = '#000001';
    expect(readSaveFile(badLook)).toBeNull();

    const badTime = good();
    badTime.state.time.day = 40;
    expect(readSaveFile(badTime)).toBeNull();

    const badName = good();
    badName.state.island.name = '';
    expect(readSaveFile(badName)).toBeNull();
  });
});
