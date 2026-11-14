import type { Game } from '../core/game';
import { countItem, countKind } from '../core/inventory';
import { COLLECTION_GROUPS, knowsRecipe, measure } from '../core/progress';
import { islandScore } from '../core/rating';
import { stallPrice } from '../core/handlers/progress';
import type { Actor, PlayerState } from '../core/types';
import { ACHIEVEMENTS } from '../data/achievements';
import { DYES, SEWN_ACCESSORIES, SEWN_OUTFITS, WEARABLE } from '../data/clothing';
import { catalogPrice, COLLECTION_STARS, COLLECTIONS, collectionItems, DECOR, type StationId } from '../data/decor';
import { HOME_LEVELS, MAX_HOME_LEVEL } from '../data/house';
import { ITEMS, type ItemId } from '../data/items';
import { MAX_STARS, STALL_SLOTS, STAR_POINTS, visitorsFor, NEWCOMER_STARS } from '../data/rating';
import { recipesAt, STATION_SKILL, type Recipe } from '../data/recipes';
import { SKILLS, type SkillId } from '../data/skills';
import { talentsAt } from '../data/talents';
import { villager, type NpcId } from '../data/villagers';
import { levelOf } from '../core/rules';
import { t, type MessageKey } from '../i18n';
import { itemName } from './itemText';

/** What the stage 5 panels need from the panel window (panels.ts). */
export interface PanelKit {
  game: Game;
  actor: Actor;
  body: HTMLElement;
  me(): PlayerState;
  open(title: string, draw: () => void): void;
  section(text: string): void;
  row(icon: string, name: string, sub: string, ...actions: HTMLElement[]): HTMLElement;
  button(text: string, onClick: () => void, disabled?: boolean, primary?: boolean): HTMLButtonElement;
  el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K];
  dispatch(cmd: Parameters<Game['dispatch']>[0], okText?: string): boolean;
  refresh(): void;
}

