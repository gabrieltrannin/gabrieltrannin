import * as THREE from 'three';

/** Cor dos detalhes escuros (pupilas, contornos de interface). */
export const INK = '#22170e';

/** Relógio global dos shaders (água, lava, poeira). O Stage avança a cada quadro. */
export const TIME = { value: 0 };

/* ---------------------------------------------------------------------------
 * Visual low-poly: faces retas (flat shading) e cada face com um tom um pouco
 * diferente. O tom vem de um "hash" da normal da face no espaço do objeto,
 * então não pisca quando a câmera mexe e não precisa mexer nas geometrias.
 * ------------------------------------------------------------------------- */

interface LowPolyOpts {
  /** Quanto o tom varia entre faces (0 = nada). */
  facet?: number;
  /** Ondas no vértice (água/lava): altura e velocidade. */
  wave?: { amp: number; speed: number; scale: number };
  /** Faces brilhando e pulsando (lava). */
  pulse?: number;
}

const HASH = /* glsl */ `
varying vec3 vObjPos;
uniform float uFacet;
uniform float uPulse;
uniform float uTime;
float lpHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float lpFace() {
  vec3 n = normalize(cross(dFdx(vObjPos), dFdy(vObjPos)));
  return lpHash(floor(n * 40.0 + 0.5));
}
`;

const WAVE = /* glsl */ `
uniform vec3 uWave;
float lpWave(vec3 p, float t) {
  return sin(p.x * 0.55 * uWave.z + t * 1.3) * 0.55
       + sin(p.z * 0.7 * uWave.z - t * 1.1 + p.x * 0.3) * 0.45
       + sin((p.x + p.z) * 1.3 * uWave.z + t * 2.1) * 0.25;
}
`;

function lowPoly<T extends THREE.MeshStandardMaterial>(material: T, opts: LowPolyOpts): T {
  material.userData.lp = opts;
  material.onBeforeCompile = lowPolyCompile;
  // o programa muda com ondas/pulso, então entram na chave do cache
  material.customProgramCacheKey = () => `lp${opts.wave ? 'w' : ''}${opts.pulse ? 'p' : ''}`;
  return material;
}

function lowPolyCompile(this: THREE.Material, shader: THREE.WebGLProgramParametersWithUniforms): void {
  const opts = this.userData.lp as LowPolyOpts;
  shader.uniforms.uFacet = { value: opts.facet ?? 0 };
  shader.uniforms.uPulse = { value: opts.pulse ?? 0 };
  shader.uniforms.uTime = TIME;
  let head = '#include <common>\nvarying vec3 vObjPos;\n';
  let begin = '#include <begin_vertex>\n';
  if (opts.wave) {
    shader.uniforms.uWave = { value: new THREE.Vector3(opts.wave.amp, opts.wave.speed, opts.wave.scale) };
    head += 'uniform float uTime;\n' + WAVE;
    // posição no mundo, para as ondas casarem entre pedaços vizinhos
    begin += `
      vec4 lpW = modelMatrix * vec4(transformed, 1.0);
      transformed.y += lpWave(lpW.xyz, uTime * uWave.y) * uWave.x;
    `;
  }
  begin += 'vObjPos = transformed;\n';
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', head)
    .replace('#include <begin_vertex>', begin);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + HASH)
    .replace('#include <color_fragment>', `#include <color_fragment>
      float lpF = lpFace();
      diffuseColor.rgb *= 1.0 + (lpF - 0.5) * uFacet;`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance *= 1.0 + (lpF - 0.5) * uPulse + sin(uTime * 2.2 + lpF * 6.283) * uPulse * 0.35;`);
}

/* ---------------- fábrica de materiais (reaproveitados) ---------------- */

export interface PaintOpts {
  /** Sombreamento liso em vez de facetado (olhos, bochechas). */
  smooth?: boolean;
  /** Variação de tom entre faces (padrão 0,07). */
  facet?: number;
  rough?: number;
  side?: THREE.Side;
  opacity?: number;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();
const glowCache = new Map<string, THREE.MeshBasicMaterial>();

/** Material fosco low-poly de uma cor. */
export function paint(color: string, opts: PaintOpts = {}): THREE.MeshStandardMaterial {
  const key = `p|${color}|${opts.smooth ? 1 : 0}|${opts.facet ?? ''}|${opts.rough ?? ''}|${opts.side ?? ''}|${opts.opacity ?? ''}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.86,
      metalness: 0,
      flatShading: !opts.smooth,
      side: opts.side ?? THREE.FrontSide,
      transparent: opts.opacity !== undefined,
      opacity: opts.opacity ?? 1,
      depthWrite: opts.opacity === undefined,
    });
    if (!opts.smooth) lowPoly(m, { facet: opts.facet ?? 0.07 });
    cache.set(key, m);
  }
  return m;
}

