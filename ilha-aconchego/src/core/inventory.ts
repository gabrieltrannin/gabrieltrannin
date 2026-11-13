import { INVENTORY_SIZE, ITEMS, type ItemId } from '../data/items';
import type { Inventory } from './types';

/**
 * Backpack rules. `spaceFor` and `countItem` only read; `addItem`, `removeItem` and `moveSlot`
 * change the inventory in place (commands call them after validating).
 */

export function createInventory(start: readonly (readonly [ItemId, number])[] = []): Inventory {
  const inv: Inventory = Array.from({ length: INVENTORY_SIZE }, () => null);
  for (const [item, qty] of start) addItem(inv, item, qty);
  return inv;
}

const maxStack = (item: ItemId) => ITEMS[item].maxStack;

/** How many of `item` still fit (topping up stacks first, then empty slots). */
export function spaceFor(inv: Inventory, item: ItemId): number {
  let space = 0;
  for (const slot of inv) {
    if (slot === null) space += maxStack(item);
    else if (slot.item === item) space += maxStack(item) - slot.qty;
  }
  return space;
}

export function countItem(inv: Inventory, item: ItemId): number {
  return inv.reduce((sum, slot) => sum + (slot?.item === item ? slot.qty : 0), 0);
}

/** Adds as many as fit. Returns how many were added. */
export function addItem(inv: Inventory, item: ItemId, qty: number): number {
  let left = qty;
  const max = maxStack(item);
  for (const slot of inv) {
    if (left <= 0) break;
    if (slot && slot.item === item && slot.qty < max) {
      const put = Math.min(left, max - slot.qty);
      slot.qty += put;
      left -= put;
    }
  }
  for (let i = 0; i < inv.length && left > 0; i++) {
    if (inv[i] === null) {
      const put = Math.min(left, max);
      inv[i] = { item, qty: put };
      left -= put;
    }
  }
  return qty - left;
}

/** Removes `qty` of `item` if there are enough (from the last slots first). Returns false and changes nothing otherwise. */
export function removeItem(inv: Inventory, item: ItemId, qty: number): boolean {
  if (countItem(inv, item) < qty) return false;
  let left = qty;
  for (let i = inv.length - 1; i >= 0 && left > 0; i--) {
    const slot = inv[i];
    if (slot?.item !== item) continue;
    const take = Math.min(left, slot.qty);
    slot.qty -= take;
    left -= take;
    if (slot.qty === 0) inv[i] = null;
  }
  return true;
}

/**
 * Drag-and-drop in the backpack: dropping on the same item merges stacks (the rest stays behind);
 * dropping anywhere else swaps the two slots.
 */
export function moveSlot(inv: Inventory, from: number, to: number): void {
  const a = inv[from] ?? null, b = inv[to] ?? null;
  if (!a || from === to) return;
  if (b && b.item === a.item && b.qty < maxStack(a.item)) {
    const put = Math.min(a.qty, maxStack(a.item) - b.qty);
    b.qty += put;
    a.qty -= put;
    if (a.qty === 0) inv[from] = null;
    return;
  }
  inv[from] = b;
  inv[to] = a;
}
