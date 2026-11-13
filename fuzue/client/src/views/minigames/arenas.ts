import * as THREE from 'three';
import {
  BARDO, BARDO_COLORS, BARDO_GONE, CERCO, CHARACTERS, COLHEITA, COROA, ESTANDARTE, FLECHAS, JAVALI, LADEIRA, LAVA,
  LAVA_COLUMNS, MACHADOS, MOINHO, PASTOREIO, POTES, SOCCER, TEAMS, TINTA, TRONO,
  gridCenter, gridHalf, seeded, type Grid, type MinigameId,
} from '@fuzue/shared';
import { animateCritter, makeCritter } from '../../engine/critter';
import { canvasTexture, chunk, glow, liquid, metal, paint } from '../../engine/materials';
import { addMotes, bannerPole, marketTent, rock, scatterGrass, torch } from '../../engine/scenery';
import type { Env } from './envs';
import { fence, grassIsland, GROUT, ringFence, roundYard, tower, WOOD } from './props';

/** Arenas dos minijogos novos. */

type Builder = (scene: THREE.Scene) => Env;
const still = () => {};

/* ---------------- Coroa Roubada ---------------- */
function coroa(scene: THREE.Scene): Env {
  roundYard(scene, COROA.radius, '#7d7468', 21);
  // tapete real no meio
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.04, 20), paint('#8e2430', { facet: 0.05 }));
  rug.position.y = 0.07;
  rug.userData.noCast = true;
  scene.add(rug);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.08, 4, 32), metal('#e0b33a', 0.3));
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.09;
  scene.add(trim);
  for (const [x, z] of [[-COROA.radius - 2, -3], [COROA.radius + 2, -3], [0, -COROA.radius - 2.5]]) {
    const t = tower(4.5, 1.1, '#2f5a8f');
    t.position.set(x, -0.2, z);
    scene.add(t);
  }
  addMotes(scene, 'poeira', COROA.radius, 0, 6);
  return { size: COROA.radius, update: still };
}

/* ---------------- Trono Disputado ---------------- */
function trono(scene: THREE.Scene): Env {
  roundYard(scene, TRONO.radius, '#6f685e', 22);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const t = tower(5, 1.15, i % 2 ? '#8e2430' : '#2f5a8f');
    t.position.set(Math.cos(a) * (TRONO.radius + 2.6), -0.3, Math.sin(a) * (TRONO.radius + 2.6));
    scene.add(t);
  }
  addMotes(scene, 'poeira', TRONO.radius, 0, 6);
  return { size: TRONO.radius, update: still };
}

/* ---------------- Quebra-Potes ---------------- */
function potes(scene: THREE.Scene): Env {
  roundYard(scene, POTES.radius, '#7d7468', 23);
  // barracas do mercado em volta
  const colors = ['#8e2430', '#2f5a8f', '#3f6b3a'];
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.7;
    const tent = marketTent(colors[i]);
    tent.position.set(Math.cos(a) * (POTES.radius + 2.6), 0, Math.sin(a) * (POTES.radius + 2.6));
    tent.lookAt(0, 0, 0);
    scene.add(tent);
  }
  const crate = paint(WOOD, { facet: 0.16 });
  const rand = seeded(8);
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), crate);
    box.position.set(Math.cos(a) * (POTES.radius + 1.6), 0.4, Math.sin(a) * (POTES.radius + 1.6));
    box.rotation.y = rand() * 3;
    scene.add(box);
  }
  return { size: POTES.radius, update: still };
}

