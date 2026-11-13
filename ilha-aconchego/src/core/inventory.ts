import { INVENTORY_SIZE, ITEMS, type ItemId, type ItemKind, type Quality } from '../data/items';
import type { Inventory, ItemStack } from './types';

/**
 * Backpack rules. `spaceFor` and `countItem` only read; the others change the inventory in place
 * (commands call them after validating). Stacks only join when item and quality match.
 */

export function createInventory(start: readonly (readonly [ItemId, number])[] = []): Inventory {
  const inv: Inventory = Array.from({ length: INVENTORY_SIZE }, () => null);
  for (const [item, qty] of start) addItem(inv, item, qty);
  return inv;
}

const maxStack = (item: ItemId) => ITEMS[item].maxStack;
const qualityOf = (s: ItemStack): Quality => s.q ?? 0;
const sameStack = (s: ItemStack, item: ItemId, q: Quality) => s.item === item && qualityOf(s) === q;

/** How many of `item` (of quality `q`) still fit, topping up stacks first, then empty slots. */
export function spaceFor(inv: Inventory, item: ItemId, q: Quality = 0): number {
  let space = 0;
  for (const slot of inv) {
    if (slot === null) space += maxStack(item);
    else if (sameStack(slot, item, q)) space += maxStack(item) - slot.qty;
  }
  return space;
}

/** How many of `item` there are (of any quality, or of quality `q`). */
export function countItem(inv: Inventory, item: ItemId, q?: Quality): number {
  return inv.reduce((sum, slot) => sum + (slot?.item === item && (q === undefined || qualityOf(slot) === q) ? slot.qty : 0), 0);
}

export function countKind(inv: Inventory, kind: ItemKind): number {
  return inv.reduce((sum, slot) => sum + (slot && ITEMS[slot.item].kind === kind ? slot.qty : 0), 0);
}

/** Adds as many as fit. Returns how many were added. */
export function addItem(inv: Inventory, item: ItemId, qty: number, q: Quality = 0): number {
  let left = qty;
  const max = maxStack(item);
  for (const slot of inv) {
    if (left <= 0) break;
    if (slot && sameStack(slot, item, q) && slot.qty < max) {
      const put = Math.min(left, max - slot.qty);
      slot.qty += put;
      left -= put;
    }
  }
  for (let i = 0; i < inv.length && left > 0; i++) {
    if (inv[i] === null) {
      const put = Math.min(left, max);
      inv[i] = q > 0 ? { item, qty: put, q } : { item, qty: put };
      left -= put;
    }
  }
  return qty - left;
}

/**
 * Removes `qty` of `item` if there are enough, plain quality first (cooking and crafting use
 * the cheapest ones). Returns false and changes nothing otherwise.
 */
export function removeItem(inv: Inventory, item: ItemId, qty: number): boolean {
  if (countItem(inv, item) < qty) return false;
  let left = qty;
  for (const q of [0, 1, 2] as const) {
    for (let i = inv.length - 1; i >= 0 && left > 0; i--) {
      const slot = inv[i];
      if (!slot || !sameStack(slot, item, q)) continue;
      const take = Math.min(left, slot.qty);
      slot.qty -= take;
      left -= take;
      if (slot.qty === 0) inv[i] = null;
    }
  }
  return true;
}

/** Removes `qty` items of a kind (for example any fish), cheapest first. */
export function removeKind(inv: Inventory, kind: ItemKind, qty: number): boolean {
  if (countKind(inv, kind) < qty) return false;
  const slots = inv
    .map((s, i) => ({ s, i }))
    .filter((e): e is { s: ItemStack; i: number } => !!e.s && ITEMS[e.s.item].kind === kind)
    .sort((a, b) => ITEMS[a.s.item].sell - ITEMS[b.s.item].sell);
  let left = qty;
  for (const { s, i } of slots) {
    if (left <= 0) break;
    const take = Math.min(left, s.qty);
    s.qty -= take;
    left -= take;
    if (s.qty === 0) inv[i] = null;
  }
  return true;
}

/** Takes `qty` from one slot. Returns the taken stack, or null if there are not enough. */
export function takeFromSlot(inv: Inventory, index: number, qty: number): ItemStack | null {
  const slot = inv[index];
  if (!slot || qty < 1 || slot.qty < qty) return null;
  slot.qty -= qty;
  const taken: ItemStack = slot.q ? { item: slot.item, qty, q: slot.q } : { item: slot.item, qty };
  if (slot.qty === 0) inv[index] = null;
  return taken;
}

/**
 * Drag-and-drop in the backpack: dropping on the same item merges stacks (the rest stays behind);
 * dropping anywhere else swaps the two slots.
 */
export function moveSlot(inv: Inventory, from: number, to: number): void {
  const a = inv[from] ?? null, b = inv[to] ?? null;
  if (!a || from === to) return;
  if (b && sameStack(b, a.item, qualityOf(a)) && b.qty < maxStack(a.item)) {
    const put = Math.min(a.qty, maxStack(a.item) - b.qty);
    b.qty += put;
    a.qty -= put;
    if (a.qty === 0) inv[from] = null;
    return;
  }
  inv[from] = b;
  inv[to] = a;
}
