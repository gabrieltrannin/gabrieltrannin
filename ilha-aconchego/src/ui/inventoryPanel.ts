import { HOTBAR_SIZE, ITEMS } from '../data/items';
import { MAX_SKILL_LEVEL, SKILL_XP, SKILLS, skillLevel } from '../data/skills';
import { toolOfItem } from '../data/tools';
import { eatEnergy, levelOf } from '../core/rules';
import type { Inventory, PlayerState } from '../core/types';
import { t, type MessageKey } from '../i18n';
import { itemName } from './itemText';

export interface InventoryPanelOptions {
  getInventory(): Inventory;
  getPlayer(): PlayerState;
  onMove(from: number, to: number): void;
  onEat(slot: number): void;
  onClose(): void;
  onFriends?(): void;
  onCalendar?(): void;
}

export interface InventoryPanel {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
  refresh(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Fills a slot button with the item icon and count, quality star, seed or tool-level badge, and a label. */
export function paintSlot(button: HTMLElement, index: number, inv: Inventory, toolLevels?: PlayerState['toolLevels']): void {
  const slot = inv[index] ?? null;
  button.replaceChildren();
  let name = t('inventory.empty');
  if (slot) {
    button.append(el('span', 'slot__icon', ITEMS[slot.item].icon));
    if (slot.qty > 1) button.append(el('span', 'slot__qty', String(slot.qty)));
    if (slot.q) button.append(el('span', `slot__star slot__star--${slot.q}`, '★'));
    if (ITEMS[slot.item].kind === 'seed') button.append(el('span', 'slot__badge', '🌱'));
    name = itemName(slot);
    const tool = toolOfItem(slot.item);
    if (tool && toolLevels) {
      const level = toolLevels[tool];
      if (level > 1) button.append(el('span', `slot__lvl slot__lvl--${level}`));
      name = `${name} ${t(`tool.level.${level}` as MessageKey)}`;
    }
  }
  button.setAttribute('aria-label', slot && slot.qty > 1 ? t('inventory.slotQty', { n: index + 1, item: name, qty: slot.qty }) : t('inventory.slot', { n: index + 1, item: name }));
  button.title = slot ? name : '';
}

/**
 * The backpack (Tab): 24 slots, the first row is the item bar. Drag an item onto another slot to
 * move it (equal items stack). Without a mouse or for keyboards: press one slot, then another.
 */
export function createInventoryPanel(root: HTMLElement, opts: InventoryPanelOptions): InventoryPanel {
  const overlay = el('div', 'bag-overlay');
  overlay.hidden = true;
  const panel = el('div', 'bag');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'bag-title');
  const header = el('div', 'bag__header');
  const title = el('h2', 'bag__title', t('inventory.title'));
  title.id = 'bag-title';
  const close = el('button', 'ui-btn ui-btn--small', t('inventory.close'));
  close.type = 'button';
  const tabs = el('div', 'bag__tabs');
  for (const [label, run] of [[t('bag.friends'), opts.onFriends], [t('bag.calendar'), opts.onCalendar]] as const) {
    if (!run) continue;
    const b = el('button', 'ui-btn ui-btn--small', label);
    b.type = 'button';
    b.addEventListener('click', () => run());
    tabs.append(b);
  }
  header.append(title, tabs, close);
  const grid = el('div', 'bag__grid');
  const hint = el('p', 'bag__hint', t('inventory.hint'));
  const details = el('div', 'bag__details');
  const skills = el('div', 'bag__skills');
  skills.setAttribute('aria-label', t('panel.skills'));
  panel.append(header, grid, details, hint, el('h3', 'panel__section', t('panel.skills')), skills);
  overlay.append(panel);
  root.append(overlay);

  const slots: HTMLButtonElement[] = [];
  const count = opts.getInventory().length;
  for (let i = 0; i < count; i++) {
    const b = el('button', `slot${i < HOTBAR_SIZE ? ' slot--bar' : ''}`);
    b.type = 'button';
    b.dataset.slot = String(i);
    grid.append(b);
    slots.push(b);
  }

  let picked: number | null = null;
  let drag: { from: number; ghost: HTMLElement; startX: number; startY: number; moved: boolean } | null = null;

  const refresh = () => {
    const inv = opts.getInventory();
    const player = opts.getPlayer();
    slots.forEach((b, i) => {
      paintSlot(b, i, inv, player.toolLevels);
      b.classList.toggle('slot--picked', picked === i);
    });
    // Details of the picked item: what it is, what it sells for, and "Comer" for food.
    details.replaceChildren();
    const stack = picked !== null ? inv[picked] : null;
    if (stack && picked !== null) {
      const def = ITEMS[stack.item];
      const energy = eatEnergy(player, stack.item);
      const lines = [t(`kind.${def.kind}` as MessageKey)];
      if (def.sell > 0) lines.push(t('panel.sell', { price: def.sell }));
      if (energy > 0) lines.push(t('panel.energy', { energy }));
      details.append(el('span', 'bag__details-icon', def.icon), el('b', '', itemName(stack)), el('span', 'bag__details-sub', lines.join(' · ')));
      if (energy > 0) {
        const eat = el('button', 'ui-btn ui-btn--small ui-btn--primary', t('panel.eat'));
        eat.type = 'button';
        const slot = picked;
        eat.addEventListener('click', () => opts.onEat(slot));
        details.append(eat);
      }
    }
    // Skills: level and progress to the next one.
    skills.replaceChildren(
      ...SKILLS.map(skill => {
        const xp = player.skills[skill], level = skillLevel(xp);
        const item = el('div', 'skill');
        const bar = el('div', 'meter');
        const fill = el('i');
        const from = SKILL_XP[level]!, to = SKILL_XP[level + 1] ?? from;
        fill.style.width = level >= MAX_SKILL_LEVEL ? '100%' : `${((xp - from) / Math.max(1, to - from)) * 100}%`;
        bar.append(fill);
        item.append(el('span', 'skill__name', t(`skill.${skill}`)), el('span', 'skill__level', level >= MAX_SKILL_LEVEL ? t('skill.max') : t('skill.level', { level: levelOf(player, skill) })), bar);
        return item;
      }),
    );
  };

  const drop = (from: number, to: number) => {
    picked = null;
    if (from !== to) opts.onMove(from, to);
    refresh();
  };

  grid.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
    if (!b || drag?.moved) return;
    const i = Number(b.dataset.slot);
    if (picked === null) {
      if (opts.getInventory()[i]) picked = i;
    } else if (picked === i) picked = null;
    else return drop(picked, i);
    refresh();
  });

  grid.addEventListener('pointerdown', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
    if (!b) return;
    const from = Number(b.dataset.slot);
    const item = opts.getInventory()[from];
    if (!item) return;
    const ghost = el('div', 'slot slot--ghost', ITEMS[item.item].icon);
    ghost.hidden = true;
    document.body.append(ghost);
    drag = { from, ghost, startX: e.clientX, startY: e.clientY, moved: false };
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) {
      drag.moved = true;
      drag.ghost.hidden = false;
      picked = null;
    }
    if (drag.moved) drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
  });
  window.addEventListener('pointerup', e => {
    if (!drag) return;
    const { from, ghost, moved } = drag;
    ghost.remove();
    if (moved) {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-slot]');
      if (target) drop(from, Number(target.dataset.slot));
    }
    // Let the click handler see that this was a drag, then forget it.
    setTimeout(() => (drag = null), 0);
  });

  const api: InventoryPanel = {
    get isOpen() {
      return !overlay.hidden;
    },
    open() {
      picked = null;
      refresh();
      overlay.hidden = false;
      slots[0]?.focus({ preventScroll: true });
    },
    close() {
      overlay.hidden = true;
      picked = null;
    },
    refresh,
  };
  close.addEventListener('click', () => opts.onClose());
  overlay.addEventListener('click', e => {
    if (e.target === overlay) opts.onClose();
  });
  return api;
}