/* ---------------- Colheita ---------------- */
function colheita(scene: THREE.Scene): Env {
  const R = COLHEITA.radius;
  grassIsland(scene, R + 3.6, 4, '#6a8f3e');
  // canteiros de terra arada
  const soil = paint('#6b4a2f', { facet: 0.2 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    for (let k = 0; k < 3; k++) {
      const row = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.45), soil);
      row.position.set(Math.cos(a) * 7.5 + Math.cos(a + Math.PI / 2) * (k - 1) * 0.7, 0.05, Math.sin(a) * 7.5 + Math.sin(a + Math.PI / 2) * (k - 1) * 0.7);
      row.rotation.y = -a;
      row.userData.noCast = true;
      scene.add(row);
    }
  }
  ringFence(scene, R + 0.2, 22);
  // carroça no meio
  const cart = new THREE.Group();
  const wood = paint(WOOD, { facet: 0.16 });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.6), wood);
  bed.position.y = 0.75;
  cart.add(bed);
  for (const [x, z] of [[-0.8, 0.85], [0.8, 0.85], [-0.8, -0.85], [0.8, -0.85]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 8), paint('#4a3322'));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.5, z);
    cart.add(wheel);
  }
  const hay = chunk(0.9, paint('#d9b45a', { facet: 0.22 }), 1.2, 0.5, 0.9);
  hay.position.y = 1.15;
  cart.add(hay);
  for (let i = 0; i < 3; i++) {
    const p = chunk(0.3, paint('#d9741f', { facet: 0.18 }), 1.15, 0.8, 1.15);
    p.position.set(-0.6 + i * 0.6, 1.5, (i % 2) * 0.3 - 0.15);
    cart.add(p);
  }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), wood);
  handle.position.set(1.8, 0.6, 0);
  cart.add(handle);
  scene.add(cart);
  // espantalho e montes de feno
  const crow = makeCritter(5);
  crow.root.position.set(-R - 1.7, 0, -3);
  crow.root.scale.setScalar(1.2);
  crow.root.lookAt(0, 0, 0);
  scene.add(crow.root);
  for (const [x, z] of [[R + 1.9, 2], [R + 1.5, -4.5], [-R - 1.6, 4], [3, R + 1.8]]) {
    const bale = chunk(0.8, paint('#d9b45a', { facet: 0.22 }), 1.3, 0.8, 1);
    bale.position.set(x, 0.5, z);
    scene.add(bale);
  }
  scatterGrass(scene, 380, { radius: R + 3.3 }, (x, z) => Math.hypot(x, z) > 2.8, 61);
  addMotes(scene, 'poeira', R, 0, 5);
  return {
    size: R,
    update: (_dt, t) => animateCritter(crow, t, { speed: 0, punching: false, stunned: false, falling: false, waving: true }),
  };
}

/* ---------------- Moinho Maluco ---------------- */
function moinho(scene: THREE.Scene): Env {
  const R = MOINHO.radius;
  // tablado de madeira redondo sobre o rio
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.4, 20), paint('#8a6a3a', { facet: 0.1 }));
  deck.position.y = -0.2;
  scene.add(deck);
  for (let i = 1; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry((R * i) / 4, 0.04, 3, 32), paint('#5a3d24'));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    ring.userData.noCast = true;
    scene.add(ring);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 3.4, 6), paint('#5a3d24'));
    post.position.set(Math.cos(a) * (R - 0.4), -1.9, Math.sin(a) * (R - 0.4));
    scene.add(post);
  }
  // torre do moinho no eixo (fina embaixo, onde a pá passa)
  const stone = paint('#c9bda5', { facet: 0.12 });
  const towerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, MOINHO.hubR, 7.4, 8), stone);
  towerMesh.position.y = 3.7;
  scene.add(towerMesh);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.4, 8), paint('#8e2430', { facet: 0.14 }));
  roof.position.y = 8.1;
  scene.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.08), paint('#3a2616'));
  door.position.set(0, 1.0, 0.7);
  scene.add(door);
  return { size: R, update: still };
}

