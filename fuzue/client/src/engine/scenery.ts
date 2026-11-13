import * as THREE from 'three';
import { seeded } from '@fuzue/shared';
import { isTouch, reduceMotion } from './Stage';
import { ball, canvasTexture, outline, shared, toon } from './materials';

/** Peças de cenário medieval reaproveitadas pelas telas. */

export function addLights(scene: THREE.Scene, size = 12, fog: { color: string; near: number; far: number } | null = { color: '#c9a77e', near: 40, far: 110 }): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight('#d7dde8', '#5a4a3a', 1.7));
  const sun = new THREE.DirectionalLight('#ffe2b8', 2.2);
  sun.position.set(8, 18, 9);
  sun.castShadow = true;
  const res = isTouch ? 1024 : 2048;
  sun.shadow.mapSize.set(res, res);
  const c = sun.shadow.camera;
  c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 1; c.far = 70;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  if (fog) scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
  return sun;
}

export const SEA_Y = -3;

/* ---------------- texturas ---------------- */

/** Pedras de calçamento irregulares. */
export function cobbleTexture(base = '#8c857a', light = '#a39b8e', dark = '#5f594f', seed = 3): THREE.CanvasTexture {
  const rand = seeded(seed);
  const tex = canvasTexture(256, 256, (g, w) => {
    g.fillStyle = dark;
    g.fillRect(0, 0, w, w);
    const n = 8;
    const cell = w / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const ox = (y % 2) * cell * 0.5;
        const px = x * cell + ox + 3 + rand() * 3;
        const py = y * cell + 3 + rand() * 3;
        g.fillStyle = rand() < 0.5 ? base : light;
        g.beginPath();
        g.roundRect?.(px - (px > w - cell ? w : 0), py, cell - 7 - rand() * 4, cell - 7 - rand() * 4, 8);
        g.fill();
      }
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Tábuas de madeira. */
export function planksTexture(base = '#7a5333', line = '#4a3322'): THREE.CanvasTexture {
  const tex = canvasTexture(256, 256, (g, w) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, w);
    g.strokeStyle = line;
    g.lineWidth = 4;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
    for (let i = 0; i < 4; i++) { const x = (i * 97) % w; g.beginPath(); g.moveTo(x, i * 64); g.lineTo(x, i * 64 + 64); g.stroke(); }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Grama com manchas. */
export function grassTexture(base = '#6f8f4e', spot = '#5f7d42', seed = 8): THREE.CanvasTexture {
  const rand = seeded(seed);
  const tex = canvasTexture(256, 256, (g, w) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, w);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = rand() < 0.5 ? spot : '#7d9c58';
      g.beginPath();
      g.ellipse(rand() * w, rand() * w, 6 + rand() * 18, 4 + rand() * 10, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Listras de pano (tendas, estandartes). */
export function clothStripes(a: string, b: string): THREE.CanvasTexture {
  const tex = canvasTexture(128, 64, (g, w, h) => {
    g.fillStyle = a;
    g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 16, h);
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/* ---------------- água, lava e horizonte ---------------- */

/** Lago escuro (ou lava) em volta, com pedras e barquinhos. Retorna a animação. */
export function addSea(scene: THREE.Scene, seed = 11, y = SEA_Y, kind: 'water' | 'lava' = 'water'): (dt: number, t: number) => void {
  const lava = kind === 'lava';
  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(170, 64),
    lava ? new THREE.MeshBasicMaterial({ color: '#d4541c' }) : toon('#35596b'),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = y;
  scene.add(surface);
  const rand = seeded(seed);
  const floaters: { g: THREE.Object3D; ph: number; base: number }[] = [];
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand() * 0.4;
    const r = 16 + rand() * 12;
    const rk = new THREE.Mesh(rockGeo, toon(lava ? '#3a2a24' : '#6f6a62'));
    rk.scale.set(1 + rand() * 1.5, 0.6 + rand(), 1 + rand() * 1.5);
    rk.position.set(Math.cos(a) * r, y + 0.2, Math.sin(a) * r);
    rk.rotation.y = rand() * 3;
    scene.add(rk);
  }
  if (lava) {
    for (let i = 0; i < 14; i++) {
      const blob = ball(0.5 + rand() * 0.8, new THREE.MeshBasicMaterial({ color: rand() < 0.5 ? '#ffb347' : '#ff7b29' }), 1, 0.35, 1);
      const a = rand() * Math.PI * 2;
      const r = 4 + rand() * 20;
      blob.position.set(Math.cos(a) * r, y + 0.05, Math.sin(a) * r);
      scene.add(blob);
      floaters.push({ g: blob, ph: rand() * 6, base: y + 0.05 });
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.35, 0.4, 8, 1, false, 0, Math.PI), toon('#6a4628'));
      hull.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      hull.scale.set(1, 2.6, 1);
      outline(hull, 1.05);
      boat.add(hull);
      const a = (i / 4) * Math.PI * 2 + 0.6;
      const r = 14 + rand() * 6;
      boat.position.set(Math.cos(a) * r, y + 0.15, Math.sin(a) * r);
      boat.rotation.y = rand() * 3;
      scene.add(boat);
      floaters.push({ g: boat, ph: rand() * 6, base: y + 0.15 });
    }
  }
  return (_dt, t) => {
    if (reduceMotion) return;
    for (const f of floaters) {
      f.g.position.y = f.base + Math.sin(t * (lava ? 2 : 1.2) + f.ph) * (lava ? 0.06 : 0.1);
      if (lava) f.g.scale.y = 0.35 + Math.sin(t * 2 + f.ph) * 0.08;
    }
  };
}

/** Montanhas com neve, floresta e nuvens ao fundo. */
export function addHorizon(scene: THREE.Scene, radius = 30, seed = 5): void {
  const rand = seeded(seed);
  const rockMat = toon('#7b7684');
  const snowMat = toon('#eef0f2');
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.33 + (rand() - 0.5) * 0.12;
    const r = radius + 18 + rand() * 10;
    const h = 14 + rand() * 12;
    const m = new THREE.Mesh(new THREE.ConeGeometry(7 + rand() * 4, h, 7), rockMat);
    m.position.set(Math.cos(a) * r, SEA_Y + h / 2 - 1, Math.sin(a) * r);
    m.rotation.y = rand() * 3;
    scene.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6 + rand(), h * 0.3, 7), snowMat);
    cap.position.set(m.position.x, SEA_Y + h - 1 - h * 0.15, m.position.z);
    cap.rotation.y = m.rotation.y;
    scene.add(cap);
  }
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 3.2;
    const r = radius + 4 + rand() * 8;
    const tree = pineTree(0.9 + rand() * 0.8);
    tree.position.set(Math.cos(a) * r, SEA_Y + 0.5, Math.sin(a) * r);
    scene.add(tree);
  }
  const cloudMat = toon('#e9e6e1');
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const b = ball(0.8 + rand() * 0.7, cloudMat, 1, 0.6, 1);
      b.position.set((k - (n - 1) / 2) * 1.1, rand() * 0.3, rand() * 0.6);
      g.add(b);
    }
    const a = -Math.PI / 2 + (rand() - 0.5) * 2.8;
    g.position.set(Math.cos(a) * (radius + 20), 12 + rand() * 9, Math.sin(a) * (radius + 20));
    g.scale.setScalar(3);
    scene.add(g);
  }
}

