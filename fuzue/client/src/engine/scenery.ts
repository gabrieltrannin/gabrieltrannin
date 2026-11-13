import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from '@fuzue/shared';
import { reduceMotion } from './Stage';
import { ball, chunk, glow, liquid, metal, paint, shared, TIME } from './materials';
import { quality } from './quality';
import { skyDome, SKIES, type Sky } from './sky';

export { SKIES, type Sky };

/** Peças de cenário medieval low-poly reaproveitadas pelas telas. */

/* ---------------- céu, luz e neblina ---------------- */

/** Céu, neblina, luz do céu e sol com sombra. `size` = metade da área com sombra. */
export function setupWorld(scene: THREE.Scene, sky: Sky, size = 12): THREE.DirectionalLight {
  scene.userData.sky = sky;
  scene.add(skyDome(sky));
  scene.fog = new THREE.Fog(sky.horizon, sky.fogNear, sky.fogFar);
  const skyTint = new THREE.Color(sky.top).lerp(new THREE.Color(sky.horizon), 0.55);
  scene.add(new THREE.HemisphereLight(skyTint, sky.bottom, sky.hemi));
  const sun = new THREE.DirectionalLight(sky.sun, sky.sunIntensity);
  sun.position.set(...sky.sunDir).normalize().multiplyScalar(40);
  sun.castShadow = true;
  const res = quality.tier === 'alta' ? 2048 : 1024;
  sun.shadow.mapSize.set(res, res);
  const c = sun.shadow.camera;
  c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 5; c.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

export const SEA_Y = -3;

/* ---------------- chão de pedra ---------------- */

/** Lajes de pedra: prismas de 5, 6 e 7 lados um pouco mais estreitos em cima (borda chanfrada). */
const FLAGSTONES = [5, 6, 7].map(n => shared(new THREE.CylinderGeometry(0.86, 1, 1, n)));

export interface FloorOpts {
  colors?: string[];
  grout?: string;
  seed?: number;
  /** Tamanho de cada pedra (m). */
  stone?: number;
}

/**
 * Calçamento de pedras de verdade (uma malha instanciada só), com o rejunte
 * escuro por baixo. O topo fica em y = 0.
 */
export function stoneFloor(shape: { radius: number } | { w: number; d: number }, opts: FloorOpts = {}): THREE.Group {
  const g = new THREE.Group();
  const cell = opts.stone ?? 0.6;
  const rand = seeded(opts.seed ?? 3);
  const colors = (opts.colors ?? ['#968e81', '#a39b8d', '#8a8376', '#ada495']).map(c => new THREE.Color(c));
  const round = 'radius' in shape;
  const hx = round ? shape.radius : shape.w / 2;
  const hz = round ? shape.radius : shape.d / 2;
  const pts: { x: number; z: number }[] = [];
  const rowStep = cell * 0.86;
  for (let row = 0, z = -hz + cell * 0.45; z < hz - cell * 0.2; row++, z += rowStep) {
    for (let x = -hx + cell * 0.45 + (row % 2) * cell * 0.5; x < hx - cell * 0.2; x += cell) {
      const px = x + (rand() - 0.5) * cell * 0.14;
      const pz = z + (rand() - 0.5) * cell * 0.14;
      if (round ? Math.hypot(px, pz) > shape.radius - cell * 0.4 : Math.abs(px) > hx - cell * 0.3 || Math.abs(pz) > hz - cell * 0.3) continue;
      pts.push({ x: px, z: pz });
    }
  }
  const mat = paint('#ffffff', { facet: 0.1 });
  const kinds = FLAGSTONES.map(geo => ({ geo, list: [] as { x: number; z: number }[] }));
  for (const p of pts) kinds[Math.floor(rand() * kinds.length)].list.push(p);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  for (const k of kinds) {
    const stones = new THREE.InstancedMesh(k.geo, mat, k.list.length);
    k.list.forEach((p, i) => {
      const r = cell * 0.5 * (0.92 + rand() * 0.12);
      const h = 0.12 + rand() * 0.04;
      q.setFromEuler(e.set((rand() - 0.5) * 0.06, rand() * Math.PI, (rand() - 0.5) * 0.06));
      m.compose(new THREE.Vector3(p.x, -h / 2 + 0.02 + rand() * 0.02, p.z), q, new THREE.Vector3(r * (0.9 + rand() * 0.2), h, r * (0.9 + rand() * 0.2)));
      stones.setMatrixAt(i, m);
      col.copy(colors[Math.floor(rand() * colors.length)]).multiplyScalar(0.94 + rand() * 0.1);
      stones.setColorAt(i, col);
    });
    stones.userData.noCast = true;
    g.add(stones);
  }
  const grout = new THREE.Mesh(
    round ? new THREE.CylinderGeometry(shape.radius, shape.radius, 0.1, 40) : new THREE.BoxGeometry(shape.w, 0.1, shape.d),
    paint(opts.grout ?? '#4e4840'),
  );
  grout.position.y = -0.07;
  grout.userData.noCast = true;
  g.add(grout);
  return g;
}

/* ---------------- grama e flores ---------------- */

/** Tufo de 3 folhas finas. */
const TUFT = shared((() => {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.ConeGeometry(0.05, 0.32, 3);
    blade.translate(0, 0.16, 0);
    blade.rotateZ((i - 1) * 0.45);
    blade.rotateY(i * 2.1);
    parts.push(blade);
  }
  return mergeGeometries(parts);
})());
const PETAL = shared(new THREE.OctahedronGeometry(0.07, 0));

