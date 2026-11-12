import * as THREE from 'three';
import { ARENA } from '@fuzue/shared';
import { ball, canvasTexture, outline, seeded, stripeTexture, toon, toonMap } from './materials';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SEA_Y = -3;

export interface Tag {
  el: HTMLElement;
  obj: THREE.Object3D;
  y: number;
  hidden: boolean;
}

interface Particle { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number; }
interface Ripple { mesh: THREE.Mesh; t: number; }

type CameraMode = 'menu' | 'game';

/**
 * Cena 3D da arena, câmera, rótulos e efeitos.
 * Não sabe nada de rede: a sessão (Session) diz onde cada coisa está.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
  /** Malhas das bolas gigantes, na ordem de ARENA.balls. */
  readonly balls: THREE.Mesh[] = [];

  width = 1;
  height = 1;
  mode: CameraMode = 'menu';
  /** Ponto que a câmera de jogo acompanha (normalmente o próprio jogador). */
  readonly follow = new THREE.Vector3();
  /** Onde fica o boneco de vitrine no menu: na borda da frente, com a arena ao fundo. */
  readonly menuSpot = new THREE.Vector3(0, 0, 6.2);

  private tags: Tag[] = [];
  private particles: Particle[] = [];
  private ripples: Ripple[] = [];
  private donuts: { g: THREE.Group; ph: number }[] = [];
  private shakeT = 0;
  private shakeAmp = 0;
  private camTarget = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private onFrameCb: ((dt: number, t: number) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, private fx: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    this.addLights();
    this.buildArena();
    this.buildScenery();

    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();

    let last = performance.now();
    const frame = (now: number) => {
      requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      this.onFrameCb?.(dt, t);
      this.updateEffects(dt, t);
      this.updateCamera(dt, t);
      this.renderer.render(this.scene, this.camera);
      this.updateTags();
    };
    requestAnimationFrame(frame);
  }

  /** Registra a função chamada a cada quadro, antes de desenhar. */
  onFrame(cb: ((dt: number, t: number) => void) | null): void {
    this.onFrameCb = cb;
  }

  /* ---------------- montagem da cena ---------------- */

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#c7b2ff', 1.95));
    const sun = new THREE.DirectionalLight('#fff4e2', 1.95);
    sun.position.set(6, 16, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -11; c.right = 11; c.top = 11; c.bottom = -11; c.near = 1; c.far = 50;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);
  }

  private buildArena(): void {
    const R = ARENA.radius;
    const ringTex = canvasTexture(512, 512, (g, w) => {
      g.fillStyle = '#d4f1ff';
      g.fillRect(0, 0, w, w);
      const c = w / 2;
      for (let i = 8; i > 0; i--) {
        g.beginPath();
        g.arc(c, c, i * 30, 0, Math.PI * 2);
        g.fillStyle = i % 2 ? '#c2eaff' : '#e4f7ff';
        g.fill();
      }
      g.lineWidth = 14;
      g.strokeStyle = '#ffffff';
      g.beginPath();
      g.arc(c, c, w / 2 - 12, 0, Math.PI * 2);
      g.stroke();
      drawStar(g, c, c, 58, 26);
    });
    const side = stripeTexture('#ffffff', '#ff5fa2');
    side.repeat.set(12, 1);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1, 72), [toonMap(side), toonMap(ringTex), toon('#9fd8f5')]);
    platform.position.y = -0.5;
    platform.receiveShadow = true;
    outline(platform, 1.006, 1.04);
    this.scene.add(platform);

    const pillarTex = stripeTexture('#ffffff', '#3fd6b0');
    pillarTex.repeat.set(3, 2);
    for (const p of ARENA.pillars) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, p.h, 24), toonMap(pillarTex));
      m.position.set(p.x, p.h / 2, p.z);
      m.castShadow = true;
      m.receiveShadow = true;
      outline(m, 1.06, 1.02);
      this.scene.add(m);
      const cap = ball(p.r * 1.05, toon('#ffc93c'), 1, 0.55, 1);
      cap.position.set(p.x, p.h, p.z);
      cap.castShadow = true;
      outline(cap, 1.06);
      this.scene.add(cap);
    }

    const ballTex = canvasTexture(512, 256, (g, w, h) => {
      const cols = ['#ff5fa2', '#ffffff', '#ffc93c', '#ffffff', '#4aa3ff', '#ffffff', '#3fd6b0', '#ffffff'];
      cols.forEach((c, i) => { g.fillStyle = c; g.fillRect((i * w) / cols.length, 0, w / cols.length + 1, h); });
    });
    for (const b of ARENA.balls) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(b.r, 32, 20), toonMap(ballTex));
      m.position.set(b.x, b.r, b.z);
      m.castShadow = true;
      outline(m, 1.04);
      this.scene.add(m);
      this.balls.push(m);
    }

    const sea = new THREE.Mesh(new THREE.CircleGeometry(120, 64), toon('#ff9ecb'));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = SEA_Y;
    this.scene.add(sea);
  }

  private buildScenery(): void {
    const rand = seeded(11);
    const torus = new THREE.TorusGeometry(0.7, 0.32, 12, 24);
    const icings = ['#ff5fa2', '#a77bff', '#3fd6b0', '#ffffff', '#ffc93c'];
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const dough = new THREE.Mesh(torus, toon('#e8a765'));
      dough.rotation.x = Math.PI / 2;
      outline(dough, 1.05);
      g.add(dough);
      const icing = new THREE.Mesh(torus, toon(icings[i % icings.length]));
      icing.rotation.x = Math.PI / 2;
      icing.position.y = 0.12;
      icing.scale.set(0.98, 0.98, 0.7);
      g.add(icing);
      const a = (i / 10) * Math.PI * 2 + rand() * 0.4;
      const r = 11 + rand() * 7;
      g.position.set(Math.cos(a) * r, SEA_Y + 0.05, Math.sin(a) * r);
      g.rotation.y = rand() * Math.PI * 2;
      this.scene.add(g);
      this.donuts.push({ g, ph: rand() * Math.PI * 2 });
    }

    const tallTex = stripeTexture('#ffffff', '#ff5fa2');
    tallTex.repeat.set(3, 5);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.36;
      const r = 22;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 12, 16), toonMap(tallTex));
      p.position.set(Math.cos(a) * r, SEA_Y + 6, Math.sin(a) * r);
      this.scene.add(p);
      const top = ball(1.1, toon(icings[i % icings.length]));
      top.position.set(p.position.x, SEA_Y + 12.6, p.position.z);
      outline(top, 1.05);
      this.scene.add(top);
    }

    const cloudMat = toon('#ffffff');
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const n = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const b = ball(0.8 + rand() * 0.7, cloudMat, 1, 0.72, 1);
        b.position.set((k - (n - 1) / 2) * 1.1, rand() * 0.4, rand() * 0.6);
        g.add(b);
      }
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.6;
      g.position.set(Math.cos(a) * 34, 6 + rand() * 8, Math.sin(a) * 34);
      g.scale.setScalar(2.4);
      this.scene.add(g);
    }

    // reservas para efeitos
    const sparkGeo = new THREE.SphereGeometry(0.09, 8, 6);
    const sparkColors = ['#ffc93c', '#ffffff', '#ff5fa2'];
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: sparkColors[i % 3] }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.08, 6, 28),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 }),
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = SEA_Y + 0.08;
      this.scene.add(mesh);
      this.ripples.push({ mesh, t: 1 });
    }
  }

  /* ---------------- câmera ---------------- */

  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.applyViewOffset();
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    this.applyViewOffset();
  }

  /** No menu, empurra a cena para o lado livre da tela (o cartão ocupa o resto). */
  private applyViewOffset(): void {
    const { width: w, height: h } = this;
    if (this.mode === 'menu') {
      if (w >= 820) this.camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
      else this.camera.setViewOffset(w, h, 0, h * 0.25, w, h);
    } else {
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
  }

  private updateCamera(dt: number, t: number): void {
    const portrait = this.width / this.height < 1;
    const sway = reduceMotion ? 0 : Math.sin(t * 0.25) * 0.4;
    if (this.mode === 'menu') {
      const m = this.menuSpot;
      this.camera.position.set(m.x + sway * 0.5, 2.1, m.z + 6.4);
      this.camTarget.set(m.x, 0.95, m.z);
    } else {
      const want = this.v.set(this.follow.x * 0.25, 0, this.follow.z * 0.25 + 0.6);
      this.camTarget.lerp(want, 1 - Math.exp(-3 * dt));
      const dist = portrait ? 1.5 : 1;
      this.camera.position.set(this.camTarget.x + sway, 13.5 * dist, this.camTarget.z + 12.5 * dist);
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT) * 4;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    }
    this.camera.lookAt(this.camTarget);
  }

  shake(amount: number): void {
    if (reduceMotion) return;
    this.shakeT = 0.25;
    this.shakeAmp = amount;
  }

  /* ---------------- rótulos e efeitos ---------------- */

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

  private toScreen(p: THREE.Vector3): { x: number; y: number; ok: boolean } {
    const v = this.v.copy(p).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height, ok: v.z < 1 };
  }

  private updateTags(): void {
    for (const t of this.tags) {
      if (t.hidden) { t.el.hidden = true; continue; }
      t.obj.getWorldPosition(this.v);
      this.v.y += t.y;
      const s = this.toScreen(this.v);
      t.el.hidden = !s.ok;
      t.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  /** Texto que sobe e some (ex.: "POW!"). */
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

  /** Estrelinhas voando a partir de um ponto. */
  burst(at: THREE.Vector3, count = 14): void {
    let n = 0;
    for (const p of this.particles) {
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 4;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = 2 + Math.random() * 4;
      p.life = 0.5 + Math.random() * 0.3;
      p.mesh.position.copy(at);
      p.mesh.visible = true;
      if (++n >= count) break;
    }
  }

  splash(x: number, z: number): void {
    const r = this.ripples.find(rp => rp.t >= 1) ?? this.ripples[0];
    r.t = 0;
    r.mesh.position.x = x;
    r.mesh.position.z = z;
  }

  private updateEffects(dt: number, t: number): void {
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
    for (const r of this.ripples) {
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + dt * 1.3);
      r.mesh.scale.setScalar(1 + r.t * 4);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - r.t;
    }
    if (!reduceMotion) {
      for (const d of this.donuts) {
        d.g.position.y = SEA_Y + 0.05 + Math.sin(t * 1.4 + d.ph) * 0.12;
        d.g.rotation.y += dt * 0.15;
      }
    }
  }
}

function drawStar(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, r: number): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r : R;
    g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
  }
  g.closePath();
  g.fillStyle = '#ffc93c';
  g.fill();
  g.lineWidth = 8;
  g.lineJoin = 'round';
  g.strokeStyle = '#2a1d45';
  g.stroke();
}

export { SEA_Y };