/* ---------------- vegetação e construções ---------------- */

const PINE_LAYER = shared(new THREE.ConeGeometry(1, 1, 8));
const TRUNK = shared(new THREE.CylinderGeometry(1, 1, 1, 8));
const ROCK = shared(new THREE.DodecahedronGeometry(1, 0));

export function pineTree(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(TRUNK, toon('#5a3d24'));
  trunk.scale.set(0.12, 0.6, 0.12);
  trunk.position.y = 0.3;
  g.add(trunk);
  const leaf = toon('#2f5230');
  [[0.75, 0.9, 0.85], [0.58, 0.8, 1.4], [0.4, 0.7, 1.9]].forEach(([r, h, y]) => {
    const c = new THREE.Mesh(PINE_LAYER, leaf);
    c.scale.set(r, h, r);
    c.position.y = y;
    c.castShadow = true;
    outline(c, 1.06);
    g.add(c);
  });
  g.scale.setScalar(scale);
  return g;
}

export function oakTree(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(TRUNK, toon('#5a3d24'));
  trunk.scale.set(0.16, 1.1, 0.16);
  trunk.position.y = 0.55;
  g.add(trunk);
  const leaf = toon('#4f6b35');
  [[0, 1.55, 0, 0.75], [0.45, 1.35, 0.1, 0.5], [-0.42, 1.4, -0.08, 0.52], [0.05, 1.95, -0.05, 0.5]].forEach(([x, y, z, r]) => {
    const b = ball(r, leaf, 1, 0.85, 1);
    b.position.set(x, y, z);
    b.castShadow = true;
    outline(b, 1.05);
    g.add(b);
  });
  g.scale.setScalar(scale);
  return g;
}

