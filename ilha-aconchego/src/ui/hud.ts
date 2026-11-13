import { seasonOf } from '../core/clock';
import { type Game, SYSTEM } from '../core/game';
import type { Actor, GameState } from '../core/types';
import { t } from '../i18n';
import { formatDate, formatTime } from './format';

export interface HudOptions {
  /** Shows the test panel (development builds only). */
  dev: boolean;
  /** Who presses the buttons on this device. */
  localActor: Actor;
}

export interface Hud {
  /** Called every frame with the frame time, for the FPS counter. */
  frame(dtMs: number): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Stage 0 interface: date and time card, end-of-day notice and a test panel. The full HUD arrives in stage 2. */
export function createHud(root: HTMLElement, game: Game, opts: HudOptions): Hud {
  root.replaceChildren();

  const card = el('div', 'hud-card hud-date');
  const date = el('div', 'hud-date__day');
  const row = el('div', 'hud-date__row');
  const clock = el('span', 'hud-date__clock');
  const year = el('span', 'hud-chip');
  const island = el('div', 'hud-date__island');
  row.append(clock, year);
  card.append(date, row, island);

  const notice = el('div', 'hud-notice');
  notice.setAttribute('role', 'status');
  notice.hidden = true;

  root.append(card, notice);

  const render = (state: Readonly<GameState>) => {
    date.textContent = formatDate(state.time);
    clock.textContent = formatTime(state.time);
    year.textContent = t('hud.year', { year: state.time.year });
    island.textContent = t('hud.island', { name: state.island.name });
  };
  render(game.state);

  let noticeTimer = 0;
  const showNotice = (text: string, ms: number) => {
    notice.textContent = text;
    notice.hidden = false;
    window.clearTimeout(noticeTimer);
    if (ms > 0) noticeTimer = window.setTimeout(() => (notice.hidden = true), ms);
  };

  game.on((event, state) => {
    render(state);
    if (event.type === 'day.ended') showNotice(t('hud.dayEnded'), 0);
    if (event.type === 'day.started') {
      showNotice(t('dev.slept', { day: state.time.day, season: t(`season.${seasonOf(state.time)}`) }), 2500);
    }
  });

  let fpsLabel: HTMLElement | null = null;
  if (opts.dev) {
    const panel = el('div', 'hud-card hud-dev');
    panel.append(el('div', 'hud-dev__title', t('dev.title')));
    const buttons = el('div', 'hud-dev__buttons');
    const sleep = el('button', 'hud-btn', t('dev.sleep'));
    sleep.type = 'button';
    sleep.addEventListener('click', () => game.dispatch({ type: 'sleep' }, opts.localActor));
    const hour = el('button', 'hud-btn', t('dev.plusHour'));
    hour.type = 'button';
    hour.addEventListener('click', () => game.dispatch({ type: 'time.advance', steps: 6 }, SYSTEM));
    buttons.append(sleep, hour);
    fpsLabel = el('div', 'hud-dev__fps');
    panel.append(buttons, fpsLabel);
    root.append(panel);
  }

  let frames = 0, acc = 0;
  return {
    frame(dtMs) {
      if (!fpsLabel) return;
      frames++;
      acc += dtMs;
      if (acc >= 500) {
        fpsLabel.textContent = t('dev.fps', { fps: Math.round((frames * 1000) / acc) });
        frames = 0;
        acc = 0;
      }
    },
  };
}