/** Metal que reflete o céu (elmos, ouro, ferragens). */
export function metal(color: string, rough = 0.32, side: THREE.Side = THREE.FrontSide): THREE.MeshStandardMaterial {
  const key = `m|${color}|${rough}|${side}`;
  let m = cache.get(key);
  if (!m) {
    m = lowPoly(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.9, flatShading: true, side }), { facet: 0.12 });
    cache.set(key, m);
  }
  return m;
}

/** Algo que emite luz (fogo, magia): passa de 1,0 e acende o bloom. */
export function glow(color: string, intensity = 2.4, opts: { opacity?: number } = {}): THREE.MeshBasicMaterial {
  const key = `g|${color}|${intensity}|${opts.opacity ?? ''}`;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: opts.opacity !== undefined, opacity: opts.opacity ?? 1 });
    m.color.multiplyScalar(intensity);
    glowCache.set(key, m);
  }
  return m;
}

/** Material com textura (dados, placas, bola). */
export function paintMap(map: THREE.Texture, opts: { rough?: number; transparent?: boolean } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map, roughness: opts.rough ?? 0.8, transparent: opts.transparent ?? false });
}

/** Água ou lava facetada, com ondas animadas no shader. */
export function liquid(kind: 'water' | 'lava' | 'stream'): THREE.MeshStandardMaterial {
  if (kind === 'lava') {
    return lowPoly(new THREE.MeshStandardMaterial({
      color: '#2a0d05', emissive: '#d9420e', emissiveIntensity: 0.6, roughness: 0.6, flatShading: true,
    }), { facet: 0.25, pulse: 1.1, wave: { amp: 0.35, speed: 0.5, scale: 1 } });
  }
  if (kind === 'stream') {
    return lowPoly(new THREE.MeshStandardMaterial({
      color: '#3f7f96', roughness: 0.18, metalness: 0.15, flatShading: true,
    }), { facet: 0.22, wave: { amp: 0.06, speed: 3, scale: 3 } });
  }
  return lowPoly(new THREE.MeshStandardMaterial({
    color: '#2f6676', roughness: 0.3, metalness: 0.15, flatShading: true,
  }), { facet: 0.1, wave: { amp: 0.3, speed: 1, scale: 1 } });
}

/* ---------------- geometrias ---------------- */

/** Marca uma geometria usada por várias telas (não é liberada ao trocar de tela). */
export function shared<T extends THREE.BufferGeometry>(g: T): T {
  g.userData.shared = true;
  return g;
}

/** Esfera low-poly (icosaedro subdividido): facetas iguais, sem "polo". */
const SPHERE = shared(new THREE.IcosahedronGeometry(1, 2));
/** Mais grosseira: folhagem, nuvens, pedras redondas. */
const CHUNK = shared(new THREE.IcosahedronGeometry(1, 1));
/** Lisa: olhos e detalhes pequenos do rosto. */
const SMOOTH = shared(new THREE.SphereGeometry(1, 20, 14));

/** Esfera (ou elipsoide) de raio `r`. */
export function ball(r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const geo = (mat as THREE.MeshStandardMaterial).flatShading === false || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial ? SMOOTH : SPHERE;
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(r * sx, r * sy, r * sz);
  return m;
}

/** Bolota bem facetada (copas de árvore, nuvens, arbustos). */
export function chunk(r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(CHUNK, mat);
  m.scale.set(r * sx, r * sy, r * sz);
  return m;
}

/** Cria uma textura desenhada num canvas 2D. */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (g) draw(g, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Pseudo-aleatório com semente (o cenário fica igual para todo mundo). */
export function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