/* ---------------- Chuva de Flechas ---------------- */
function flechas(scene: THREE.Scene): Env {
  roundYard(scene, FLECHAS.radius, '#6f685e', 24);
  // torres com arqueiros mirando o pátio
  const archers: ReturnType<typeof makeCritter>[] = [];
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 1.1;
    const x = Math.cos(a) * (FLECHAS.radius + 3);
    const z = Math.sin(a) * (FLECHAS.radius + 3);
    const t = tower(4.2, 1.2);
    t.position.set(x, -0.3, z);
    scene.add(t);
    const archer = makeCritter(2);
    archer.root.position.set(x, 3.9, z);
    archer.root.rotation.y = Math.atan2(-x, -z);
    scene.add(archer.root);
    archers.push(archer);
  }
  return {
    size: FLECHAS.radius,
    update: (_dt, t) => archers.forEach(a => animateCritter(a, t, { speed: 0, punching: Math.sin(t * 3 + a.phase) > 0.7, stunned: false, falling: false })),
  };
}

/* ---------------- Fúria do Javali ---------------- */
function javali(scene: THREE.Scene): Env {
  const R = JAVALI.radius;
  grassIsland(scene, R, 3.5, '#5f8a3c');
  const rand = seeded(31);
  for (let i = 0; i < 5; i++) {
    const mud = new THREE.Mesh(new THREE.CircleGeometry(0.7 + rand() * 0.6, 8), paint('#5a4030', { facet: 0.05 }));
    mud.rotation.x = -Math.PI / 2;
    const a = rand() * Math.PI * 2;
    const r = 2 + rand() * (R - 4);
    mud.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    mud.userData.noCast = true;
    scene.add(mud);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.2;
    const r = rock(1 + rand(), '#7d7468');
    r.position.set(Math.cos(a) * (R + 0.4), -0.3, Math.sin(a) * (R + 0.4));
    scene.add(r);
  }
  scatterGrass(scene, 380, { radius: R - 0.3 }, () => true, 71);
  addMotes(scene, 'poeira', R, 0, 5);
  return { size: R, update: still };
}

/* ---------------- grades de pisos (Cerco, Bardo, Tinta) ---------------- */

interface Tiles { meshes: THREE.Mesh[]; base: number[]; fall: number[] }

function tileGrid(scene: THREE.Scene, g: Grid, mat: THREE.Material, height = 0.6, gap = 0.08): Tiles {
  const geo = new THREE.BoxGeometry(g.cell - gap, height, g.cell - gap);
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < g.n * g.n; i++) {
    const c = gridCenter(g, i);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(c.x, -height / 2, c.z);
    m.userData.noCast = true;
    scene.add(m);
    meshes.push(m);
  }
  return { meshes, base: meshes.map(m => m.position.y), fall: meshes.map(() => 0) };
}

/** Anima pisos que somem (caem) e voltam (sobem). */
function animateTile(tiles: Tiles, i: number, gone: boolean, dt: number): void {
  const m = tiles.meshes[i];
  if (gone) {
    tiles.fall[i] = Math.min(1.2, tiles.fall[i] + dt);
    const f = tiles.fall[i];
    m.position.y = tiles.base[i] - f * f * 9;
    m.visible = f < 1.1;
  } else if (tiles.fall[i] > 0) {
    tiles.fall[i] = Math.max(0, tiles.fall[i] - dt * 2.5);
    m.visible = true;
    m.position.y = tiles.base[i] - tiles.fall[i] * 3;
  }
}

/** Muralha em volta de uma grade quadrada, com torres nos cantos. */
function gridWalls(scene: THREE.Scene, half: number): void {
  const stone = paint('#9a9286', { facet: 0.14 });
  for (let side = 0; side < 4; side++) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 1.2, 1.1, 0.5), stone);
    const off = half + 0.45;
    const pos = [[0, -off], [0, off], [-off, 0], [off, 0]][side];
    wall.position.set(pos[0], 0.1, pos[1]);
    if (side >= 2) wall.rotation.y = Math.PI / 2;
    scene.add(wall);
    const base = wall.clone();
    base.scale.set(1, 7, 1);
    base.position.y = -3.8;
    scene.add(base);
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const t = tower(2.6, 1.1, '#8e2430');
    t.position.set(x * (half + 0.6), -0.4, z * (half + 0.6));
    scene.add(t);
  }
}

