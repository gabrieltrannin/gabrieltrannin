import type { TouchState } from '../input/input';
import { t } from '../i18n';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * On-screen controls for phones: a virtual stick (bottom left), the Ação button (bottom right)
 * and small buttons for running and the backpack (the minimap opens the whole-island view). Shown on touch screens, or as soon
 * as the screen is touched.
 */
export function createTouchControls(root: HTMLElement, touch: TouchState): { setVisible(v: boolean): void } {
  const layer = el('div', 'touch');
  const stick = el('div', 'touch__stick');
  stick.setAttribute('role', 'presentation');
  stick.setAttribute('aria-label', t('touch.stick'));
  const knob = el('div', 'touch__knob');
  stick.append(knob);

  const action = el('button', 'touch__action', t('touch.action'));
  const run = el('button', 'touch__small touch__run', t('touch.run'));
  const bag = el('button', 'touch__small touch__bag', t('touch.bag'));
  for (const b of [action, run, bag]) b.type = 'button';
  run.setAttribute('aria-pressed', 'false');
  layer.append(stick, action, run, bag);
  root.append(layer);

  let pointer: number | null = null;
  const move = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect(), radius = r.width / 2, max = radius * 0.6;
    let dx = e.clientX - (r.left + radius), dy = e.clientY - (r.top + radius);
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.moveX = dx / max;
    touch.moveY = -dy / max;
  };
  const release = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    touch.moveX = touch.moveY = 0;
    knob.style.transform = '';
  };
  stick.addEventListener('pointerdown', e => {
    pointer = e.pointerId;
    stick.setPointerCapture?.(e.pointerId);
    move(e);
    e.preventDefault();
  });
  stick.addEventListener('pointermove', e => {
    if (e.pointerId === pointer) move(e);
  });
  stick.addEventListener('pointerup', release);
  stick.addEventListener('pointercancel', release);

  action.addEventListener('click', () => (touch.action = true));
  bag.addEventListener('click', () => (touch.toggleBag = true));
  run.addEventListener('click', () => {
    touch.run = !touch.run;
    run.setAttribute('aria-pressed', String(touch.run));
  });

  const setVisible = (visible: boolean) => {
    layer.hidden = !visible;
    document.body.classList.toggle('has-touch', visible);
  };
  setVisible(window.matchMedia('(pointer: coarse)').matches);
  window.addEventListener('touchstart', () => setVisible(true), { once: true, passive: true });
  return { setVisible };
}