export interface HomePanels {
  /** A crafting station: known recipes, and trying ingredients together to find secret ones. */
  openStation(station: StationId): void;
  /** The wardrobe: pieces you own, clothes and dyes to put away; `onDress` opens the look editor. */
  openWardrobe(onDress: () => void): void;
  openCatalog(): void;
  openRating(): void;
  openStall(): void;
  openTalents(skill?: SkillId): void;
  openProfile(): void;
  openHomeUpgrade(): void;
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(MAX_STARS - n);

export function createHomePanels(k: PanelKit): HomePanels {
  const { el, row, button, section, dispatch, me, game } = k;
  const recipeName = (r: Recipe) => (r.qty > 1 ? `${t(`item.${r.result}`)} ×${r.qty}` : t(`item.${r.result}`));
  const ingredientsText = (recipe: Recipe) => recipe.ingredients
    .map(ing => {
      const have = 'item' in ing ? countItem(me().inventory, ing.item) : countKind(me().inventory, ing.kind);
      const name = 'item' in ing ? t(`item.${ing.item}`) : t(`kind.${ing.kind}`);
      return `${ing.qty} ${name} (${Math.min(have, ing.qty)}/${ing.qty})`;
    })
    .join(' · ');
  const canMake = (r: Recipe) => r.ingredients.every(ing => ('item' in ing ? countItem(me().inventory, ing.item) : countKind(me().inventory, ing.kind)) >= ing.qty);

  // Items picked for an experiment (kept while the station window stays open).
  let picked: ItemId[] = [];
  let pickedStation: StationId | null = null;

  const api: HomePanels = {
    openStation(station) {
      if (pickedStation !== station) picked = [];
      pickedStation = station;
      k.open(`${t(`station.${station}` as MessageKey)}`, () => {
        const body = k.body;
        body.replaceChildren();
        const skill = STATION_SKILL[station];
        const all = recipesAt(station);
        const secret = all.filter(r => r.learn && !knowsRecipe(me(), r)).length;
        section(t('panel.station.recipes'));
        for (const recipe of all) {
          const known = knowsRecipe(me(), recipe);
          if (!known && recipe.learn) continue;
          const def = ITEMS[recipe.result] as { energy?: number };
          const sub = known ? `${ingredientsText(recipe)}${def.energy ? ` · ${t('panel.energy', { energy: def.energy })}` : ''}` : t('panel.locked', { level: recipe.level, skill: t(`skill.${skill}`) });
          const make = button(t('panel.make'), () => dispatch({ type: 'craft', station, recipe: recipe.id }, t('msg.crafted', { item: t(`item.${recipe.result}`) })), !known || !canMake(recipe), true);
          body.append(row(ITEMS[recipe.result].icon, recipeName(recipe), sub, make));
        }
        // Experiments: pick up to three things from the backpack and try them together.
        section(t('panel.station.experiment'));
        body.append(el('p', 'panel__note', secret > 0 ? t('panel.station.secrets', { count: secret }) : t('panel.station.allKnown')));
        const chips = el('div', 'chips chips--items');
        const seen = new Set<ItemId>();
        for (const stack of me().inventory) {
          if (!stack || seen.has(stack.item) || ITEMS[stack.item].kind === 'tool') continue;
          seen.add(stack.item);
          const on = picked.includes(stack.item);
          const chip = el('button', 'chip', `${ITEMS[stack.item].icon} ${t(`item.${stack.item}`)}`);
          chip.type = 'button';
          chip.setAttribute('aria-pressed', String(on));
          chip.addEventListener('click', () => {
            picked = on ? picked.filter(i => i !== stack.item) : [...picked, stack.item].slice(-3);
            k.refresh();
          });
          chips.append(chip);
        }
        picked = picked.filter(i => seen.has(i));
        body.append(chips);
        const tryIt = button(t('panel.station.try', { count: picked.length }), () => {
          dispatch({ type: 'craft.experiment', station, items: picked });
          picked = [];
          k.refresh();
        }, picked.length === 0, true);
        body.append(el('div', 'panel-row panel-row--center'));
        body.lastElementChild!.append(tryIt);
        void levelOf;
      });
    },

    openWardrobe(onDress) {
      k.open(t('panel.wardrobe.title'), () => {
        const body = k.body;
        body.replaceChildren();
        const w = me().wardrobe;
        const dress = button(t('panel.wardrobe.dress'), onDress, false, true);
        body.append(el('p', 'bag__hint', t('panel.wardrobe.hint')), el('div', 'panel-row panel-row--center'));
        body.lastElementChild!.append(dress);
        section(t('panel.wardrobe.pieces'));
        const pieces = el('div', 'chips');
        for (const o of SEWN_OUTFITS) pieces.append(el('span', `chip${w.outfits.includes(o) ? '' : ' chip--off'}`, `${w.outfits.includes(o) ? '✓' : '🔒'} ${t(`outfit.${o}` as MessageKey)}`));
        for (const a of SEWN_ACCESSORIES) pieces.append(el('span', `chip${w.accessories.includes(a) ? '' : ' chip--off'}`, `${w.accessories.includes(a) ? '✓' : '🔒'} ${t(`accessory.${a}` as MessageKey)}`));
        body.append(pieces);
        section(t('panel.wardrobe.colors'));
        const colors = el('div', 'swatches');
        for (const [item, color] of Object.entries(DYES)) {
          const s = el('span', `swatch${w.colors.includes(color!) ? '' : ' swatch--off'}`);
          s.style.background = color!;
          s.title = t(`item.${item as ItemId}`);
          colors.append(s);
        }
        body.append(colors);
        section(t('panel.wardrobe.bag'));
        let any = false;
        me().inventory.forEach((stack, slot) => {
          if (!stack) return;
          if (WEARABLE[stack.item]) {
            any = true;
            body.append(row(ITEMS[stack.item].icon, itemName(stack), t(`kind.${ITEMS[stack.item].kind}` as MessageKey), button(t('panel.wardrobe.store'), () => dispatch({ type: 'wardrobe.store', slot }, t('msg.stored', { item: t(`item.${stack.item}`) })), false, true)));
          } else if (DYES[stack.item]) {
            any = true;
            body.append(row(ITEMS[stack.item].icon, itemName(stack), t('kind.dye'), button(t('panel.wardrobe.dye'), () => dispatch({ type: 'wardrobe.dye', slot }, t('msg.dyed')), false, true)));
          }
        });
        if (!any) body.append(el('p', 'panel__empty', t('panel.wardrobe.none')));
      });
    },

    openCatalog() {
      k.open(t('panel.catalog.title'), () => {
        const body = k.body;
        body.replaceChildren();
        body.append(el('p', 'bag__hint', t('panel.catalog.hint')));
        for (const c of COLLECTIONS) {
          const need = COLLECTION_STARS[c];
          const locked = game.state.stars < need;
          section(`${t(`decor.collection.${c}` as MessageKey)}${locked ? ` · 🔒 ${t('panel.catalog.needStars', { stars: need })}` : ''}`);
          for (const item of collectionItems(c)) {
            const price = catalogPrice(item);
            const def = DECOR[item];
            const where = t(`panel.catalog.where.${def.where}` as MessageKey);
            const sub = `${where} · ${def.w}×${def.d} · ${'✿'.repeat(def.beauty)} · ${t('panel.youHave', { qty: countItem(me().inventory, item) })}`;
            body.append(row(ITEMS[item].icon, t(`item.${item}`), sub, button(locked ? '🔒' : t('panel.buyFor', { price: price.toLocaleString('pt-BR') }), () => dispatch({ type: 'catalog.buy', item, qty: 1 }, t('msg.bought', { item: t(`item.${item}`) })), locked || me().coins < price, !locked)));
          }
        }
      });
    },

    openRating() {
      k.open(t('panel.rating.title'), () => {
        const body = k.body;
        body.replaceChildren();
        const score = islandScore(game.state);
        const s = game.state.stars;
        const next = STAR_POINTS[s];
        const head = el('div', 'rating');
        head.append(el('div', 'rating__stars', stars(s)), el('div', 'rating__points', next !== undefined ? t('panel.rating.points', { points: score.total, next }) : t('panel.rating.max', { points: score.total })));
        const bar = el('div', 'meter');
        const fill = el('i');
        const from = STAR_POINTS[s - 1] ?? 0;
        fill.style.width = next !== undefined ? `${Math.min(100, ((score.total - from) / (next - from)) * 100)}%` : '100%';
        bar.append(fill);
        head.append(bar);
        body.append(head);
        section(t('panel.rating.parts'));
        for (const [part, value] of Object.entries(score.parts)) body.append(row('✿', t(`rating.part.${part}` as MessageKey), t('panel.rating.partPoints', { points: Math.round(value) })));
        section(t('panel.rating.brings'));
        body.append(row('🧳', t('panel.rating.visitors', { count: visitorsFor(s) }), t('panel.rating.visitorsHint')));
        for (const [npc, need] of Object.entries(NEWCOMER_STARS) as [NpcId, number][]) {
          const v = villager(npc);
          const here = game.state.arrived.includes(npc);
          body.append(row(here ? v.icon : '❔', here ? t('panel.rating.arrived', { name: v.name }) : t('panel.rating.someone'), here ? t(`npc.job.${npc}` as MessageKey) : t('panel.rating.needStars', { stars: need })));
        }
        body.append(el('p', 'bag__hint', t('panel.rating.hint')));
      });
    },

    openStall() {
      k.open(t('panel.stall.title'), () => {
        const body = k.body;
        body.replaceChildren();
        body.append(el('p', 'bag__hint', t('panel.stall.hint')));
        const items = game.state.stalls[k.actor.id]?.items ?? [];
        section(t('panel.stall.display', { count: items.length, max: STALL_SLOTS }));
        if (!items.length) body.append(el('p', 'panel__empty', t('panel.stall.empty')));
        items.forEach((stack, index) => {
          body.append(row(ITEMS[stack.item].icon, `${itemName(stack)} ×${stack.qty}`, t('panel.stall.each', { price: stallPrice(game.state, k.actor.id, stack) }), button(t('panel.ship.take'), () => dispatch({ type: 'stall.take', index }))));
        });
        section(t('panel.bag'));
        me().inventory.forEach((stack, slot) => {
          if (!stack || ITEMS[stack.item].sell <= 0 || ITEMS[stack.item].kind === 'tool') return;
          const each = stallPrice(game.state, k.actor.id, { ...stack, qty: 1 });
          const actions = [button(t('panel.stall.put'), () => dispatch({ type: 'stall.put', slot, qty: 1 }))];
          if (stack.qty > 1) actions.push(button(t('panel.ship.addAll'), () => dispatch({ type: 'stall.put', slot, qty: stack.qty }), false, true));
          body.append(row(ITEMS[stack.item].icon, `${itemName(stack)} ×${stack.qty}`, t('panel.stall.each', { price: each }), ...actions));
        });
      });
    },

    openTalents(skill = 'farming') {
      k.open(t('panel.talents.title'), () => {
        const body = k.body;
        body.replaceChildren();
        const tabs = el('div', 'chips');
        for (const s of SKILLS) {
          const free = Array.from({ length: levelOf(me(), s) }, (_, i) => i + 1).filter(l => !me().talents.some(id => id.startsWith(`${s}.${l}.`))).length;
          const chip = el('button', 'chip', `${t(`skill.${s}`)}${free ? ` (${free})` : ''}`);
          chip.type = 'button';
          chip.setAttribute('aria-pressed', String(s === skill));
          chip.addEventListener('click', () => api.openTalents(s));
          tabs.append(chip);
        }
        body.append(tabs, el('p', 'bag__hint', t('panel.talents.hint', { level: levelOf(me(), skill) })));
        for (let level = 1; level <= 10; level++) {
          const options = talentsAt(skill, level);
          const chosen = me().talents.find(id => id.startsWith(`${skill}.${level}.`));
          const reached = levelOf(me(), skill) >= level;
          const line = el('div', `talent-row${reached ? '' : ' talent-row--locked'}`);
          line.append(el('span', 'talent-row__level', t('skill.level', { level })));
          for (const opt of options) {
            const text = t(`talent.${opt.mod}` as MessageKey, { value: opt.value });
            const b = el('button', `talent${chosen === opt.id ? ' talent--chosen' : ''}`, text);
            b.type = 'button';
            b.disabled = !reached || !!chosen;
            b.addEventListener('click', () => dispatch({ type: 'talent.choose', talent: opt.id }, t('msg.talent')));
            line.append(b);
          }
          body.append(line);
        }
      });
    },

    openProfile() {
      k.open(t('panel.profile.title'), () => {
        const body = k.body;
        body.replaceChildren();
        const p = me();
        const head = el('div', 'profile');
        head.append(el('b', 'profile__name', p.name), el('span', 'profile__title', p.title ? t(`title.${p.title}` as MessageKey) : t('panel.profile.noTitle')), el('span', 'profile__island', `${t('hud.island', { name: game.state.island.name })} · ${stars(game.state.stars)}`));
        body.append(head);
        section(t('panel.profile.titles'));
        const titles = el('div', 'chips');
        const none = el('button', 'chip', t('panel.profile.noTitle'));
        none.type = 'button';
        none.setAttribute('aria-pressed', String(p.title === null));
        none.addEventListener('click', () => dispatch({ type: 'title.set', title: null }));
        titles.append(none);
        for (const a of ACHIEVEMENTS) {
          if (!a.title || !p.achievements.includes(a.id)) continue;
          const chip = el('button', 'chip', t(`title.${a.id}` as MessageKey));
          chip.type = 'button';
          chip.setAttribute('aria-pressed', String(p.title === a.id));
          chip.addEventListener('click', () => dispatch({ type: 'title.set', title: a.id }));
          titles.append(chip);
        }
        body.append(titles);
        if (p.pet.accessory) {
          section(t('panel.profile.pet'));
          body.append(row(ITEMS[p.pet.accessory].icon, t(`item.${p.pet.accessory}`), t('panel.profile.petFinds', { count: p.stats.petFinds ?? 0 }), button(t('panel.profile.undress'), () => dispatch({ type: 'pet.undress' }))));
        }
        section(t('panel.profile.achievements', { done: p.achievements.length, total: ACHIEVEMENTS.length }));
        const grid = el('div', 'ach-grid');
        for (const a of ACHIEVEMENTS) {
          const done = p.achievements.includes(a.id);
          const progress = Math.min(a.goal, measure(game.state, p, a));
          const cell = el('div', `ach${done ? ' ach--done' : ''}`);
          cell.append(el('span', 'ach__icon', done ? a.icon : '🔒'), el('span', 'ach__name', t(`ach.${a.id}` as MessageKey)), el('span', 'ach__progress', done ? (a.title ? `🏷️ ${t(`title.${a.id}` as MessageKey)}` : '✓') : `${progress.toLocaleString('pt-BR')}/${a.goal.toLocaleString('pt-BR')}`));
          grid.append(cell);
        }
        body.append(grid);
        section(t('panel.profile.collections'));
        for (const g of COLLECTION_GROUPS) {
          const have = g.items.filter(i => p.discovered.includes(i)).length;
          const line = el('div', 'collection');
          const bar = el('div', 'meter');
          const fill = el('i');
          fill.style.width = `${(have / g.items.length) * 100}%`;
          bar.append(fill);
          line.append(el('span', 'collection__name', t(`collection.${g.id}` as MessageKey)), el('span', 'collection__count', `${have}/${g.items.length}`), bar);
          const icons = el('div', 'collection__icons', g.items.map(i => (p.discovered.includes(i) ? ITEMS[i].icon : '·')).join(' '));
          line.append(icons);
          body.append(line);
        }
      });
    },

    openHomeUpgrade() {
      k.open(t('panel.home.title'), () => {
        const body = k.body;
        body.replaceChildren();
        const level = me().home.level;
        body.append(el('p', 'bag__hint', t('panel.home.hint')));
        for (let l = 1; l <= MAX_HOME_LEVEL; l++) {
          const cost = HOME_LEVELS[l]!.cost!;
          const done = level >= l;
          const next = l === level + 1;
          const parts = [`🪙 ${cost.coins.toLocaleString('pt-BR')}`, ...cost.items.map(c => `${c.qty} ${t(`item.${c.item}`)} (${Math.min(countItem(me().inventory, c.item), c.qty)}/${c.qty})`)].join(' · ');
          const enough = me().coins >= cost.coins && cost.items.every(c => countItem(me().inventory, c.item) >= c.qty);
          const action = done ? el('span', 'panel-row__done', '✓') : button(t('panel.home.build'), () => dispatch({ type: 'home.upgrade' }, t('msg.homeUpgraded')), !next || !enough, next);
          body.append(row(['🏠', '🏡', '🪜', '🕯️'][l]!, t(`home.level.${l}` as MessageKey), done ? t('panel.home.built') : parts, action));
        }
      });
    },
  };
  return api;
}