/* ---------------- Cerco ao Castelo ---------------- */
function cerco(scene: THREE.Scene): Env {
  const half = gridHalf(CERCO);
  const okMat = paint('#a39b8e', { facet: 0.16 });
  const aimed = new THREE.MeshStandardMaterial({ color: '#c9a397', emissive: '#c0391b', emissiveIntensity: 0.8, roughness: 0.8, flatShading: true });
  const tiles = tileGrid(scene, CERCO, okMat, 0.7, 0.1);
  gridWalls(scene, half);
  // catapultas do lado de fora
  const wood = paint(WOOD, { facet: 0.16 });
  const arms: THREE.Group[] = [];
  for (const [x, z] of [[0, -half - 6], [-half - 6, 2], [half + 6, -2]]) {
    const cat = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.4), wood);
    base.position.y = 0.4;
    cat.add(base);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.2), wood);
      post.position.set(0, 1.2, s * 0.5);
      cat.add(post);
    }
    const arm = new THREE.Group();
    arm.position.y = 1.8;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.16), wood);
    beam.position.x = 1.0;
    const cup = chunk(0.3, paint('#5a5650'), 1, 0.6, 1);
    cup.position.x = 2.2;
    arm.add(beam, cup);
    cat.add(arm);
    arms.push(arm);
    cat.position.set(x, -0.4, z);
    cat.lookAt(0, -0.4, 0);
    cat.rotation.y += Math.PI / 2;
    scene.add(cat);
  }
  return {
    size: half,
    update: (dt, t, mg) => {
      arms.forEach((a, i) => { a.rotation.z = Math.max(0, Math.sin(t * 2.2 + i * 2)) * 1.2 - 0.3; });
      if (!mg) return;
      for (let i = 0; i < tiles.meshes.length; i++) {
        const v = mg.tiles[i] ?? 0;
        tiles.meshes[i].material = v === 1 ? aimed : okMat;
        if (v === 1) aimed.emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 9)) * 0.9;
        animateTile(tiles, i, v === 2, dt);
      }
    },
  };
}

/* ---------------- O Bardo Manda ---------------- */
function bardo(scene: THREE.Scene): Env {
  const half = gridHalf(BARDO);
  const mats = BARDO_COLORS.map(c => paint(c, { facet: 0.1, rough: 0.6 }));
  // a cor cantada brilha
  const lit = BARDO_COLORS.map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.5, flatShading: true }));
  const tiles = tileGrid(scene, BARDO, mats[0], 0.6, 0.12);
  gridWalls(scene, half);
  for (const x of [-half - 2, half + 2]) {
    const t = torch();
    t.position.set(x, 0, -half + 1);
    scene.add(t);
  }
  addMotes(scene, 'vagalume', half + 2, 0, 5);
  return {
    size: half + 1,
    update: (dt, t, mg) => {
      if (!mg) return;
      let called = -1;
      let calling = false;
      mg.entities.forEach(e => { if (e.kind === 'bard') { called = Math.round(e.s); calling = e.a >= 0; } });
      const pulse = 0.35 + Math.abs(Math.sin(t * 6)) * 0.8;
      lit.forEach(m => { m.emissiveIntensity = pulse; });
      for (let i = 0; i < tiles.meshes.length; i++) {
        const v = mg.tiles[i] ?? 0;
        const color = v % BARDO_GONE;
        tiles.meshes[i].material = calling && color === called ? lit[color] : mats[color];
        animateTile(tiles, i, v >= BARDO_GONE, dt);
      }
    },
  };
}