/**
 * Espalha tufos de grama e flores. `ok(x, z)` diz se pode pôr ali.
 */
export function scatterGrass(scene: THREE.Scene, count: number, area: { radius: number } | { w: number; d: number }, ok: (x: number, z: number) => boolean = () => true, seed = 17, y = 0): void {
  const rand = seeded(seed);
  const n = Math.round(count * (quality.tier === 'baixa' ? 0.4 : quality.tier === 'media' ? 0.7 : 1));
  const greens = ['#5f8a3c', '#6f9a45', '#4f7a35', '#80a24e'].map(c => new THREE.Color(c));
  const flowerColors = ['#f2ede0', '#e8c547', '#c9465a', '#8f6fc2'].map(c => new THREE.Color(c));
  const tufts = new THREE.InstancedMesh(TUFT, paint('#ffffff', { facet: 0.15 }), n);
  const flowers = new THREE.InstancedMesh(PETAL, paint('#ffffff', { facet: 0.1 }), Math.ceil(n / 5));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let t = 0;
  let f = 0;
  for (let k = 0; k < n * 4 && t < n; k++) {
    const x = 'radius' in area ? (rand() * 2 - 1) * area.radius : (rand() - 0.5) * area.w;
    const z = 'radius' in area ? (rand() * 2 - 1) * area.radius : (rand() - 0.5) * area.d;
    if ('radius' in area && Math.hypot(x, z) > area.radius) continue;
    if (!ok(x, z)) continue;
    const s = 0.7 + rand() * 0.7;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * (0.8 + rand() * 0.5), s));
    tufts.setMatrixAt(t, m);
    tufts.setColorAt(t, greens[Math.floor(rand() * greens.length)]);
    t++;
    if (f < flowers.count && rand() < 0.2) {
      m.compose(new THREE.Vector3(x + 0.08, y + 0.3 * s, z), q, new THREE.Vector3(1, 0.7, 1));
      flowers.setMatrixAt(f, m);
      flowers.setColorAt(f, flowerColors[Math.floor(rand() * flowerColors.length)]);
      f++;
    }
  }
  tufts.count = t;
  flowers.count = f;
  tufts.userData.noCast = true;
  flowers.userData.noCast = true;
  scene.add(tufts, flowers);
}

/* ---------------- partículas no ar ---------------- */

