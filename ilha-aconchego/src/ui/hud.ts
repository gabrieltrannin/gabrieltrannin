import { seasonOf } from '../core/clock';
import type { Game } from '../core/game';
import type { GameState, PlayerState } from '../core/types';
import { HOTBAR_SIZE, MAX_ENERGY } from '../data/items';
import { TOUR_PLACES } from '../data/map';
import { t } from '../i18n';
import { formatDate, formatTime } from './format';
import { paintSlot } from './inventoryPanel';
import { createMinimap, type MinimapFrame } from './minimap';

export interface HudOptions {
  playerId: string;
  onSelectSlot(slot: number): void;
  onToggleMap(): void;
}

export interface Hud {
  /** Re-reads the game state (date, coins, energy, request, item bar). */
  update(): void;
  /** "E · Colher morango"; null hides it. */
  setPrompt(label: string | null): void;
  toast(text: string): void;
  setMapOpen(open: boolean): void;
  drawMinimap(frame: Omit<MinimapFrame, 'pendingPlaces'>): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Sunny weather reads "Céu limpo" after dark. */
function weatherLabel(state: Readonly<GameState>): string {
  const m = state.time.minuteOfDay;
  if (state.weather === 'sun' && (m >= 20 * 60 || m < 6 * 60)) return t('weather.clearNight');
  return t(`weather.${state.weather}`);
}

/**
 * Game interface in cream paper cards: date, time and weather; coins; energy; the active request;
 * minimap; the 8-slot item bar; the interaction prompt; quick messages; the end-of-day notice.
 */
export function createHud(root: HTMLElement, game: Game, opts: HudOptions): Hud {
  // Top left: date card and the active request.
  const left = el('div', 'hud-left');
  const card = el('div', 'hud-card hud-date');
  const date = el('div', 'hud-date__day');
  const row = el('div', 'hud-date__row');
  const clock = el('span', 'hud-date__clock');
  const weather = el('span', 'hud-chip');
  const island = el('div', 'hud-date__island');
  row.append(clock, weather);
  card.append(date, row, island);
  const quest = el('div', 'hud-card hud-quest');
  const questHead = el('div', 'hud-quest__head');
  const questProgress = el('span', 'hud-quest__progress');
  questHead.append(el('span', 'hud-quest__label', t('hud.request')), questProgress);
  const questName = el('div', 'hud-quest__name');
  const questText = el('div', 'hud-quest__text');
  const questBar = el('div', 'meter');
  const questFill = el('i');
  questBar.append(questFill);
  quest.append(questHead, questName, questText, questBar);
  left.append(card, quest);

  // Top right: coins, energy, minimap.
  const right = el('div', 'hud-right');
  const coins = el('div', 'hud-card hud-coins');
  const coinIcon = el('span', 'coin');
  coinIcon.setAttribute('aria-hidden', 'true');
  const coinValue = el('span');
  coins.append(coinIcon, coinValue);
  const energy = el('div', 'hud-card hud-energy');
  const energyBar = el('div', 'meter meter--energy');
  energyBar.setAttribute('role', 'meter');
  energyBar.setAttribute('aria-valuemin', '0');
  energyBar.setAttribute('aria-valuemax', String(MAX_ENERGY));
  const energyFill = el('i');
  energyBar.append(energyFill);
  energy.append(el('span', '', t('hud.energy')), energyBar);
  const mapButton = el('button', 'hud-map');
  mapButton.type = 'button';
  mapButton.setAttribute('aria-label', t('hud.minimap'));
  const mapCanvas = el('canvas');
  mapCanvas.width = mapCanvas.height = 240;
  const mapLabel = el('span', 'hud-map__label', t('hud.mapOpen'));
  mapButton.append(mapCanvas, mapLabel);
  mapButton.addEventListener('click', () => opts.onToggleMap());
  right.append(coins, energy, mapButton);

  // Bottom: messages, prompt, item bar.
  const bottom = el('div', 'hud-bottom');
  const toasts = el('div', 'toasts');
  toasts.setAttribute('role', 'status');
  const prompt = el('div', 'prompt');
  prompt.hidden = true;
  const promptKey = el('kbd', 'prompt__key', 'E');
  const promptText = el('span');
  prompt.append(promptKey, promptText);
  const hotbar = el('div', 'hotbar');
  hotbar.setAttribute('role', 'toolbar');
  hotbar.setAttribute('aria-label', t('hud.hotbar'));
  const slots = Array.from({ length: HOTBAR_SIZE }, (_, i) => {
    const b = el('button', 'slot');
    b.type = 'button';
    b.dataset.key = String(i + 1);
    b.addEventListener('click', () => opts.onSelectSlot(i));
    hotbar.append(b);
    return b;
  });
  bottom.append(toasts, prompt, hotbar);

  const notice = el('div', 'hud-notice');
  notice.setAttribute('role', 'status');
  notice.hidden = true;

  root.append(left, right, bottom, notice);
  const minimap = createMinimap(mapCanvas);
  const player = (): PlayerState => game.state.players[opts.playerId]!;

  const update = () => {
    const s = game.state, p = player();
    date.textContent = formatDate(s.time);
    clock.textContent = formatTime(s.time);
    weather.textContent = weatherLabel(s);
    island.textContent = `${t('hud.island', { name: s.island.name })} · ${t('hud.year', { year: s.time.year })}`;
    coinValue.textContent = p.coins.toLocaleString('pt-BR');
    coins.setAttribute('aria-label', t('hud.coins', { coins: p.coins.toLocaleString('pt-BR') }));
    energyFill.style.width = `${(p.energy / MAX_ENERGY) * 100}%`;
    energyBar.setAttribute('aria-valuenow', String(Math.round(p.energy)));
    energyBar.setAttribute('aria-label', t('hud.energyValue', { value: Math.round(p.energy), max: MAX_ENERGY }));
    const tour = s.quests.find(q => q.id === 'tour');
    quest.hidden = !tour || tour.done;
    if (tour && !tour.done) {
      questName.textContent = t('quest.tour.name');
      questText.textContent = t('quest.tour.text');
      questProgress.textContent = t('quest.tour.progress', { done: tour.visited.length, total: TOUR_PLACES.length });
      questFill.style.width = `${(tour.visited.length / TOUR_PLACES.length) * 100}%`;
    }
    slots.forEach((b, i) => {
      paintSlot(b, i, p.inventory);
      b.setAttribute('aria-pressed', String(p.activeSlot === i));
    });
  };
  update();

  let noticeTimer = 0;
  const showNotice = (text: string, ms: number) => {
    notice.textContent = text;
    notice.hidden = false;
    window.clearTimeout(noticeTimer);
    if (ms > 0) noticeTimer = window.setTimeout(() => (notice.hidden = true), ms);
  };
  game.on((event, state) => {
    if (event.type === 'player.moved') return;
    update();
    if (event.type === 'day.ended') showNotice(t('hud.dayEnded'), 0);
    if (event.type === 'day.started') showNotice(t('dev.slept', { day: state.time.day, season: t(`season.${seasonOf(state.time)}`) }), 2600);
  });

  const toast = (text: string) => {
    const item = el('div', 'toast', text);
    toasts.append(item);
    while (toasts.children.length > 3) toasts.firstChild?.remove();
    window.setTimeout(() => item.classList.add('toast--out'), 2200);
    window.setTimeout(() => item.remove(), 2600);
  };

  return {
    update,
    setPrompt(label) {
      // Called every frame: only touch the page when something changed.
      if (prompt.hidden !== (label === null)) prompt.hidden = label === null;
      if (label === null) return;
      if (promptText.textContent !== label) promptText.textContent = label;
      const key = document.body.classList.contains('has-touch') ? t('touch.action') : 'E';
      if (promptKey.textContent !== key) promptKey.textContent = key;
    },
    toast,
    setMapOpen(open) {
      mapLabel.textContent = open ? t('hud.mapClose') : t('hud.mapOpen');
      mapButton.setAttribute('aria-pressed', String(open));
    },
    drawMinimap(frame) {
      const tour = game.state.quests.find(q => q.id === 'tour');
      const pending = tour && !tour.done ? TOUR_PLACES.map(p => p.id).filter(id => !tour.visited.includes(id)) : [];
      minimap.draw({ ...frame, pendingPlaces: pending });
    },
  };
}
