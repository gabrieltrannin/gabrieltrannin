import { seasonOf } from '../core/clock';
import type { Game } from '../core/game';
import type { GameState } from '../core/types';
import { t } from '../i18n';
import { formatDate, formatTime } from './format';

export interface Hud {
  update(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Sunny weather reads "Céu limpo" after dark. */
function weatherLabel(state: Readonly<GameState>): string {
  const m = state.time.minuteOfDay;
  const dark = m >= 20 * 60 || m < 6 * 60;
  if (state.weather === 'sun' && dark) return t('weather.clearNight');
  return t(`weather.${state.weather}`);
}

/** Date, time and weather card, plus the end-of-day notice. The full HUD arrives in stage 2. */
export function createHud(root: HTMLElement, game: Game): Hud {
  const card = el('div', 'hud-card hud-date');
  const date = el('div', 'hud-date__day');
  const row = el('div', 'hud-date__row');
  const clock = el('span', 'hud-date__clock');
  const weather = el('span', 'hud-chip');
  const island = el('div', 'hud-date__island');
  row.append(clock, weather);
  card.append(date, row, island);

  const notice = el('div', 'hud-notice');
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  root.append(card, notice);

  const render = () => {
    const state = game.state;
    date.textContent = formatDate(state.time);
    clock.textContent = formatTime(state.time);
    weather.textContent = weatherLabel(state);
    island.textContent = `${t('hud.island', { name: state.island.name })} · ${t('hud.year', { year: state.time.year })}`;
  };
  render();

  let timer = 0;
  const showNotice = (text: string, ms: number) => {
    notice.textContent = text;
    notice.hidden = false;
    window.clearTimeout(timer);
    if (ms > 0) timer = window.setTimeout(() => (notice.hidden = true), ms);
  };

  game.on((event, state) => {
    render();
    if (event.type === 'day.ended') showNotice(t('hud.dayEnded'), 0);
    if (event.type === 'day.started') showNotice(t('dev.slept', { day: state.time.day, season: t(`season.${seasonOf(state.time)}`) }), 2500);
    if (event.type === 'time.changed' && !state.time.dayEnded && notice.textContent === t('hud.dayEnded')) notice.hidden = true;
  });

  return { update: render };
}