const MOTE_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uSize;
uniform float uHeight;
uniform float uRise;
uniform float uScale;
varying float vFade;
void main() {
  vec3 p = position;
  float t = uTime * (0.5 + fract(aSeed * 7.3) * 0.5);
  p.y = mod(p.y + t * uRise, uHeight);
  p.x += sin(t * 0.7 + aSeed * 6.28) * 0.6;
  p.z += cos(t * 0.6 + aSeed * 4.1) * 0.6;
  vFade = smoothstep(0.0, 0.15, p.y / uHeight) * smoothstep(1.0, 0.75, p.y / uHeight)
        * (0.55 + 0.45 * sin(uTime * 2.3 + aSeed * 30.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vFade;
  gl_FragColor = vec4(uColor * a, a);
}`;

/**
 * Pontinhos de luz flutuando: poeira dourada, brasas subindo, neve caindo,
 * vagalumes. Animados só no shader.
 */
export function addMotes(scene: THREE.Scene, kind: 'poeira' | 'brasa' | 'neve' | 'vagalume', radius = 14, y0 = 0, height = 8): THREE.Points {
  const conf = {
    poeira: { n: 90, color: '#ffe3a8', glow: 1.4, size: 9, rise: 0.25 },
    brasa: { n: 120, color: '#ff8a3c', glow: 3.0, size: 10, rise: 1.2 },
    neve: { n: 160, color: '#ffffff', glow: 1.0, size: 12, rise: -0.9 },
    vagalume: { n: 50, color: '#d9ff7a', glow: 3.2, size: 11, rise: 0.12 },
  }[kind];
  const n = Math.round(conf.n * (quality.tier === 'baixa' ? 0.4 : 1));
  const rand = seeded(n + radius);
  const pos = new Float32Array(n * 3);
  const seeds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    pos.set([Math.cos(a) * r, rand() * height, Math.sin(a) * r], i * 3);
    seeds[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: MOTE_VERT,
    fragmentShader: MOTE_FRAG,
    uniforms: {
      uTime: TIME,
      uSize: { value: conf.size },
      uHeight: { value: height },
      uRise: { value: conf.rise },
      uScale: { value: Math.min(window.devicePixelRatio || 1, 2) * 11 },
      uColor: { value: new THREE.Color(conf.color).multiplyScalar(conf.glow) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.position.y = y0;
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}

/* ---------------- água, lava e horizonte ---------------- */

/** Lago (ou lava) facetado com ondas, pedras e barquinhos. Retorna a animação. */
export function addSea(scene: THREE.Scene, seed = 11, y = SEA_Y, kind: 'water' | 'lava' = 'water'): (dt: number, t: number) => void {
  const lava = kind === 'lava';
  const segs = quality.tier === 'baixa' ? 50 : 90;
  const geo = new THREE.PlaneGeometry(200, 200, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const surface = new THREE.Mesh(geo, liquid(lava ? 'lava' : 'water'));
  surface.position.y = y;
  surface.userData.noCast = true;
  scene.add(surface);
  // depois da parte com ondas, um anel liso até o horizonte
  const far = new THREE.Mesh(new THREE.RingGeometry(98, 320, 48, 1), lava ? glow('#7a2208', 1.2) : paint('#2c5f6e', { rough: 0.3 }));
  far.rotation.x = -Math.PI / 2;
  far.position.y = y - 0.3;
  far.userData.noCast = true;
  scene.add(far);
  const rand = seeded(seed);
  const floaters: { g: THREE.Object3D; ph: number; base: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand() * 0.4;
    const r = 18 + rand() * 14;
    const rk = chunk(1, paint(lava ? '#2e211d' : rand() < 0.5 ? '#6f6a62' : '#7f786c', { facet: 0.18 }), 1 + rand() * 1.4, 0.7 + rand(), 1 + rand() * 1.4);
    rk.position.set(Math.cos(a) * r, y + 0.1, Math.sin(a) * r);
    rk.rotation.set(rand(), rand() * 3, rand());
    scene.add(rk);
  }
  if (lava) {
    const hot = [glow('#ffb347', 3), glow('#ff7b29', 2.6)];
    for (let i = 0; i < 16; i++) {
      const blob = chunk(0.5 + rand() * 0.8, hot[i % 2], 1, 0.35, 1);
      const a = rand() * Math.PI * 2;
      const r = 4 + rand() * 22;
      blob.position.set(Math.cos(a) * r, y + 0.25, Math.sin(a) * r);
      scene.add(blob);
      floaters.push({ g: blob, ph: rand() * 6, base: y + 0.25 });
    }
    addMotes(scene, 'brasa', 22, y, Math.abs(y) + 8);
  } else {
    for (let i = 0; i < 4; i++) {
      const boat = rowBoat(rand);
      const a = (i / 4) * Math.PI * 2 + 0.6;
      const r = 16 + rand() * 7;
      boat.position.set(Math.cos(a) * r, y + 0.2, Math.sin(a) * r);
      boat.rotation.y = rand() * 3;
      scene.add(boat);
      floaters.push({ g: boat, ph: rand() * 6, base: y + 0.2 });
    }
  }
  return (_dt, t) => {
    if (reduceMotion) return;
    for (const f of floaters) {
      f.g.position.y = f.base + Math.sin(t * (lava ? 2 : 1.2) + f.ph) * (lava ? 0.06 : 0.12);
      f.g.rotation.z = lava ? 0 : Math.sin(t * 0.9 + f.ph) * 0.06;
      if (lava) f.g.scale.y = 0.35 + Math.sin(t * 2 + f.ph) * 0.08;
    }
  };
}

function rowBoat(rand: () => number): THREE.Group {
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.35, 0.45, 7, 1, false, 0, Math.PI), paint('#6a4628'));
  hull.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  hull.scale.set(1, 2.6, 1);
  boat.add(hull);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.25), paint('#8a6a3a'));
  seat.position.y = 0.02;
  boat.add(seat);
  if (rand() < 0.6) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 5), paint('#4a3322'));
    mast.position.y = 0.8;
    boat.add(mast);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 3, 1, true), paint(rand() < 0.5 ? '#efe3c6' : '#a3242f', { side: THREE.DoubleSide }));
    sail.scale.z = 0.15;
    sail.position.set(0.15, 0.95, 0);
    boat.add(sail);
  }
  return boat;
}

/** Montanha de pedra com cume nevado (cone com vértices mexidos). */
function mountain(rand: () => number, h: number, r: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(r, h, 7, 3);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > h / 2 - 0.01) continue;
    const k = 1 + (rand() - 0.5) * 0.28;
    p.setXYZ(i, p.getX(i) * k, y + (rand() - 0.5) * h * 0.06, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, paint(rand() < 0.5 ? '#7b7684' : '#6f6b78', { facet: 0.2 })));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.36, h * 0.3, 7, 1), paint('#f1f2f4', { facet: 0.12 }));
  cap.position.y = h / 2 - h * 0.15 + 0.05;
  g.add(cap);
  g.userData.noCast = true;
  return g;
}

/** Montanhas com neve, floresta e nuvens ao fundo. */
export function addHorizon(scene: THREE.Scene, radius = 30, seed = 5): (dt: number, t: number) => void {
  const rand = seeded(seed);
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI / 2 + (i - 5) * 0.3 + (rand() - 0.5) * 0.12;
    const r = radius + 20 + rand() * 12;
    const h = 14 + rand() * 14;
    const m = mountain(rand, h, 7 + rand() * 5);
    m.position.set(Math.cos(a) * r, SEA_Y + h / 2 - 1.5, Math.sin(a) * r);
    m.rotation.y = rand() * 3;
    m.traverse(o => { o.userData.noCast = true; });
    scene.add(m);
  }
  for (let i = 0; i < 34; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 3.4;
    const r = radius + 5 + rand() * 9;
    const tree = pineTree(1 + rand() * 0.9, rand);
    tree.position.set(Math.cos(a) * r, SEA_Y + 0.4, Math.sin(a) * r);
    tree.traverse(o => { o.userData.noCast = true; });
    scene.add(tree);
  }
  const clouds: { g: THREE.Group; speed: number; a: number; r: number }[] = [];
  const cloudMat = paint('#f6f1e8', { facet: 0.1 });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const b = chunk(0.8 + rand() * 0.7, cloudMat, 1.2, 0.65, 1);
      b.position.set((k - (n - 1) / 2) * 1.15, rand() * 0.35, rand() * 0.6);
      b.rotation.y = rand() * 3;
      g.add(b);
    }
    const a = -Math.PI / 2 + (rand() - 0.5) * 3.2;
    const r = radius + 22 + rand() * 8;
    g.position.set(Math.cos(a) * r, 13 + rand() * 10, Math.sin(a) * r);
    g.scale.setScalar(2.6 + rand());
    g.traverse(o => { o.userData.noCast = true; });
    scene.add(g);
    clouds.push({ g, speed: 0.004 + rand() * 0.004, a, r });
  }
  return (_dt, t) => {
    if (reduceMotion) return;
    for (const c of clouds) {
      const a = c.a + t * c.speed;
      c.g.position.x = Math.cos(a) * c.r;
      c.g.position.z = Math.sin(a) * c.r;
    }
  };
}

/* ---------------- vegetação e construções ---------------- */

const PINE_LAYER = shared(new THREE.ConeGeometry(1, 1, 7));
const TRUNK = shared(new THREE.CylinderGeometry(1, 1, 1, 6));
const ROCK = shared(new THREE.DodecahedronGeometry(1, 0));
const BOX = shared(new THREE.BoxGeometry(1, 1, 1));
/** Telhado de duas águas: prisma triangular deitado no eixo x, cume para cima. */
const ROOF = shared(new THREE.CylinderGeometry(0.72, 0.72, 1.62, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2));

const PINES = ['#2f5230', '#36603a', '#28472b'];
const LEAVES = ['#4f6b35', '#5c7a3c', '#46612f'];

export function pineTree(scale = 1, rand: () => number = Math.random): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(TRUNK, paint('#5a3d24'));
  trunk.scale.set(0.12, 0.6, 0.12);
  trunk.position.y = 0.3;
  g.add(trunk);
  const base = Math.floor(rand() * PINES.length);
  [[0.78, 0.95, 0.85], [0.6, 0.85, 1.4], [0.42, 0.75, 1.92]].forEach(([r, h, y], i) => {
    const c = new THREE.Mesh(PINE_LAYER, paint(PINES[(base + i) % PINES.length], { facet: 0.14 }));
    c.scale.set(r, h, r);
    c.position.y = y;
    c.rotation.y = rand() * 3;
    g.add(c);
  });
  g.scale.setScalar(scale);
  g.rotation.z = (rand() - 0.5) * 0.06;
  return g;
}

export function oakTree(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(TRUNK, paint('#5a3d24'));
  trunk.scale.set(0.16, 1.1, 0.16);
  trunk.position.y = 0.55;
  g.add(trunk);
  [[0, 1.55, 0, 0.78, 0], [0.48, 1.35, 0.1, 0.52, 1], [-0.44, 1.4, -0.08, 0.55, 2], [0.05, 1.98, -0.05, 0.52, 1]].forEach(([x, y, z, r, c]) => {
    const b = chunk(r, paint(LEAVES[c], { facet: 0.16 }), 1, 0.88, 1);
    b.position.set(x, y, z);
    b.rotation.y = x * 3;
    g.add(b);
  });
  g.scale.setScalar(scale);
  return g;
}

export function rock(scale = 1, color = '#7d7468'): THREE.Mesh {
  const m = new THREE.Mesh(ROCK, paint(color, { facet: 0.2 }));
  m.scale.set(0.45 * scale, 0.32 * scale, 0.4 * scale);
  m.position.y = 0.12 * scale;
  m.rotation.set(0.3, 0, 0.2);
  return m;
}

export function bush(): THREE.Group {
  const g = new THREE.Group();
  [[0, 0.22, 0, 0.32, 0], [0.26, 0.18, 0.05, 0.24, 1], [-0.23, 0.18, -0.04, 0.26, 2]].forEach(([x, y, z, r, c]) => {
    const b = chunk(r, paint(LEAVES[c], { facet: 0.16 }), 1, 0.8, 1);
    b.position.set(x, y, z);
    g.add(b);
  });
  for (let i = 0; i < 3; i++) {
    const berry = ball(0.05, paint('#a3242f', { smooth: true }));
    berry.position.set(-0.15 + i * 0.15, 0.32 + (i % 2) * 0.06, 0.22);
    g.add(berry);
  }
  return g;
}

function block(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(w, h, d);
  return m;
}

/** Casinha de vila: enxaimel, telhado de duas águas, chaminé e janela acesa. */
export function house(wall = '#d9c9a3', roof = '#8a6a3a'): THREE.Group {
  const g = new THREE.Group();
  const beams = paint('#4a3322');
  const walls = block(1.4, 1, 1.1, paint(wall));
  walls.position.y = 0.5;
  g.add(walls);
  const base = block(1.5, 0.2, 1.2, paint('#7d766a', { facet: 0.15 }));
  base.position.y = 0.1;
  g.add(base);
  for (const x of [-0.7, 0, 0.7]) {
    const b = block(0.08, 1, 0.08, beams);
    b.position.set(x, 0.5, 0.56);
    g.add(b);
  }
  const mid = block(1.44, 0.07, 0.06, beams);
  mid.position.set(0, 0.62, 0.56);
  g.add(mid);
  // telhado de duas águas: prisma triangular
  const top = new THREE.Mesh(ROOF, paint(roof, { facet: 0.12 }));
  top.position.y = 1.36;
  g.add(top);
  const chimney = block(0.2, 0.55, 0.2, paint('#7d766a', { facet: 0.15 }));
  chimney.position.set(0.4, 1.6, -0.15);
  g.add(chimney);
  const door = block(0.32, 0.55, 0.05, beams);
  door.position.set(-0.3, 0.38, 0.57);
  g.add(door);
  const win = block(0.26, 0.22, 0.04, glow('#ffc36b', 1.6));
  win.position.set(0.32, 0.45, 0.57);
  g.add(win);
  return g;
}

/** Tenda do mercador: cone de gomos listrados, balcão e mercadorias. */
export function marketTent(color = '#8e2430'): THREE.Group {
  const g = new THREE.Group();
  const stripes = [paint(color), paint('#efe3c6')];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const seg = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.1, 2, 1, true, (i / n) * Math.PI * 2, (Math.PI * 2) / n), stripes[i % 2]);
    seg.position.y = 1.75;
    g.add(seg);
  }
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.2, 10, 1, true, -Math.PI * 0.75, Math.PI * 1.5), paint(color, { side: THREE.DoubleSide }));
  wall.position.y = 0.6;
  g.add(wall);
  const counter = block(1.2, 0.5, 0.4, paint('#6a4628'));
  counter.position.set(0, 0.25, 0.85);
  g.add(counter);
  const goods = ['#c9465a', '#e8c547', '#6f9a45', '#d98a3d'];
  for (let i = 0; i < 4; i++) {
    const fruit = chunk(0.1, paint(goods[i], { facet: 0.1 }));
    fruit.position.set(-0.4 + i * 0.27, 0.57, 0.85);
    g.add(fruit);
  }
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), metal('#c9a227'));
  flag.position.y = 2.42;
  g.add(flag);
  return g;
}

/** Mastro com estandarte (o pano tem o nome "cloth" e balança com `flicker`). */
export function bannerPole(color: string, height = 2.6): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(TRUNK, paint('#4a3322'));
  pole.scale.set(0.05, height, 0.05);
  pole.position.y = height / 2;
  g.add(pole);
  const clothGeo = new THREE.PlaneGeometry(0.7, 1.1, 3, 4);
  clothGeo.translate(0, -0.55, 0);
  // ponta em "V" embaixo
  const p = clothGeo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < -1.09) p.setY(i, -1.1 + (0.35 - Math.abs(p.getX(i))) * 0.6);
  const cloth = new THREE.Mesh(clothGeo, paint(color, { side: THREE.DoubleSide, facet: 0.12 }));
  cloth.position.set(0, height - 0.05, 0.06);
  cloth.name = 'cloth';
  g.add(cloth);
  const trim = block(0.76, 0.06, 0.05, metal('#c9a227'));
  trim.position.set(0, height - 0.05, 0.06);
  g.add(trim);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), metal('#c9a227'));
  tip.position.y = height + 0.1;
  g.add(tip);
  return g;
}

const GLOW_DISC = shared(new THREE.CircleGeometry(1, 24));
const glowDiscMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color('#ff9a3c').multiplyScalar(0.55) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 uColor; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(1.0 - d, 0.0), 2.0); gl_FragColor = vec4(uColor * a, a); }',
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

/** Tocha com chama brilhante (filhos "flame" e "pool" animados por `flicker`). */
export function torch(): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(TRUNK, paint('#4a3322'));
  post.scale.set(0.06, 1.5, 0.06);
  post.position.y = 0.75;
  g.add(post);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.08, 0.16, 7), metal('#5a5650', 0.5));
  bowl.position.y = 1.55;
  g.add(bowl);
  const flame = new THREE.Group();
  flame.name = 'flame';
  flame.position.y = 1.72;
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 5), glow('#ff7a2a', 3));
  outer.position.y = 0.1;
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 5), glow('#ffd36b', 4));
  inner.position.y = 0.05;
  flame.add(outer, inner);
  g.add(flame);
  const pool = new THREE.Mesh(GLOW_DISC, glowDiscMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.03;
  pool.scale.setScalar(1.8);
  pool.name = 'pool';
  g.add(pool);
  return g;
}

/** Placa de bifurcação. */
export function signpost(): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(TRUNK, paint('#5a3d24'));
  post.scale.set(0.06, 1.4, 0.06);
  post.position.y = 0.7;
  g.add(post);
  for (const [y, r] of [[1.15, 0.4], [0.85, -0.5]]) {
    const board = block(0.8, 0.2, 0.05, paint('#8a6a3a'));
    board.position.set(0, y, 0);
    board.rotation.y = r;
    g.add(board);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 3), paint('#8a6a3a'));
    tip.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
    tip.position.set(Math.cos(r) * 0.44, y, -Math.sin(r) * 0.44);
    g.add(tip);
  }
  return g;
}

/** Castelinho: torre de menagem, quatro torres, ameias, portão e bandeira. */
export function castle(): THREE.Group {
  const g = new THREE.Group();
  const stone = paint('#a39b8e', { facet: 0.12 });
  const dark = paint('#8a8378', { facet: 0.12 });
  const roofMat = paint('#2f5a8f', { facet: 0.14 });
  const keep = block(1.6, 1.8, 1.6, stone);
  keep.position.y = 0.9;
  g.add(keep);
  const plinth = block(1.75, 0.25, 1.75, dark);
  plinth.position.y = 0.12;
  g.add(plinth);
  for (const [x, z] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 2.4, 8), stone);
    tower.position.set(x, 1.2, z);
    g.add(tower);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.44, 0.18, 8), dark);
    ring.position.set(x, 2.45, z);
    g.add(ring);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.0, 8), roofMat);
    roof.position.set(x, 3.04, z);
    g.add(roof);
    const slit = block(0.08, 0.26, 0.05, paint('#2a2018'));
    const d = Math.hypot(x, z);
    slit.position.set(x + (x / d) * 0.4, 1.5, z + (z / d) * 0.4);
    slit.lookAt(x * 3, 1.5, z * 3);
    g.add(slit);
  }
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 4; i++) {
      const m = block(0.24, 0.24, 0.24, stone);
      const off = -0.55 + i * 0.37;
      const pos = [[off, 0.7], [off, -0.7], [0.7, off], [-0.7, off]][side];
      m.position.set(pos[0], 1.92, pos[1]);
      g.add(m);
    }
  }
  const gate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8, 1, false, 0, Math.PI), paint('#3a2616'));
  gate.rotation.x = Math.PI / 2;
  gate.position.set(0, 0.5, 0.81);
  g.add(gate);
  const door = block(0.6, 0.5, 0.06, paint('#3a2616'));
  door.position.set(0, 0.25, 0.81);
  g.add(door);
  const win = block(0.22, 0.3, 0.04, glow('#ffc36b', 1.5));
  win.position.set(0, 1.25, 0.81);
  g.add(win);
  const flag = bannerPole('#8e2430', 1.2);
  flag.position.set(0, 1.8, 0);
  g.add(flag);
  return g;
}

/* ---------------- objetos do jogo ---------------- */

/** Coroa dourada com pedras preciosas. */
export function makeCrown(): THREE.Group {
  const crown = new THREE.Group();
  const gold = metal('#e0b33a', 0.25);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.24, 10, 1, true), metal('#e0b33a', 0.25, THREE.DoubleSide));
  crown.add(band);
  const spike = new THREE.ConeGeometry(0.08, 0.24, 5);
  const gem = new THREE.OctahedronGeometry(0.06, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = new THREE.Mesh(spike, gold);
    sp.position.set(Math.cos(a) * 0.32, 0.22, Math.sin(a) * 0.32);
    crown.add(sp);
    const jw = new THREE.Mesh(gem, glow(i % 2 ? '#e0304a' : '#3f7fe0', 1.6));
    jw.position.set(Math.cos(a) * 0.335, 0, Math.sin(a) * 0.335);
    crown.add(jw);
    const tip = new THREE.Mesh(gem, metal('#f3e3a0', 0.2));
    tip.scale.setScalar(0.75);
    tip.position.set(Math.cos(a) * 0.32, 0.36, Math.sin(a) * 0.32);
    crown.add(tip);
  }
  return crown;
}

/** Barril de pólvora com pavio aceso (filho "spark"). */
export function makeBomb(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.28 * scale, 0.56 * scale, 10), paint('#7a5333', { facet: 0.14 }));
  g.add(barrel);
  const bulge = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.3 * scale, 0.24 * scale, 10), paint('#86603d', { facet: 0.14 }));
  g.add(bulge);
  for (const y of [-0.2, 0.2]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.29 * scale, 0.025 * scale, 4, 10), metal('#3a3a3a', 0.5));
    band.rotation.x = Math.PI / 2;
    band.position.y = y * scale;
    g.add(band);
  }
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 0.22 * scale, 5), paint('#2b1d12'));
  fuse.position.y = 0.38 * scale;
  g.add(fuse);
  const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.09 * scale, 0), glow('#ffcf6b', 4));
  spark.position.y = 0.5 * scale;
  spark.name = 'spark';
  g.add(spark);
  return g;
}

/** Bola de fogo do dragão (filho "spark" pisca). */
export function makeFireball(): THREE.Group {
  const g = new THREE.Group();
  const outer = chunk(0.42, glow('#e0521f', 2.4));
  g.add(outer);
  const inner = chunk(0.28, glow('#ffc04d', 3.4));
  inner.position.y = -0.05;
  inner.name = 'spark';
  g.add(inner);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 6), glow('#c0391b', 2, { opacity: 0.8 }));
  tail.position.y = 0.6;
  g.add(tail);
  return g;
}

/** Moeda de ouro. */
export function makeCoin(value = 1): THREE.Mesh {
  const r = value > 1 ? 0.42 : 0.32;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 10), metal(value > 1 ? '#f0d36b' : '#e0b33a', 0.22));
  m.rotation.x = Math.PI / 2;
  return m;
}

/** Sombra redonda no chão (onde algo vai cair). */
export function makeShadowMarker(color = '#22170e', r = 0.6): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Anima chamas das tochas, a luz no chão e os estandartes. */
export function flicker(scene: THREE.Object3D, t: number): void {
  if (reduceMotion) return;
  scene.traverse(o => {
    if (o.name === 'flame') {
      o.scale.set(1 + Math.sin(t * 17 + o.id) * 0.1, 1 + Math.sin(t * 13 + o.id) * 0.2, 1 + Math.sin(t * 15 + o.id) * 0.1);
      o.rotation.y = t * 2 + o.id;
    } else if (o.name === 'pool') {
      o.scale.setScalar(1.8 + Math.sin(t * 11 + o.id) * 0.12);
    } else if (o.name === 'cloth') {
      o.rotation.y = Math.sin(t * 1.6 + o.id) * 0.18;
    }
  });
}
