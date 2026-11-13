import { describe, expect, it } from 'vitest';
import { INVENTORY_SIZE, STARTING_INVENTORY } from '../data/items';
import { addItem, countItem, createInventory, moveSlot, removeItem, spaceFor } from './inventory';

describe('inventory', () => {
  it('starts with 24 slots and the starting tools first', () => {
    const inv = createInventory(STARTING_INVENTORY);
    expect(inv).toHaveLength(INVENTORY_SIZE);
    expect(inv[0]).toEqual({ item: 'tool.hoe', qty: 1 });
    expect(countItem(inv, 'seed.strawberry')).toBe(12);
  });

  it('stacks items up to the maximum, then uses new slots', () => {
    const inv = createInventory();
    expect(addItem(inv, 'fruit.peach', 150)).toBe(150);
    expect(inv[0]).toEqual({ item: 'fruit.peach', qty: 99 });
    expect(inv[1]).toEqual({ item: 'fruit.peach', qty: 51 });
  });

  it('never stacks tools', () => {
    const inv = createInventory();
    addItem(inv, 'tool.axe', 2);
    expect(inv[0]).toEqual({ item: 'tool.axe', qty: 1 });
    expect(inv[1]).toEqual({ item: 'tool.axe', qty: 1 });
  });

  it('reports free space and adds only what fits', () => {
    const inv = createInventory();
    for (let i = 0; i < INVENTORY_SIZE; i++) addItem(inv, 'tool.axe', 1);
    expect(spaceFor(inv, 'fruit.apple')).toBe(0);
    expect(addItem(inv, 'fruit.apple', 3)).toBe(0);
  });

  it('removes only when there is enough', () => {
    const inv = createInventory([['fruit.pear', 5]]);
    expect(removeItem(inv, 'fruit.pear', 9)).toBe(false);
    expect(countItem(inv, 'fruit.pear')).toBe(5);
    expect(removeItem(inv, 'fruit.pear', 5)).toBe(true);
    expect(inv[0]).toBeNull();
  });

  it('swaps different items and merges equal ones when dragging', () => {
    const inv = createInventory([['tool.axe', 1], ['fruit.peach', 90]]);
    addItem(inv, 'tool.hoe', 1);
    moveSlot(inv, 0, 2);
    expect(inv[0]).toEqual({ item: 'tool.hoe', qty: 1 });
    expect(inv[2]).toEqual({ item: 'tool.axe', qty: 1 });

    inv[5] = { item: 'fruit.peach', qty: 20 };
    moveSlot(inv, 5, 1);
    expect(inv[1]).toEqual({ item: 'fruit.peach', qty: 99 });
    expect(inv[5]).toEqual({ item: 'fruit.peach', qty: 11 });
  });

  it('moving an empty slot does nothing', () => {
    const inv = createInventory([['tool.axe', 1]]);
    moveSlot(inv, 3, 0);
    expect(inv[0]).toEqual({ item: 'tool.axe', qty: 1 });
  });
});
