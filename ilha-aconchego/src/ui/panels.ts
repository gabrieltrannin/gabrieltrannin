import type { Game } from '../core/game';
import { countItem, countKind } from '../core/inventory';
import { levelOf, sellPrice } from '../core/rules';
import type { Actor, ItemStack, PlayerState } from '../core/types';
import { seasonOf } from '../core/clock';
import { ITEMS, type ItemId } from '../data/items';
import { COOKING, CRAFTING, type Recipe } from '../data/recipes';
import { shopEntries, type ShopId } from '../data/shops';
import { MAX_TOOL_LEVEL, TOOLS, toolItem, UPGRADE_COST } from '../data/tools';
import { t, type MessageKey } from '../i18n';
import { itemName } from './itemText';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(text: string, onClick: () => void, disabled = false, primary = false): HTMLButtonElement {
  const b = el('button', `ui-btn ui-btn--small${primary ? ' ui-btn--primary' : ''}`, text);
  b.type = 'button';
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

/** One line of a list: icon, name, a smaller line under it, and buttons on the right. */
function row(icon: string, name: string, sub: string, ...actions: HTMLElement[]): HTMLElement {
  const r = el('div', 'panel-row');
  const i = el('span', 'panel-row__icon', icon);
  i.setAttribute('aria-hidden', 'true');
  const text = el('div', 'panel-row__text');
  text.append(el('div', 'panel-row__name', name), el('div', 'panel-row__sub', sub));
  const right = el('div', 'panel-row__actions');
  right.append(...actions);
  r.append(i, text, right);
  return r;
}

export interface PanelHost {
  readonly isOpen: boolean;
  close(): void;
  /** Re-draws the open panel (after the game state changed). */
  refresh(): void;
  openShop(shop: ShopId): void;
  openShipping(): void;
  openKitchen(): void;
  openWorkbench(): void;
  openSmithy(): void;
}

/**
 * Cream paper windows for the shops, the shipping bin, the kitchen, the workbench and Bento's forge.
 * Every button sends a command; the panel re-draws from the game state afterwards.
 */
export function createPanels(root: HTMLElement, game: Game, actor: Actor, toast: (text: string) => void, errorText: (error: string) => string): PanelHost {
  const overlay = el('div', 'bag-overlay panel-overlay');
  overlay.hidden = true;
  const card = el('div', 'bag panel');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'panel-title');
  const header = el('div', 'bag__header');
  const title = el('h2', 'bag__title');
  title.id = 'panel-title';
  const coins = el('div', 'panel__coins');
  const close = button(t('panel.close'), () => api.close());
  header.append(title, coins, close);
  const body = el('div', 'panel__body');
  card.append(header, body);
  overlay.append(card);
  root.append(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) api.close();
  });

  const me = (): PlayerState => game.state.players[actor.id]!;
  let render: (() => void) | null = null;
  const dispatch = (cmd: Parameters<Game['dispatch']>[0], okText?: string) => {
    const r = game.dispatch(cmd, actor);
    if (!r.ok) toast(errorText(r.error));
    else if (okText) toast(okText);
    api.refresh();
    return r.ok;
  };
  const open = (titleText: string, draw: () => void) => {
    title.textContent = titleText;
    render = draw;
    overlay.hidden = false;
    api.refresh();
    (card.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  };
  const section = (text: string) => body.append(el('h3', 'panel__section', text));

  const ingredientsText = (recipe: Recipe) => recipe.ingredients
    .map(ing => {
      const have = 'item' in ing ? countItem(me().inventory, ing.item) : countKind(me().inventory, ing.kind);
      const name = 'item' in ing ? t(`item.${ing.item}`) : t(`kind.${ing.kind}`);
      return `${ing.qty} ${name} (${Math.min(have, ing.qty)}/${ing.qty})`;
    })
    .join(' · ');

  const recipeList = (list: readonly Recipe[], skill: 'cooking' | 'crafting', command: 'cook' | 'craft') => () => {
    body.replaceChildren();
    const level = levelOf(me(), skill);
    for (const recipe of list) {
      const def = ITEMS[recipe.result] as { energy?: number };
      const locked = recipe.level > level;
      const sub = locked ? t('panel.locked', { level: recipe.level, skill: t(`skill.${skill}`) }) : `${ingredientsText(recipe)}${def.energy ? ` · ${t('panel.energy', { energy: def.energy })}` : ''}`;
      const canMake = !locked && recipe.ingredients.every(ing => ('item' in ing ? countItem(me().inventory, ing.item) : countKind(me().inventory, ing.kind)) >= ing.qty);
      const name = recipe.qty > 1 ? `${t(`item.${recipe.result}`)} ×${recipe.qty}` : t(`item.${recipe.result}`);
      body.append(row(ITEMS[recipe.result].icon, name, sub, button(t('panel.make'), () => dispatch({ type: command, recipe: recipe.id }, t(command === 'cook' ? 'msg.cooked' : 'msg.crafted', { item: t(`item.${recipe.result}`) })), !canMake, true)));
    }
  };

  const api: PanelHost = {
    get isOpen() {
      return !overlay.hidden;
    },
    close() {
      overlay.hidden = true;
      render = null;
    },
    refresh() {
      if (!render || overlay.hidden) return;
      coins.textContent = `🪙 ${me().coins.toLocaleString('pt-BR')}`;
      const scroll = body.scrollTop;
      render();
      body.scrollTop = scroll;
    },

    openShop(shop) {
      open(t(`panel.shop.${shop}` as MessageKey), () => {
        body.replaceChildren();
        for (const entry of shopEntries(shop, seasonOf(game.state.time))) {
          const name = t(`item.${entry.item}`);
          const have = countItem(me().inventory, entry.item);
          const buy = (qty: number) => dispatch({ type: 'shop.buy', shop, item: entry.item, qty }, t('msg.bought', { item: qty > 1 ? `${qty} ${name}` : name }));
          const actions = [button(t('panel.buyFor', { price: entry.price }), () => buy(1), me().coins < entry.price, true)];
          if (ITEMS[entry.item].maxStack > 1) actions.push(button('×5', () => buy(5), me().coins < entry.price * 5));
          const kind = t(`kind.${ITEMS[entry.item].kind}`);
          body.append(row(ITEMS[entry.item].icon, name, `${kind} · ${t('panel.youHave', { qty: have })}`, ...actions));
        }
      });
    },

    openShipping() {
      open(t('panel.ship.title'), () => {
        body.replaceChildren();
        body.append(el('p', 'bag__hint', t('panel.ship.hint')));
        const charisma = levelOf(me(), 'charisma');
        const bin: ItemStack[] = game.state.shipping[actor.id] ?? [];
        const total = bin.reduce((sum, s) => sum + sellPrice(s, charisma), 0);
        section(t('panel.ship.total', { coins: total.toLocaleString('pt-BR') }));
        if (bin.length === 0) body.append(el('p', 'panel__empty', t('panel.ship.empty')));
        bin.forEach((stack, index) => {
          body.append(row(ITEMS[stack.item].icon, `${itemName(stack)} ×${stack.qty}`, t('panel.price', { price: sellPrice(stack, charisma) }), button(t('panel.ship.take'), () => dispatch({ type: 'ship.take', index }))));
        });
        section(t('panel.bag'));
        me().inventory.forEach((stack, slot) => {
          if (!stack || ITEMS[stack.item].sell <= 0) return;
          const one = sellPrice({ ...stack, qty: 1 }, charisma);
          const actions = [button(t('panel.ship.add'), () => dispatch({ type: 'ship.add', slot, qty: 1 }, t('msg.shipped', { item: itemName(stack) })))];
          if (stack.qty > 1) actions.push(button(t('panel.ship.addAll'), () => dispatch({ type: 'ship.add', slot, qty: stack.qty }, t('msg.shipped', { item: `${stack.qty} ${itemName(stack)}` })), false, true));
          body.append(row(ITEMS[stack.item].icon, `${itemName(stack)} ×${stack.qty}`, t('panel.sell', { price: one }), ...actions));
        });
      });
    },

    openKitchen() {
      open(t('panel.cook.title'), recipeList(COOKING, 'cooking', 'cook'));
    },

    openWorkbench() {
      open(t('panel.craft.title'), recipeList(CRAFTING, 'crafting', 'craft'));
    },

    openSmithy() {
      open(t('panel.smith.title'), () => {
        body.replaceChildren();
        body.append(el('p', 'bag__hint', t('panel.smith.hint')));
        for (const tool of TOOLS) {
          const item = toolItem(tool);
          const level = me().toolLevels[tool];
          const name = `${t(`item.${item}`)} ${t(`tool.level.${level}` as MessageKey)}`;
          if (level >= MAX_TOOL_LEVEL) {
            body.append(row(ITEMS[item].icon, name, t('panel.smith.maxed')));
            continue;
          }
          const cost = UPGRADE_COST[level + 1]!;
          const enough = me().coins >= cost.coins && countItem(me().inventory, cost.item) >= cost.qty;
          const next = t(`tool.level.${level + 1}` as MessageKey);
          const sub = `→ ${next} · ${t('panel.smith.cost', { coins: cost.coins, qty: cost.qty, item: t(`item.${cost.item}`) })} (${countItem(me().inventory, cost.item)}/${cost.qty})`;
          body.append(row(ITEMS[item].icon, name, sub, button(t('panel.smith.upgrade'), () => dispatch({ type: 'tool.upgrade', tool }), !enough, true)));
        }
        section(t('panel.smith.shop'));
        for (const entry of shopEntries('smithy', seasonOf(game.state.time))) {
          const name = t(`item.${entry.item}`);
          body.append(row(ITEMS[entry.item].icon, name, t('panel.youHave', { qty: countItem(me().inventory, entry.item) }), button(t('panel.buyFor', { price: entry.price }), () => dispatch({ type: 'shop.buy', shop: 'smithy', item: entry.item, qty: 1 }, t('msg.bought', { item: name })), me().coins < entry.price)));
        }
      });
    },
  };
  game.on(event => {
    if (event.type !== 'time.changed' && event.type !== 'player.moved') api.refresh();
  });
  return api;
}

export type { ItemId };