/* ---------------- Tinta do Reino ---------------- */
function tinta(scene: THREE.Scene): Env {
  const half = gridHalf(TINTA);
  const blank = paint('#e9dfc8', { facet: 0.06 });
  const tiles = tileGrid(scene, TINTA, blank, 0.4, 0.06);
  const base = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.6, 2, half * 2 + 0.6), paint(GROUT));
  base.position.y = -1.2;
  scene.add(base);
  fence(scene, -half - 0.3, -half - 0.3, half + 0.3, -half - 0.3);
  fence(scene, -half - 0.3, half + 0.3, half + 0.3, half + 0.3);
  fence(scene, -half - 0.3, -half - 0.3, -half - 0.3, half + 0.3);
  fence(scene, half + 0.3, -half - 0.3, half + 0.3, half + 0.3);
  grassIsland(scene, half * 1.6, 3, '#5f8a3c', -0.15);
  scatterGrass(scene, 260, { radius: half * 1.55 }, (x, z) => Math.abs(x) > half + 0.6 || Math.abs(z) > half + 0.6, 81, -0.15);
  // potes de tinta decorando os cantos
  BARDO_COLORS.forEach((c, i) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.5, 8), paint(WOOD));
    const sx = i % 2 ? 1 : -1;
    const sz = i < 2 ? 1 : -1;
    pot.position.set(sx * (half + 1.3), 0.25, sz * (half + 1.3));
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.3, 8), glow(c, 1.2));
    top.rotation.x = -Math.PI / 2;
    top.position.set(pot.position.x, 0.51, pot.position.z);
    scene.add(pot, top);
  });
  const colorOf = new Map<number, THREE.Material>();
  return {
    size: half,
    update: (_dt, _t, mg, s) => {
      if (!mg || !s) return;
      // dono do piso = índice do jogador + 1 (vem em mg.players[].team)
      colorOf.clear();
      mg.players.forEach((p, id) => {
        const ch = s.players.get(id)?.character ?? 0;
        colorOf.set(p.team + 1, paint(CHARACTERS[ch]?.color ?? '#888888', { facet: 0.08, rough: 0.6 }));
      });
      for (let i = 0; i < tiles.meshes.length; i++) {
        const v = mg.tiles[i] ?? 0;
        tiles.meshes[i].material = v ? colorOf.get(v) ?? blank : blank;
      }
    },
  };
}

/* ---------------- Maré de Lava ---------------- */
function lava(scene: THREE.Scene): Env {
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(LAVA.floorR, LAVA.floorR + 1.5, 4, 18), paint('#4a4040', { facet: 0.2 }));
  floor.position.y = -2;
  scene.add(floor);
  const rockMats = ['#6f6560', '#7d7468', '#8a8378'].map(c => paint(c, { facet: 0.2 }));
  LAVA_COLUMNS.forEach((c, i) => {
    const h = c.h + 3;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r * 1.08, h, 7), rockMats[i % 3]);
    col.position.set(c.x, c.h - h / 2, c.z);
    col.rotation.y = i;
    scene.add(col);
    // borda queimada no topo
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 1.02, c.r, 0.12, 7), paint('#3a3230', { facet: 0.2 }));
    cap.position.set(c.x, c.h - 0.06, c.z);
    cap.rotation.y = i;
    scene.add(cap);
  });
  const top = LAVA_COLUMNS[LAVA_COLUMNS.length - 1];
  const flag = bannerPole('#c9a227', 2.6);
  flag.position.set(top.x + 1.2, top.h, top.z - 1.2);
  scene.add(flag);
  // a lava que sobe
  const geo = new THREE.PlaneGeometry(200, 200, 80, 80);
  geo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(geo, liquid('lava'));
  sea.userData.noCast = true;
  sea.position.y = LAVA.start;
  scene.add(sea);
  const embers = addMotes(scene, 'brasa', 14, LAVA.start, 10);
  return {
    size: 9,
    update: (dt, _t, mg) => {
      const want = mg && mg.radius ? mg.radius : LAVA.start;
      sea.position.y += (want - sea.position.y) * Math.min(1, dt * 4);
      embers.position.y = sea.position.y;
    },
  };
}

