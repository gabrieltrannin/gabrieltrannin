import * as THREE from 'three';

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = window.matchMedia('(pointer: coarse)').matches;

/** Uma tela 3D (lobby, tabuleiro, minijogo...). */
export interface View {
  readonly scene: THREE.Scene;
  /** Chamado a cada quadro. Deve posicionar a câmera. */
  update(dt: number, t: number): void;
  /** Deslocamento da imagem (para deixar espaço para painéis). */
  viewOffset?(w: number, h: number): { x: number; y: number } | null;
}

export interface Tag {
  el: HTMLElement;
  obj: THREE.Object3D;
  y: number;
  hidden: boolean;
}

interface Particle { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }

/**
 * Renderizador único do jogo. Troca de tela com `show(view)`; cuida de
 * nomes sobre as cabeças, textos que sobem ("POW!"), partículas e tremor.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  width = 1;
  height = 1;
  view: View | null = null;

  private tags: Tag[] = [];
  private particles: Particle[] = [];
  private particleScene: THREE.Scene | null = null;
  private shakeT = 0;
  private shakeAmp = 0;
  private readonly v = new THREE.Vector3();
  private timeScale = 1;
  private slowUntil = 0;

  constructor(readonly canvas: HTMLCanvasElement, private fx: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch || window.devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();

    let last = performance.now();
    const frame = (now: number) => {
      requestAnimationFrame(frame);
      let dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (now < this.slowUntil) dt *= this.timeScale;
      const t = now / 1000;
      const view = this.view;
      if (!view) return;
      view.update(dt, t);
      this.updateParticles(dt);
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const a = this.shakeAmp * Math.max(0, this.shakeT) * 4;
        this.camera.position.x += (Math.random() - 0.5) * a;
        this.camera.position.y += (Math.random() - 0.5) * a;
      }
      this.renderer.render(view.scene, this.camera);
      this.updateTags();
    };
    requestAnimationFrame(frame);
  }

  show(view: View): void {
    this.view = view;
    this.clearParticles();
    this.applyViewOffset();
  }

  private resize(): void {
    this.width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    this.height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.applyViewOffset();
  }

  applyViewOffset(): void {
    const off = this.view?.viewOffset?.(this.width, this.height);
    if (off) this.camera.setViewOffset(this.width, this.height, off.x, off.y, this.width, this.height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  get portrait(): boolean {
    return this.width / this.height < 0.9;
  }

  /* ---------------- tremor e câmera lenta ---------------- */

  shake(amount: number): void {
    if (reduceMotion) return;
    this.shakeT = 0.28;
    this.shakeAmp = amount;
  }

  /** Câmera lenta por um instante (momentos decisivos). */
  slowMo(scale = 0.3, ms = 700): void {
    if (reduceMotion) return;
    this.timeScale = scale;
    this.slowUntil = performance.now() + ms;
  }

  /* ---------------- nomes sobre as cabeças ---------------- */

  addTag(obj: THREE.Object3D, y: number, html: string, className = 'tag'): Tag {
    const el = document.createElement('div');
    el.className = className;
    el.innerHTML = html;
    el.hidden = true;
    this.fx.appendChild(el);
    const tag: Tag = { el, obj, y, hidden: false };
    this.tags.push(tag);
    return tag;
  }

  removeTag(tag: Tag): void {
    tag.el.remove();
    this.tags = this.tags.filter(t => t !== tag);
  }

  toScreen(p: THREE.Vector3): { x: number; y: number; ok: boolean } {
    const v = this.v.copy(p).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height, ok: v.z < 1 };
  }

  private updateTags(): void {
    for (const t of this.tags) {
      if (t.hidden || !t.obj.parent) { t.el.hidden = true; continue; }
      t.obj.getWorldPosition(this.v);
      this.v.y += t.y;
      const s = this.toScreen(this.v);
      t.el.hidden = !s.ok;
      t.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  /** Texto que sobe e some. */
  pop(at: THREE.Vector3, text: string, className = ''): void {
    const s = this.toScreen(at);
    if (!s.ok) return;
    const el = document.createElement('div');
    el.className = `pop ${className}`;
    el.textContent = text;
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    this.fx.appendChild(el);
    window.setTimeout(() => el.remove(), 1400);
  }

  /** Faixa grande no meio da tela ("GOOOL!", "3", "JÁ!"). */
  banner(text: string, className = ''): void {
    const el = document.createElement('div');
    el.className = `banner ${className}`;
    el.textContent = text;
    this.fx.appendChild(el);
    window.setTimeout(() => el.remove(), 1500);
  }

  /* ---------------- partículas ---------------- */

  private ensureParticles(scene: THREE.Scene): void {
    if (this.particleScene === scene) return;
    this.clearParticles();
    const geo = new THREE.SphereGeometry(0.09, 8, 6);
    const colors = ['#ffc93c', '#ffffff', '#ff5fa2', '#4aa3ff', '#3fd6b0'];
    for (let i = 0; i < 70; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
      mesh.visible = false;
      scene.add(mesh);
      this.particles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    this.particleScene = scene;
  }

  private clearParticles(): void {
    for (const p of this.particles) p.mesh.removeFromParent();
    this.particles = [];
    this.particleScene = null;
  }

  burst(at: THREE.Vector3, count = 14, power = 1): void {
    if (!this.view) return;
    this.ensureParticles(this.view.scene);
    let n = 0;
    for (const p of this.particles) {
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const sp = (3 + Math.random() * 4) * power;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = (2 + Math.random() * 4) * power;
      p.life = 0.5 + Math.random() * 0.4;
      p.mesh.position.copy(at);
      p.mesh.visible = true;
      if (++n >= count) break;
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= 18 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(Math.max(0.01, p.life * 2));
      if (p.life <= 0) p.mesh.visible = false;
    }
  }
}
