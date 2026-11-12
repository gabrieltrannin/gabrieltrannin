import type { PlayerInput } from '@fuzue/shared';

const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
const PUSH_KEYS = ['j', 'k', 'e', 'shift'];
const JUMP_KEYS = [' ', 'spacebar'];

/**
 * Junta teclado, controle (gamepad), joystick de toque e botões num só input.
 * `sample()` é chamado 30 vezes por segundo durante os minijogos.
 *
 * PC: WASD/setas andam, Espaço pula, J/E/Shift ou clique empurra.
 * Controle: analógico esquerdo anda, A pula, X ou B empurra.
 * Celular/tablet: joystick na tela + botões Pular e Empurrar.
 */
export class Input {
  private enabled = false;
  private keys = new Set<string>();
  private pushQueued = false;
  private jumpQueued = false;
  private stick = { x: 0, z: 0, pointer: -1 };
  private padPrev: boolean[] = [];

  constructor(stickEl: HTMLElement, knobEl: HTMLElement, pushBtn: HTMLElement, jumpBtn: HTMLElement, canvas: HTMLElement) {
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());

    const press = (el: HTMLElement, fn: () => void) => el.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (this.enabled) fn();
    });
    press(pushBtn, () => { this.pushQueued = true; });
    press(jumpBtn, () => { this.jumpQueued = true; });
    canvas.addEventListener('pointerdown', e => {
      if (this.enabled && e.pointerType === 'mouse' && e.button === 0) this.pushQueued = true;
    });

    const RANGE = 46;
    const moveStick = (e: PointerEvent) => {
      const r = stickEl.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > RANGE) { dx = (dx / d) * RANGE; dy = (dy / d) * RANGE; }
      knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / RANGE;
      this.stick.z = dy / RANGE;
    };
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.stick.pointer) return;
      this.stick = { x: 0, z: 0, pointer: -1 };
      knobEl.style.transform = '';
    };
    stickEl.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.stick.pointer = e.pointerId;
      stickEl.setPointerCapture(e.pointerId);
      moveStick(e);
    });
    stickEl.addEventListener('pointermove', e => { if (e.pointerId === this.stick.pointer) moveStick(e); });
    stickEl.addEventListener('pointerup', release);
    stickEl.addEventListener('pointercancel', release);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.reset();
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
    const k = e.key.toLowerCase();
    if (!down) { this.keys.delete(k); return; }
    if (!this.enabled) return;
    if (PUSH_KEYS.includes(k)) {
      e.preventDefault();
      if (!e.repeat) this.pushQueued = true;
    } else if (JUMP_KEYS.includes(k)) {
      e.preventDefault();
      if (!e.repeat) this.jumpQueued = true;
    } else if (MOVE_KEYS.includes(k)) {
      e.preventDefault();
      this.keys.add(k);
    }
  }

  private readPad(): { x: number; z: number; push: boolean; jump: boolean } | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(p => p && p.connected);
    if (!pad) return null;
    const edge = (i: number) => {
      const now = !!pad.buttons[i]?.pressed;
      const was = this.padPrev[i] ?? false;
      this.padPrev[i] = now;
      return now && !was;
    };
    const dead = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    let x = dead(pad.axes[0] ?? 0);
    let z = dead(pad.axes[1] ?? 0);
    if (pad.buttons[14]?.pressed) x = -1;
    if (pad.buttons[15]?.pressed) x = 1;
    if (pad.buttons[12]?.pressed) z = -1;
    if (pad.buttons[13]?.pressed) z = 1;
    const jump = edge(0);
    const push = edge(2) || edge(1);
    return { x, z, push, jump };
  }

  sample(): PlayerInput {
    let x = 0;
    let z = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (!x && !z) { x = this.stick.x; z = this.stick.z; }
    let push = this.pushQueued;
    let jump = this.jumpQueued;
    this.pushQueued = false;
    this.jumpQueued = false;
    const pad = this.readPad();
    if (pad) {
      if (!x && !z) { x = pad.x; z = pad.z; }
      push ||= pad.push;
      jump ||= pad.jump;
    }
    if (!this.enabled) return { x: 0, z: 0, push: false, jump: false };
    return { x, z, push, jump };
  }

  reset(): void {
    this.keys.clear();
    this.pushQueued = false;
    this.jumpQueued = false;
    this.stick = { x: 0, z: 0, pointer: -1 };
  }
}