/* ---------------- Ladeira dos Barris ---------------- */
function ladeira(scene: THREE.Scene): Env {
  const W = LADEIRA.halfWidth;
  const grass = paint('#6a8f3e', { facet: 0.08 });
  const dirt = paint('#6b4a2f', { facet: 0.16 });
  for (const [z0, z1, h0, h1] of LADEIRA.profile) {
    const len = z0 - z1;
    const rise = h1 - h0;
    const slopeLen = Math.hypot(len, rise);
    const angle = Math.atan2(rise, len);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.2, 0.5, slopeLen + 0.05), [dirt, dirt, grass, dirt, dirt, dirt]);
    deck.position.set(0, (h0 + h1) / 2 - 0.25 * Math.cos(angle), (z0 + z1) / 2);
    deck.rotation.x = angle;
    deck.userData.noCast = true;
    scene.add(deck);
    // aterro de pedra por baixo
    const fill = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.6, 1, len), paint('#8a8378', { facet: 0.16 }));
    const low = Math.min(h0, h1) - 0.35;
    fill.scale.y = low + 3.5;
    fill.position.set(0, (low - 3.5) / 2, (z0 + z1) / 2);
    scene.add(fill);
    // cercas nas laterais, seguindo a subida
    for (const sx of [-1, 1]) fence(scene, sx * (W + 0.1), z0, sx * (W + 0.1), z1, h0, WOOD, h1);
  }
  // boca de onde saem os barris, no topo
  const gate = new THREE.Group();
  const stone = paint('#a39b8e', { facet: 0.12 });
  for (const sx of [-1, 1]) {
    const t = tower(4.5, 1, '#8e2430');
    t.position.set(sx * (W + 1.2), 11, -63);
    gate.add(t);
  }
  const arch = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 1.2, 1.2, 1.4), stone);
  arch.position.set(0, 14.6, -63);
  gate.add(arch);
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 3.6, 0.3), paint('#1e1714'));
  tunnel.position.set(0, 12.8, -64.4);
  gate.add(tunnel);
  scene.add(gate);
  const finish = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.06, 0.7), metal('#e0b33a', 0.3));
  finish.position.set(0, 11.04, LADEIRA.finishZ);
  scene.add(finish);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.4, 0.7), new THREE.MeshBasicMaterial({
    map: canvasTexture(512, 128, (g, w, h) => {
      g.fillStyle = '#efe3c6'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8e2430'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
      g.font = '700 70px "Cinzel","Times New Roman",serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#22170e';
      g.fillText('CHEGADA', w / 2, h / 2 + 4);
    }),
  }));
  sign.position.set(0, 14.6, -62.28);
  scene.add(sign);
  for (const sx of [-1, 1]) {
    const b = bannerPole(sx < 0 ? '#8e2430' : '#2f5a8f', 3);
    b.position.set(sx * (W + 0.6), 11, LADEIRA.finishZ);
    scene.add(b);
  }
  addMotes(scene, 'poeira', 8, 0, 14).position.z = -30;
  return { size: 12, update: still };
}