export function rock(scale = 1, color = '#7d7468'): THREE.Mesh {
  const m = new THREE.Mesh(ROCK, toon(color));
  m.scale.set(0.45 * scale, 0.32 * scale, 0.4 * scale);
  m.position.y = 0.12 * scale;
  m.castShadow = true;
  outline(m, 1.07);
  return m;
}

export function bush(): THREE.Group {
  const g = new THREE.Group();
  const m = toon('#4a6a33');
  [[0, 0.22, 0, 0.3], [0.25, 0.18, 0.05, 0.22], [-0.22, 0.18, -0.04, 0.24]].forEach(([x, y, z, r]) => {
    const b = ball(r, m, 1, 0.8, 1);
    b.position.set(x, y, z);
    outline(b, 1.06);
    g.add(b);
  });
  return g;
}

/** Casinha de vila com telhado de palha. */
export function house(wall = '#d9c9a3', roof = '#8a6a3a'): THREE.Group {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.1), toon(wall));
  walls.position.y = 0.5;
  walls.castShadow = true;
  outline(walls, 1.03);
  g.add(walls);
  const beams = toon('#4a3322');
  for (const x of [-0.7, 0.7]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1, 0.08), beams);
    b.position.set(x, 0.5, 0.56);
    g.add(b);
  }
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.85, 4), toon(roof));
  top.rotation.y = Math.PI / 4;
  top.scale.set(1.05, 1, 0.85);
  top.position.y = 1.42;
  top.castShadow = true;
  outline(top, 1.04);
  g.add(top);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.55, 0.05), beams);
  door.position.set(0, 0.28, 0.56);
  g.add(door);
  return g;
}

/** Tenda do mercador (cone listrado). */
export function marketTent(color = '#8e2430'): THREE.Group {
  const g = new THREE.Group();
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.1, 12), new THREE.MeshToonMaterial({ map: clothStripes(color, '#efe3c6') }));
  roof.position.y = 1.75;
  roof.castShadow = true;
  outline(roof, 1.04);
  g.add(roof);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.2, 12, 1, true, -Math.PI * 0.75, Math.PI * 1.5), new THREE.MeshToonMaterial({ color, side: THREE.DoubleSide }));
  wall.position.y = 0.6;
  g.add(wall);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.4), toon('#6a4628'));
  counter.position.set(0, 0.25, 0.85);
  outline(counter, 1.04);
  g.add(counter);
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), toon('#c9a227'));
  flag.position.y = 2.42;
  g.add(flag);
  return g;
}

/** Mastro com estandarte. */
export function bannerPole(color: string, height = 2.6): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(TRUNK, toon('#4a3322'));
  pole.scale.set(0.05, height, 0.05);
  pole.position.y = height / 2;
  g.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1, 1, 4), new THREE.MeshToonMaterial({ color, side: THREE.DoubleSide }));
  cloth.position.set(0, height - 0.6, 0.06);
  cloth.name = 'cloth';
  g.add(cloth);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.04), toon('#c9a227'));
  trim.position.set(0, height - 0.05, 0.06);
  g.add(trim);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), toon('#c9a227'));
  tip.position.y = height + 0.1;
  g.add(tip);
  return g;
}

/** Tocha com chama (anime o filho "flame"). */
export function torch(): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(TRUNK, toon('#4a3322'));
  post.scale.set(0.06, 1.5, 0.06);
  post.position.y = 0.75;
  g.add(post);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.16, 10), toon('#5a5650'));
  bowl.position.y = 1.55;
  g.add(bowl);
  const flame = ball(0.14, new THREE.MeshBasicMaterial({ color: '#ffb347' }), 1, 1.6, 1);
  flame.position.y = 1.75;
  flame.name = 'flame';
  g.add(flame);
  return g;
}

/** Placa de bifurcação. */
export function signpost(): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(TRUNK, toon('#5a3d24'));
  post.scale.set(0.06, 1.4, 0.06);
  post.position.y = 0.7;
  g.add(post);
  for (const [y, r] of [[1.15, 0.4], [0.85, -0.5]]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.05), toon('#8a6a3a'));
    board.position.set(0, y, 0);
    board.rotation.y = r;
    outline(board, 1.05);
    g.add(board);
  }
  return g;
}

