/**
 * Junta teclado, joystick de toque e botão de empurrar num só input.
 * `sample()` é chamado uma vez por tick (30x por segundo).
 */
export class Input {
  enabled = false;
  private keys = new Set<string>();
  private pushQueued = false;
  private stick = { x: 0, z: 0, pointer: -1 };

  constructor(stickEl: HTMLElement, knobEl: HTMLElement, pushBtn: HTMLElement) {
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());

    pushBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (this.enabled) this.pushQueued = true;
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

  private onKey(e: KeyboardEvent, down: boolean): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    const isPush = k === ' ' || k === 'j' || k === 'k';
    const isMove = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k);
    if (!this.enabled || (!isPush && !isMove)) {
      if (!down) this.keys.delete(k);
      return;
    }
    e.preventDefault();
    if (isPush) {
      if (down && !e.repeat) this.pushQueued = true;
      return;
    }
    if (down) this.keys.add(k); else this.keys.delete(k);
  }

  sample(): { x: number; z: number; push: boolean } {
    let x = 0;
    let z = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (!x && !z) { x = this.stick.x; z = this.stick.z; }
    const push = this.pushQueued;
    this.pushQueued = false;
    if (!this.enabled) return { x: 0, z: 0, push: false };
    return { x, z, push };
  }

  reset(): void {
    this.keys.clear();
    this.pushQueued = false;
  }
}