/* ---------------- Corredor dos Machados ---------------- */
function machados(scene: THREE.Scene): Env {
  const W = MACHADOS.halfWidth;
  const plank = paint('#8a6a3a', { facet: 0.12 });
  const dark = paint('#5a3d24', { facet: 0.14 });
  for (const f of MACHADOS.floors) {
    const len = f.z1 - f.z0;
    const zc = (f.z0 + f.z1) / 2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.4, len), plank);
    deck.position.set(0, -0.2, zc);
    deck.userData.noCast = true;
    scene.add(deck);
    for (let z = f.z0 + 0.6; z < f.z1; z += 1.2) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.02, 0.02, 0.06), dark);
      line.position.set(0, 0.005, z);
      line.userData.noCast = true;
      scene.add(line);
    }
    // vigas e pilares lá embaixo
    for (const sx of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, len), dark);
      beam.position.set(sx * (W - 0.12), -0.5, zc);
      scene.add(beam);
    }
    for (let z = f.z0 + 1.5; z < f.z1 - 1; z += 5) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 9, 6), dark);
      post.position.set(0, -4.9, z);
      scene.add(post);
    }
  }
  // pórticos dos machados
  for (const a of MACHADOS.axes) {
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.2, 0.3), dark);
      post.position.set(sx * 3.4, 2.9, a.z);
      scene.add(post);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 0.4), dark);
    top.position.set(0, 5.4, a.z);
    scene.add(top);
    for (const sx of [-1, 1]) {
      const under = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), dark);
      under.position.set(sx * 3.4, -4.3, a.z);
      scene.add(under);
    }
  }
  // paredões do desfiladeiro dos dois lados
  const rand = seeded(91);
  for (let z = 6; z > -76; z -= 4) {
    for (const sx of [-1, 1]) {
      const cliff = chunk(3 + rand() * 1.5, paint(rand() < 0.5 ? '#7d7468' : '#8a8378', { facet: 0.22 }), 1, 2.4 + rand(), 1.2);
      cliff.position.set(sx * (11 + rand() * 2), -3 + rand() * 2, z);
      cliff.userData.noCast = true;
      scene.add(cliff);
    }
  }
  const finish = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.04, 0.6), metal('#e0b33a', 0.3));
  finish.position.set(0, 0.03, MACHADOS.finishZ);
  scene.add(finish);
  for (const sx of [-1, 1]) {
    const t = tower(4.5, 1, '#2f5a8f');
    t.position.set(sx * (W + 1.4), -0.5, MACHADOS.finishZ - 1.5);
    scene.add(t);
    const tc = torch();
    tc.position.set(sx * (W - 0.3), 0, MACHADOS.finishZ + 0.8);
    scene.add(tc);
  }
  return { size: 12, update: still };
}

/* ---------------- campos 2v2 ---------------- */

function field(scene: THREE.Scene, pens: boolean): void {
  const { halfX, halfZ } = SOCCER;
  const side = paint('#5a4a32', { facet: 0.14 });
  const fw = halfX * 2 + 1.4;
  const fd = halfZ * 2 + 1.4;
  const ground = new THREE.Mesh(new THREE.BoxGeometry(fw, 1, fd), [side, side, paint('#5f8a3c', { facet: 0.06 }), side, side, side]);
  ground.position.y = -0.5;
  ground.userData.noCast = true;
  scene.add(ground);
  const stripe = paint('#6a9844', { facet: 0.06 });
  for (let i = 0; i < 8; i += 2) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry((halfX * 2) / 8, halfZ * 2), stripe);
    m.rotation.x = -Math.PI / 2;
    m.position.set(-halfX + ((i + 0.5) * halfX * 2) / 8, 0.005, 0);
    m.userData.noCast = true;
    scene.add(m);
  }
  const around = new THREE.Mesh(new THREE.CylinderGeometry(halfX + 9, halfX + 9.5, 1, 20), paint('#567f37', { facet: 0.1 }));
  around.position.y = -0.52;
  around.userData.noCast = true;
  scene.add(around);
  scatterGrass(scene, 380, { radius: halfX + 8.5 }, (x, z) => Math.abs(x) > halfX + (pens ? PASTOREIO.penDepth + 0.6 : 0.8) || Math.abs(z) > halfZ + 0.9, 45, -0.02);
  // cercas laterais e do fundo (no Pastoreio, abertas onde ficam os currais)
  fence(scene, -halfX - 0.5, -halfZ - 0.5, halfX + 0.5, -halfZ - 0.5);
  fence(scene, -halfX - 0.5, halfZ + 0.5, halfX + 0.5, halfZ + 0.5);
  const mouth = pens ? PASTOREIO.penHalf : 0;
  for (const sx of [-1, 1]) {
    const x = sx * (halfX + 0.5);
    if (mouth > 0) {
      fence(scene, x, -halfZ - 0.5, x, -mouth);
      fence(scene, x, mouth, x, halfZ + 0.5);
    } else {
      fence(scene, x, -halfZ - 0.5, x, halfZ + 0.5);
    }
  }
}