/** Castelinho (torres, muralha e portão). */
export function castle(): THREE.Group {
  const g = new THREE.Group();
  const stone = new THREE.MeshToonMaterial({ map: cobbleTexture('#a39b8e', '#b5ad9f', '#6f685e', 5) });
  const roofMat = toon('#2f5a8f');
  const keep = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.6), stone);
  keep.position.y = 0.9;
  keep.castShadow = true;
  outline(keep, 1.03);
  g.add(keep);
  for (const [x, z] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 2.4, 10), stone);
    tower.position.set(x, 1.2, z);
    tower.castShadow = true;
    outline(tower, 1.04);
    g.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 10), roofMat);
    roof.position.set(x, 2.85, z);
    outline(roof, 1.05);
    g.add(roof);
  }
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.25, 0.28), stone);
    m.position.set(-0.55 + i * 0.37, 1.92, 0.68);
    g.add(m);
  }
  const gate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.05), toon('#3a2616'));
  gate.position.set(0, 0.38, 0.81);
  g.add(gate);
  const flag = bannerPole('#8e2430', 1.2);
  flag.position.set(0, 1.8, 0);
  g.add(flag);
  return g;
}

/* ---------------- objetos do jogo ---------------- */

/** Coroa dourada. */
export function makeCrown(): THREE.Group {
  const crown = new THREE.Group();
  const gold = toon('#d4af37');
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.3, 0.24, 10, 1, true),
    new THREE.MeshToonMaterial({ color: '#d4af37', side: THREE.DoubleSide }),
  );
  crown.add(band);
  const spike = new THREE.ConeGeometry(0.08, 0.24, 6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = new THREE.Mesh(spike, gold);
    sp.position.set(Math.cos(a) * 0.32, 0.22, Math.sin(a) * 0.32);
    crown.add(sp);
    const jw = ball(0.055, toon(i % 2 ? '#a3242f' : '#2f5a8f'));
    jw.position.set(Math.cos(a) * 0.335, 0, Math.sin(a) * 0.335);
    crown.add(jw);
    const tip = ball(0.045, toon('#f3e3a0'));
    tip.position.set(Math.cos(a) * 0.32, 0.36, Math.sin(a) * 0.32);
    crown.add(tip);
  }
  return crown;
}

/** Barril de pólvora com pavio aceso (filho "spark"). */
export function makeBomb(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.28 * scale, 0.56 * scale, 14), new THREE.MeshToonMaterial({ map: planksTexture('#7a5333', '#4a3322') }));
  barrel.scale.set(1, 1, 1);
  barrel.castShadow = true;
  outline(barrel, 1.07);
  g.add(barrel);
  for (const y of [-0.17, 0.17]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.29 * scale, 0.025 * scale, 6, 20), toon('#3a3a3a'));
    band.rotation.x = Math.PI / 2;
    band.position.y = y * scale;
    g.add(band);
  }
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 0.22 * scale, 6), toon('#2b1d12'));
  fuse.position.y = 0.38 * scale;
  g.add(fuse);
  const spark = ball(0.08 * scale, new THREE.MeshBasicMaterial({ color: '#ffb347' }));
  spark.position.y = 0.5 * scale;
  spark.name = 'spark';
  g.add(spark);
  return g;
}

/** Bola de fogo do dragão (filho "spark" pisca). */
export function makeFireball(): THREE.Group {
  const g = new THREE.Group();
  const outer = ball(0.42, new THREE.MeshBasicMaterial({ color: '#e0521f' }));
  g.add(outer);
  const inner = ball(0.28, new THREE.MeshBasicMaterial({ color: '#ffc04d' }));
  inner.position.y = -0.05;
  inner.name = 'spark';
  g.add(inner);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 10), new THREE.MeshBasicMaterial({ color: '#c0391b', transparent: true, opacity: 0.75 }));
  tail.position.y = 0.6;
  g.add(tail);
  return g;
}

/** Moeda de ouro. */
export function makeCoin(value = 1): THREE.Mesh {
  const r = value > 1 ? 0.42 : 0.32;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 20), toon(value > 1 ? '#f0d36b' : '#d4af37'));
  m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  outline(m, 1.08);
  return m;
}

/** Sombra redonda no chão (onde algo vai cair). */
export function makeShadowMarker(color = '#22170e', r = 0.6): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Anima chamas de tochas e faíscas (filhos "flame"/"spark") da cena. */
export function flicker(scene: THREE.Object3D, t: number): void {
  scene.traverse(o => {
    if (o.name === 'flame') o.scale.set(0.14 * (1 + Math.sin(t * 17 + o.id) * 0.12), 0.22 * (1 + Math.sin(t * 13 + o.id) * 0.18), 0.14);
  });
}
