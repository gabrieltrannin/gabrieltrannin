import { SEASONS } from '../data/calendar';
import { WEATHERS, type WeatherId } from '../data/weather';
import { type Game, SYSTEM } from '../core/game';
import { t, type MessageKey } from '../i18n';
import type { CameraMode } from '../render/camera';

export interface DevPanelOptions {
  /** Erases the save and starts over from the character creator. */
  onNewIsland(): void;
  getCameraMode(): CameraMode;
  setCameraMode(mode: CameraMode): void;
  isClockPaused(): boolean;
  setClockPaused(paused: boolean): void;
}

export interface DevPanel {
  frame(dtMs: number): void;
}

const TIME_PRESETS: [MessageKey, number][] = [
  ['dev.morning', 7 * 60],
  ['dev.afternoon', 13 * 60 + 20],
  ['dev.sunset', 18 * 60 + 30],
  ['dev.night', 21 * 60 + 30],
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Development-only panel to jump the time, season and weather and switch the camera.
 * Every button sends a normal command, so it also exercises the command pipeline.
 */
export function createDevPanel(root: HTMLElement, game: Game, opts: DevPanelOptions): DevPanel {
  const toggle = el('button', 'hud-btn dev-toggle', t('dev.toggle'));
  toggle.type = 'button';
  const panel = el('div', 'hud-card dev-panel');
  panel.id = 'dev-panel';
  toggle.setAttribute('aria-controls', panel.id);

  const header = el('div', 'dev-panel__header');
  const hide = el('button', 'hud-btn hud-btn--small', t('dev.hide'));
  hide.type = 'button';
  header.append(el('div', 'hud-dev__title', t('dev.title')), hide);
  panel.append(header);

  const rows: { buttons: HTMLButtonElement[]; isOn: (i: number) => boolean }[] = [];
  const row = (label: MessageKey, items: string[], onClick: (i: number) => void, isOn: (i: number) => boolean) => {
    const wrap = el('div', 'dev-row');
    const labelId = `dev-${label.replace('.', '-')}`;
    const title = el('div', 'dev-row__label', t(label));
    title.id = labelId;
    const group = el('div', 'dev-row__buttons');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-labelledby', labelId);
    const buttons = items.map((text, i) => {
      const b = el('button', 'hud-btn hud-btn--small', text);
      b.type = 'button';
      b.addEventListener('click', () => {
        onClick(i);
        refresh();
      });
      group.append(b);
      return b;
    });
    rows.push({ buttons, isOn });
    wrap.append(title, group);
    panel.append(wrap);
  };

  row('dev.time', TIME_PRESETS.map(([k]) => t(k)), i => game.dispatch({ type: 'time.sync', minuteOfDay: TIME_PRESETS[i]![1] }, SYSTEM), () => false);
  row(
    'dev.season',
    SEASONS.map(s => t(`season.${s}`)),
    i => game.dispatch({ type: 'time.setDate', seasonIndex: i, day: game.state.time.day }, SYSTEM),
    i => game.state.time.seasonIndex === i,
  );
  row(
    'dev.weather',
    WEATHERS.map(w => t(`weather.${w}`)),
    i => game.dispatch({ type: 'weather.set', weather: WEATHERS[i] as WeatherId }, SYSTEM),
    i => game.state.weather === WEATHERS[i],
  );
  const modes: CameraMode[] = ['follow', 'overview'];
  row('dev.camera', [t('dev.follow'), t('dev.overview')], i => opts.setCameraMode(modes[i]!), i => opts.getCameraMode() === modes[i]);
  row(
    'dev.clock',
    [t('dev.pause'), t('dev.plusHour'), t('dev.sleep'), t('dev.newIsland')],
    i => {
      if (i === 0) opts.setClockPaused(!opts.isClockPaused());
      if (i === 1) game.dispatch({ type: 'time.advance', steps: 6 }, SYSTEM);
      // The test panel skips the walk to the bed: the system can always end the day.
      if (i === 2) game.dispatch({ type: 'sleep' }, SYSTEM);
      if (i === 3) opts.onNewIsland();
    },
    () => false,
  );
  const pauseButton = rows[rows.length - 1]!.buttons[0]!;

  const fps = el('div', 'hud-dev__fps');
  panel.append(fps);

  const refresh = () => {
    for (const r of rows) r.buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(r.isOn(i))));
    pauseButton.textContent = opts.isClockPaused() ? t('dev.resume') : t('dev.pause');
    pauseButton.setAttribute('aria-pressed', String(opts.isClockPaused()));
  };
  game.on(refresh);

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.hidden = open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(true));
  hide.addEventListener('click', () => setOpen(false));
  setOpen(!window.matchMedia('(max-width: 640px)').matches);
  refresh();
  root.append(toggle, panel);

  let frames = 0, acc = 0;
  return {
    frame(dtMs) {
      frames++;
      acc += dtMs;
      if (acc >= 500) {
        fps.textContent = t('dev.fps', { fps: Math.round((frames * 1000) / acc) });
        frames = 0;
        acc = 0;
      }
    },
  };
}
