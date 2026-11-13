import * as THREE from 'three';

interface Bubble {
  el: HTMLElement;
  anchor: () => THREE.Vector3;
  left: number;
}

const _v = new THREE.Vector3();

/** Speech bubbles that float above things in the 3D world (signs, the pet, stalls; villagers in stage 4). */
export class Bubbles {
  private readonly layer: HTMLElement;
  private readonly bubbles = new Map<string, Bubble>();

  constructor(root: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'bubbles';
    this.layer.setAttribute('aria-live', 'polite');
    root.append(this.layer);
  }

  /** Shows (or replaces) the bubble `id` above `anchor` for `seconds`. */
  show(id: string, text: string, anchor: () => THREE.Vector3, seconds = 3.5, title?: string): void {
    this.hide(id);
    const el = document.createElement('div');
    el.className = 'bubble';
    if (title) {
      const b = document.createElement('b');
      b.textContent = title;
      el.append(b);
    }
    el.append(document.createTextNode(text));
    this.layer.append(el);
    this.bubbles.set(id, { el, anchor, left: seconds });
  }

  hide(id: string): void {
    const b = this.bubbles.get(id);
    if (!b) return;
    b.el.remove();
    this.bubbles.delete(id);
  }

  update(dt: number, camera: THREE.Camera, width: number, height: number): void {
    for (const [id, b] of this.bubbles) {
      b.left -= dt;
      if (b.left <= 0) {
        this.hide(id);
        continue;
      }
      _v.copy(b.anchor()).project(camera);
      const visible = _v.z < 1 && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
      b.el.hidden = !visible;
      if (!visible) continue;
      const half = b.el.offsetWidth / 2 + 8;
      const x = Math.min(Math.max(((_v.x + 1) / 2) * width, half), width - half);
      b.el.style.transform = `translate(${x}px, ${((1 - _v.y) / 2) * height}px) translate(-50%, calc(-100% - 12px))`;
      b.el.style.opacity = String(Math.min(1, b.left * 3));
    }
  }
}
