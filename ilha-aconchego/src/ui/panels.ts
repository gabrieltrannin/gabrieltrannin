import type { Game } from '../core/game';
import { countItem, countKind } from '../core/inventory';
import { levelOf, sellPrice } from '../core/rules';
import type { Actor, ItemStack, PlayerState } from '../core/types';
import { absoluteDay, seasonOf } from '../core/clock';
import { DAYS_PER_SEASON, FESTIVALS, SEASONS, WEEKDAYS } from '../data/calendar';
import { MUSEUM_EXTRA, PROJECTS } from '../data/community';
import { hearts, villager, VILLAGERS } from '../data/villagers';
import { ITEM_IDS, ITEMS, type ItemId } from '../data/items';
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
  /** Village notice board: requests and community projects. */
  openBoard(): void;
  openMuseum(): void;
  openMail(): void;
  openFriends(): void;
  openCalendar(season?: number): void;
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
        for (const entry of shopEntries(shop, seasonOf(game.state.time), game.state.projects.seeds.done)) {
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

    openBoard() {
      open(t('panel.board.title'), () => {
        body.replaceChildren();
        section(t('panel.board.requests'));
        const today = absoluteDay(game.state.time);
        const active = game.state.requests.filter(r => !r.done);
        if (!active.length) body.append(el('p', 'panel__empty', t('panel.board.none')));
        for (const r of active) {
          const v = villager(r.npc);
          const left = r.until < 0 ? t('panel.board.noLimit') : t('panel.board.daysLeft', { days: r.until - today + 1 });
          const have = countItem(me().inventory, r.item);
          body.append(row(v.icon, t('panel.board.request', { name: v.name, qty: r.qty, item: t(`item.${r.item}`) }), `${t('panel.board.reward', { coins: r.reward })} · ${left} · ${t('panel.youHave', { qty: have })}`));
        }
        body.append(el('p', 'bag__hint', t('panel.board.hint')));
        for (const def of PROJECTS) {
          const project = game.state.projects[def.id];
          section(`${t(`project.${def.id}` as MessageKey)}${project.done ? ' ✓' : ''}`);
          body.append(el('p', 'panel__note', t(`project.${def.id}.text` as MessageKey)));
          if (project.done) continue;
          for (const need of def.needs) {
            const given = project.given[need.item] ?? 0, left = need.qty - given, have = countItem(me().inventory, need.item);
            const give = Math.min(left, have);
            body.append(row(ITEMS[need.item].icon, `${t(`item.${need.item}`)} ${given}/${need.qty}`, t('panel.youHave', { qty: have }),
              button(give > 0 ? t('panel.board.give', { qty: give }) : t('panel.board.giveNone'), () => dispatch({ type: 'project.contribute', project: def.id, item: need.item, qty: give }), give <= 0 || left <= 0, true)));
          }
          const leftCoins = def.coins - project.coins, giveCoins = Math.min(leftCoins, me().coins);
          body.append(row('🪙', `${t('panel.board.coins')} ${project.coins.toLocaleString('pt-BR')}/${def.coins.toLocaleString('pt-BR')}`, t('panel.youHave', { qty: me().coins.toLocaleString('pt-BR') }),
            button(giveCoins > 0 ? t('panel.board.giveCoins', { coins: giveCoins.toLocaleString('pt-BR') }) : t('panel.board.giveNone'), () => dispatch({ type: 'project.contribute', project: def.id, item: 'coins', qty: giveCoins }), giveCoins <= 0 || leftCoins <= 0, true)));
        }
      });
    },

    openMuseum() {
      open(t('panel.museum.title'), () => {
        body.replaceChildren();
        const kinds = [...ITEM_IDS.filter(id => ITEMS[id].kind === 'fish'), ...ITEM_IDS.filter(id => ITEMS[id].kind === 'bug'), ...MUSEUM_EXTRA];
        body.append(el('p', 'bag__hint', t('panel.museum.hint', { count: game.state.museum.length, total: kinds.length })));
        section(t('panel.museum.donate'));
        let any = false;
        me().inventory.forEach((stack, slot) => {
          if (!stack || !kinds.includes(stack.item) || game.state.museum.includes(stack.item)) return;
          any = true;
          body.append(row(ITEMS[stack.item].icon, itemName(stack), t(`kind.${ITEMS[stack.item].kind}` as MessageKey), button(t('panel.museum.give'), () => dispatch({ type: 'museum.donate', slot }, t('msg.donated', { item: t(`item.${stack.item}`) })), false, true)));
        });
        if (!any) body.append(el('p', 'panel__empty', t('panel.museum.nothing')));
        section(t('panel.museum.collection'));
        const grid = el('div', 'museum-grid');
        for (const id of kinds) {
          const has = game.state.museum.includes(id);
          const cell = el('span', `museum-cell${has ? ' museum-cell--on' : ''}`, has ? ITEMS[id].icon : '?');
          cell.title = has ? t(`item.${id}`) : '?';
          grid.append(cell);
        }
        body.append(grid);
      });
    },

    openMail() {
      open(t('panel.mail.title'), () => {
        body.replaceChildren();
        const mail = [...me().mail].reverse();
        if (!mail.length) body.append(el('p', 'panel__empty', t('panel.mail.empty')));
        for (const m of mail) {
          const from = m.from === 'island' ? t('panel.mail.island') : villager(m.from).name;
          const text = t(m.key as MessageKey, { ...m.params, island: game.state.island.name, player: me().name, from });
          const letter = el('div', `letter${m.read ? '' : ' letter--new'}`);
          letter.append(el('div', 'letter__from', `${m.from === 'island' ? '✉️' : villager(m.from).icon} ${from}`), el('p', 'letter__text', text));
          if (m.item && !m.taken) letter.append(button(t('panel.mail.take', { item: `${m.qty ?? 1} ${t(`item.${m.item}`)}` }), () => dispatch({ type: 'mail.take', id: m.id }), false, true));
          body.append(letter);
          if (!m.read) game.dispatch({ type: 'mail.read', id: m.id }, actor);
        }
      });
    },

    openFriends() {
      open(t('panel.friends.title'), () => {
        body.replaceChildren();
        const today = absoluteDay(game.state.time);
        for (const v of VILLAGERS) {
          const f = me().friends[v.id];
          const h = hearts(f.points);
          const card = el('div', 'friend');
          const top = el('div', 'friend__top');
          top.append(el('span', 'friend__icon', v.icon), el('b', '', v.name), el('span', 'friend__job', t(`npc.job.${v.id}` as MessageKey)));
          const heartsEl = el('div', 'friend__hearts', '♥'.repeat(h) + '♡'.repeat(10 - h));
          heartsEl.setAttribute('aria-label', t('panel.friends.hearts', { hearts: h }));
          const flags = [f.talkedDay === today ? `✓ ${t('panel.friends.talked')}` : '', f.giftDay === today ? `✓ ${t('panel.friends.gifted')}` : ''].filter(Boolean).join(' · ');
          const loved = Object.entries(f.known).filter(([, r]) => r === 'love').map(([id]) => ITEMS[id as keyof typeof ITEMS].icon).join(' ');
          const sub = [`🎂 ${t('panel.friends.birthday', { day: v.birthday.day, season: t(`season.${v.birthday.season}`) })}`, flags, loved ? `${t('panel.friends.loves')} ${loved}` : ''].filter(Boolean).join(' · ');
          card.append(top, heartsEl, el('div', 'friend__sub', sub));
          body.append(card);
        }
      });
    },

    openCalendar(seasonIndex = game.state.time.seasonIndex) {
      open(t('panel.calendar.title'), () => {
        body.replaceChildren();
        const season = SEASONS[seasonIndex]!;
        const nav = el('div', 'calendar__nav');
        const prev = button('◀', () => api.openCalendar((seasonIndex + 3) % 4));
        const next = button('▶', () => api.openCalendar((seasonIndex + 1) % 4));
        prev.setAttribute('aria-label', t('panel.calendar.prev'));
        next.setAttribute('aria-label', t('panel.calendar.next'));
        nav.append(prev, el('b', '', `${t(`season.${season}`)} · ${t('hud.year', { year: game.state.time.year })}`), next);
        body.append(nav);
        const grid = el('div', 'calendar');
        for (const w of WEEKDAYS) grid.append(el('span', 'calendar__weekday', t(`weekday.${w}` as MessageKey).slice(0, 3)));
        const events: string[] = [];
        for (let day = 1; day <= DAYS_PER_SEASON; day++) {
          const cell = el('div', 'calendar__day');
          const today = seasonIndex === game.state.time.seasonIndex && day === game.state.time.day;
          if (today) cell.classList.add('calendar__day--today');
          cell.append(el('span', 'calendar__num', String(day)));
          for (const v of VILLAGERS.filter(v => v.birthday.season === season && v.birthday.day === day)) {
            cell.append(el('span', 'calendar__mark', v.icon));
            events.push(`${day}: 🎂 ${t('panel.calendar.birthday', { name: v.name })}`);
          }
          const festival = FESTIVALS.find(f => f.season === season && f.day === day);
          if (festival) {
            cell.append(el('span', 'calendar__mark', '🎉'));
            events.push(`${day}: 🎉 ${t(`festival.${festival.id}` as MessageKey)}`);
          }
          grid.append(cell);
        }
        body.append(grid);
        for (const e of events) body.append(el('div', 'panel-row__sub', e));
      });
    },

  };
  game.on(event => {
    if (event.type !== 'time.changed' && event.type !== 'player.moved') api.refresh();
  });
  return api;
}

export type { ItemId };
