import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { glow, TIME } from './materials';
import { quality } from './quality';
import { skyDome, type Sky } from './sky';

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

  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private envCache = new Map<string, THREE.Texture>();
  private pmrem: THREE.PMREMGenerator;
  private frameNo = 0;
  private slowSince = 0;
  private viewSince = 0;
  private avgFrame = 16;

  constructor(readonly canvas: HTMLCanvasElement, private fx: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.tier === 'baixa', powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor('#000000', 1);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.setupPipeline();

    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();

    let last = performance.now();
    const frame = (now: number) => {
      requestAnimationFrame(frame);
      const real = now - last;
      let dt = Math.min(0.1, real / 1000);
      last = now;
      if (now < this.slowUntil) dt *= this.timeScale;
      const t = now / 1000;
      TIME.value = t;
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
      if (++this.frameNo % 30 === 0) prepareShadows(view.scene);
      if (this.composer && this.renderPass) {
        this.renderPass.scene = view.scene;
        this.composer.render(dt);
      } else {
        this.renderer.render(view.scene, this.camera);
      }
      this.updateTags();
      this.watchSpeed(now, real);
    };
    requestAnimationFrame(frame);
  }

  /** Monta o pós-processamento do nível de qualidade atual. */
  private setupPipeline(): void {
    this.composer?.dispose();
    this.composer = null;
    this.renderPass = null;
    // sem cor em ponto flutuante não dá para fazer o brilho: modo simples
    const ext = this.renderer.extensions;
    if (!ext.has('EXT_color_buffer_float') && !ext.has('EXT_color_buffer_half_float')) quality.tier = 'baixa';
    const tier = quality.tier;
    const ratio = Math.min(window.devicePixelRatio || 1, tier === 'alta' ? 2 : tier === 'media' ? 1.5 : 1);
    this.renderer.setPixelRatio(ratio);
    this.renderer.shadowMap.type = tier === 'baixa' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if (tier === 'baixa') return;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(this.renderer, target);
    composer.setPixelRatio(ratio);
    this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
    composer.addPass(this.renderPass);
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.92);
    if (tier === 'media') {
      // brilho em meia resolução: quase igual e bem mais leve
      const setSize = bloom.setSize.bind(bloom);
      bloom.setSize = (w: number, h: number) => setSize(Math.ceil(w / 2), Math.ceil(h / 2));
    }
    composer.addPass(bloom);
    composer.addPass(new ShaderPass(GRADE));
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.resize();
  }

  /** Se o jogo ficar lento por alguns segundos, desce a qualidade. */
  private watchSpeed(now: number, real: number): void {
    if (quality.pinned || document.hidden || real > 250) return;
    this.avgFrame += (real - this.avgFrame) * 0.05;
    if (now - this.viewSince < 4000) return;
    if (this.avgFrame < 40) { this.slowSince = 0; return; }
    if (!this.slowSince) this.slowSince = now;
    else if (now - this.slowSince > 3000 && quality.drop()) {
      this.slowSince = 0;
      this.avgFrame = 16;
      this.viewSince = now;
      this.setupPipeline();
    }
  }

  /** Céu com reflexo: liga o mapa de ambiente da cena (calculado uma vez por céu). */
  private prepareEnvironment(scene: THREE.Scene): void {
    const sky = scene.userData.sky as Sky | undefined;
    if (!sky || scene.environment) return;
    let env = this.envCache.get(sky.name);
    if (!env) {
      const tmp = new THREE.Scene();
      tmp.add(skyDome(sky));
      env = this.pmrem.fromScene(tmp, 0.02).texture;
      this.envCache.set(sky.name, env);
    }
    scene.environment = env;
    scene.environmentIntensity = sky.env;
  }

  show(view: View): void {
    this.view = view;
    this.viewSince = performance.now();
    this.clearParticles();
    this.prepareEnvironment(view.scene);
    prepareShadows(view.scene);
    this.applyViewOffset();
  }

  private resize(): void {
    this.width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    this.height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.renderer.setSize(this.width, this.height, false);
    this.composer?.setSize(this.width, this.height);
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
    const geo = PARTICLE;
    const mats = [glow('#f2c75c', 2.2), glow('#fff3d6', 1.8), glow('#c9a227', 1.6), glow('#e0703a', 2)];
    for (let i = 0; i < 70; i++) {
      const mesh = new THREE.Mesh(geo, mats[i % mats.length]);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
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

const PARTICLE = new THREE.OctahedronGeometry(0.1, 0);
PARTICLE.userData.shared = true;

/** Pós-processamento de cor: um pouco mais de saturação e vinheta nas bordas. */
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.12 }, uVignette: { value: 0.32 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSat;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = max(mix(vec3(l), c.rgb, uSat), 0.0);
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.8);
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.75, length(d) * 1.25);
      gl_FragColor = c;
    }`,
};

/**
 * Liga sombras em tudo que é sólido e não é gigante (chão e mar só recebem).
 * Roda em objetos novos: quem já foi visto fica marcado.
 */
function prepareShadows(scene: THREE.Scene): void {
  scene.updateMatrixWorld();
  const s = new THREE.Vector3();
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.lpShadow) return;
    m.userData.lpShadow = true;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    if (!mat?.isMeshStandardMaterial) return;
    m.receiveShadow = !m.userData.noReceive;
    if (m.castShadow || m.userData.noCast || mat.transparent) return;
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    m.getWorldScale(s);
    const r = (m.geometry.boundingSphere?.radius ?? 1) * Math.max(s.x, s.y, s.z);
    m.castShadow = r < 7;
  });
}