/* ---------------- Pastoreio ---------------- */
function pastoreio(scene: THREE.Scene): Env {
  field(scene, true);
  const { halfX } = SOCCER;
  const { penHalf, penDepth } = PASTOREIO;
  for (const sx of [-1, 1]) {
    const team = sx < 0 ? 0 : 1;
    const color = TEAMS.colors[team];
    const x0 = sx * (halfX + 0.5);
    const x1 = sx * (halfX + penDepth + 0.6);
    fence(scene, x0, -penHalf, x1, -penHalf, 0, '#5a3d24');
    fence(scene, x0, penHalf, x1, penHalf, 0, '#5a3d24');
    fence(scene, x1, -penHalf, x1, penHalf, 0, '#5a3d24');
    const floor = new THREE.Mesh(new THREE.BoxGeometry(penDepth + 1, 0.1, penHalf * 2), paint('#c9a65a', { facet: 0.2 }));
    floor.position.set((x0 + x1) / 2, 0.02, 0);
    floor.userData.noCast = true;
    scene.add(floor);
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.25, penHalf * 2), glow(color, 1.4, { opacity: 0.9 }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(sx * halfX, 0.03, 0);
    mark.userData.noCast = true;
    scene.add(mark);
    for (const sz of [-1, 1]) {
      const b = bannerPole(color, 3.2);
      b.position.set(x1, 0, sz * (penHalf + 0.6));
      b.rotation.y = sx * Math.PI / 2;
      scene.add(b);
    }
    const bale = chunk(0.6, paint('#d9b45a', { facet: 0.22 }), 1.3, 0.8, 1);
    bale.position.set(x1 - sx * 0.8, 0.4, penHalf - 0.8);
    scene.add(bale);
  }
  addMotes(scene, 'poeira', halfX, 0, 5);
  return { size: halfX, update: still };
}

/* ---------------- Captura do Estandarte ---------------- */
function estandarte(scene: THREE.Scene): Env {
  field(scene, false);
  const { halfX } = SOCCER;
  for (const team of [0, 1]) {
    const x = team === 0 ? -ESTANDARTE.baseX : ESTANDARTE.baseX;
    const color = TEAMS.colors[team];
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(ESTANDARTE.homeR, ESTANDARTE.homeR + 0.1, 0.12, 12), paint(color, { facet: 0.1 }));
    pad.position.set(x, 0.04, 0);
    pad.userData.noCast = true;
    scene.add(pad);
    const tent = marketTent(color);
    tent.position.set(x + (team === 0 ? -2.6 : 2.6), 0, 0);
    tent.lookAt(0, 0, 0);
    tent.scale.setScalar(0.9);
    scene.add(tent);
    for (const sz of [-1, 1]) {
      const t = torch();
      t.position.set(x, 0, sz * (ESTANDARTE.homeR + 0.8));
      scene.add(t);
    }
  }
  addMotes(scene, 'poeira', halfX, 0, 5);
  return { size: halfX, update: still };
}

export const ARENAS: Record<Exclude<MinigameId, 'ringue' | 'hexa' | 'corrida' | 'chuva' | 'bomba' | 'futebol'>, Builder> = {
  coroa, trono, potes, colheita, moinho, flechas, javali, cerco, bardo, tinta, lava, ladeira, machados, pastoreio, estandarte,
};
