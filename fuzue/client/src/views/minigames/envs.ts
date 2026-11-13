import * as THREE from 'three';
import {
  BOMBA, CHUVA, HEX, HEX_PER_LAYER, HEX_TILES, RACE, RING, SOCCER, TILE_CRACK, TILE_GONE,
  seeded, type MinigameId,
} from '@fuzue/shared';
import { canvasTexture, chunk, liquid, metal, paint } from '../../engine/materials';
import {
  addHorizon, addMotes, addSea, bannerPole, flicker, rock, scatterGrass, setupWorld, SKIES, stoneFloor, torch, type Sky,
} from '../../engine/scenery';
import type { NetMinigame, NetState } from '../../net/types';
import { ARENAS } from './arenas';
import { GROUT, roundYard } from './props';

/** Cenário de um minijogo: monta a arena e reage ao estado (raio, pisos). */
export interface Env {
  update(dt: number, t: number, mg: NetMinigame | null, s?: NetState | null): void;
  /** Raio aproximado da área de jogo (para a câmera). */
  size: number;
}

const SKY: Record<MinigameId, Sky> = {
  ringue: SKIES.gelo,
  hexa: SKIES.vulcao,
  corrida: SKIES.dia,
  chuva: SKIES.tarde,
  bomba: SKIES.brasa,
  futebol: SKIES.dia,
  coroa: SKIES.tarde,
  trono: SKIES.dia,
  potes: SKIES.dia,
  colheita: SKIES.tarde,
  moinho: SKIES.dia,
  flechas: SKIES.brasa,
  javali: SKIES.dia,
  cerco: SKIES.tarde,
  bardo: SKIES.crepusculo,
  tinta: SKIES.dia,
  lava: SKIES.vulcao,
  ladeira: SKIES.dia,
  machados: SKIES.tarde,
  pastoreio: SKIES.dia,
  estandarte: SKIES.tarde,
};

/** Altura do mar em volta (a lava sobe sozinha na Maré de Lava). */
const SEA: Partial<Record<MinigameId, { y: number; kind: 'water' | 'lava' } | null>> = {
  hexa: { y: -22, kind: 'lava' },
  lava: null,
  cerco: { y: -7, kind: 'water' },
  bardo: { y: -7, kind: 'water' },
  machados: { y: -9, kind: 'water' },
};

const SHADOW_SIZE: Partial<Record<MinigameId, number>> = { corrida: 16, ladeira: 16, machados: 16 };

export function buildEnv(id: MinigameId, scene: THREE.Scene): Env {
  setupWorld(scene, SKY[id], SHADOW_SIZE[id] ?? 13);
  const seaDef = id in SEA ? SEA[id] : { y: -3, kind: 'water' as const };
  const sea = seaDef ? addSea(scene, 13, seaDef.y, seaDef.kind) : () => {};
  const sky = addHorizon(scene, 36);
  const builders = { ringue, hexa, corrida, chuva, bomba, futebol, ...ARENAS };
  const env = builders[id](scene);
  return {
    size: env.size,
    update: (dt, t, mg, s) => {
      sea(dt, t);
      sky(dt, t);
      flicker(scene, t);
      env.update(dt, t, mg, s);
    },
  };
}


/* ---------------- Lago Congelado ---------------- */
function ringue(scene: THREE.Scene): Env {
  const rand = seeded(21);
  // bloco de gelo brilhante; as rachaduras são um decalque por cima
  const ice = paint('#b9d5e3', { rough: 0.28, facet: 0.1 });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.92, 3, 22), ice);
  platform.position.y = -1.5;
  platform.userData.noCast = true;
  scene.add(platform);
  const cracks = canvasTexture(512, 512, (g, w) => {
    g.strokeStyle = 'rgba(235, 245, 250, 0.55)';
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      let x = w / 2 + (rand() - 0.5) * 140;
      let y = w / 2 + (rand() - 0.5) * 140;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 120; y += (rand() - 0.5) * 120; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(rand() * w, rand() * w, 20 + rand() * 40, 8 + rand() * 18, rand() * 3, 0, Math.PI * 2); g.fill(); }
  });
  const decal = new THREE.Mesh(new THREE.CircleGeometry(1, 22), new THREE.MeshStandardMaterial({ map: cracks, transparent: true, roughness: 0.1, depthWrite: false }));
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = 1.505;
  platform.add(decal);
  // placas de gelo e icebergs em volta
  for (let i = 0; i < 12; i++) {
    const floe = new THREE.Mesh(new THREE.CylinderGeometry(0.6 + rand() * 0.9, 0.8 + rand() * 0.9, 0.35, 6), paint('#e4eff4', { rough: 0.2, facet: 0.12 }));
    const a = rand() * Math.PI * 2;
    const r = 12 + rand() * 10;
    floe.position.set(Math.cos(a) * r, -2.85, Math.sin(a) * r);
    floe.rotation.y = rand() * 3;
    scene.add(floe);
  }
  for (let i = 0; i < 5; i++) {
    const berg = chunk(1.5 + rand() * 1.5, paint('#e9f3f7', { rough: 0.2, facet: 0.16 }), 1, 1.4 + rand(), 1);
    const a = rand() * Math.PI * 2;
    berg.position.set(Math.cos(a) * (22 + rand() * 6), -2.5, Math.sin(a) * (22 + rand() * 6));
    scene.add(berg);
  }
  addMotes(scene, 'neve', 16, 0, 12);
  return {
    size: RING.startRadius,
    update: (_dt, _t, mg) => {
      const r = mg?.radius || RING.startRadius;
      platform.scale.set(r, 1, r);
    },
  };
}

/* ---------------- Torre em Ruínas ---------------- */
function hexa(scene: THREE.Scene): Env {
  const geo = new THREE.CylinderGeometry(HEX.size * 0.94, HEX.size * 0.86, 0.6, 6);
  geo.rotateY(Math.PI / 6);
  const colors = ['#b3aa9b', '#9a9286', '#7f8c62'];
  // pedra rachando esquenta: brilho de brasa por dentro
  const hot = ['#cdc4b6', '#b3ac9f', '#97a37c'].map(c => new THREE.MeshStandardMaterial({
    color: c, emissive: '#ff5a14', emissiveIntensity: 0.9, roughness: 0.8, flatShading: true,
  }));
  const tiles: { mesh: THREE.Mesh; layer: number; state: number; fall: number; baseY: number }[] = [];
  HEX.layers.forEach((h, layer) => {
    for (const t of HEX_TILES) {
      const mesh = new THREE.Mesh(geo, paint(colors[layer], { facet: 0.16 }));
      mesh.position.set(t.x, h - 0.3, t.z);
      mesh.castShadow = layer === 0;
      scene.add(mesh);
      tiles.push({ mesh, layer, state: 0, fall: 0, baseY: h - 0.3 });
    }
  });
  // colunas quebradas saindo da lava
  const rand = seeded(5);
  const colMat = paint('#8a8378', { facet: 0.16 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.3;
    const r = 13 + rand() * 5;
    const hgt = 6 + rand() * 12;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, hgt, 8), colMat);
    col.position.set(Math.cos(a) * r, -22 + hgt / 2, Math.sin(a) * r);
    col.rotation.z = (rand() - 0.5) * 0.2;
    scene.add(col);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 0.4, 8), colMat);
    cap.position.set(col.position.x, -22 + hgt + 0.1, col.position.z);
    cap.rotation.set((rand() - 0.5) * 0.4, rand(), (rand() - 0.5) * 0.4);
    scene.add(cap);
  }
  return {
    size: HEX.size * Math.sqrt(3) * (HEX.rings + 0.5),
    update: (dt, t, mg) => {
      if (!mg) return;
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const s = mg.tiles[i] ?? 0;
        if (s !== tile.state) {
          tile.state = s;
          if (s === TILE_CRACK) tile.mesh.material = hot[tile.layer];
        }
        if (tile.state === TILE_CRACK) {
          tile.mesh.position.x = HEX_TILES[i % HEX_PER_LAYER].x + Math.sin(t * 60 + i) * 0.04;
        } else if (tile.state === TILE_GONE && tile.mesh.visible) {
          tile.fall += dt;
          tile.mesh.position.y = tile.baseY - tile.fall * tile.fall * 12;
          tile.mesh.scale.setScalar(Math.max(0.01, 1 - tile.fall * 1.4));
          if (tile.fall > 0.7) tile.mesh.visible = false;
        }
      }
    },
  };
}

/* ---------------- Ponte do Castelo ---------------- */
function corrida(scene: THREE.Scene): Env {
  const W = RACE.halfWidth;
  const stoneSide = paint('#7d7468', { facet: 0.14 });
  const parapet = paint('#9a9286', { facet: 0.14 });
  RACE.floors.forEach((f, i) => {
    const len = f.z1 - f.z0;
    const zc = (f.z0 + f.z1) / 2;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 1.2, len), [stoneSide, stoneSide, paint(GROUT), stoneSide, stoneSide, stoneSide]);
    floor.position.set(0, -0.6, zc);
    floor.userData.noCast = true;
    scene.add(floor);
    const top = stoneFloor({ w: W * 2, d: len }, { seed: 30 + i });
    top.position.z = zc;
    scene.add(top);
    // parapeito de pedra dos dois lados, em blocos
    for (const sx of [-1, 1]) {
      const n = Math.max(1, Math.round(len / 1.4));
      for (let k = 0; k < n; k++) {
        const blockLen = len / n;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5 + (k % 2) * 0.12, blockLen - 0.06), parapet);
        wall.position.set(sx * (W + 0.12), 0.25 + (k % 2) * 0.06, f.z0 + blockLen * (k + 0.5));
        scene.add(wall);
      }
    }
    // pilar de sustentação da ponte
    const pier = new THREE.Mesh(new THREE.BoxGeometry(W * 1.4, 3, 1.4), stoneSide);
    pier.position.set(0, -2.4, zc);
    scene.add(pier);
  });
  // correnteza: água facetada + espuma correndo por cima
  const currents: THREE.Texture[] = [];
  for (const c of RACE.conveyors) {
    const len = c.z1 - c.z0;
    const geo = new THREE.PlaneGeometry(W * 2, len, 10, Math.round(len * 1.5));
    geo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, liquid('stream'));
    water.position.set(0, 0.04, (c.z0 + c.z1) / 2);
    water.userData.noCast = true;
    scene.add(water);
    const tex = canvasTexture(64, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(235, 248, 255, 0.85)';
      g.lineWidth = 4;
      for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(4, y); g.quadraticCurveTo(w / 2, y + 12, w - 4, y); g.stroke(); }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, len / 3);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, len), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, 0.12, (c.z0 + c.z1) / 2);
    scene.add(foam);
    currents.push(tex);
  }
  // barris como obstáculos
  const wood = paint('#7a5333', { facet: 0.16 });
  const woodLight = paint('#86603d', { facet: 0.16 });
  const iron = metal('#3a3a3a', 0.5);
  for (const b of RACE.bumpers) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r * 0.92, b.h, 10), wood);
    barrel.position.set(b.x, b.h / 2, b.z);
    scene.add(barrel);
    const bulge = new THREE.Mesh(new THREE.CylinderGeometry(b.r * 1.05, b.r * 1.05, b.h * 0.36, 10), woodLight);
    bulge.position.set(b.x, b.h / 2, b.z);
    scene.add(bulge);
    for (const y of [0.18, 0.82]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(b.r * 1.01, 0.045, 4, 10), iron);
      band.rotation.x = Math.PI / 2;
      band.position.set(b.x, b.h * y, b.z);
      scene.add(band);
    }
  }
  for (const s of RACE.sweepers) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.5, 7), paint('#6f685e', { facet: 0.16 }));
    post.position.set(0, 0.75, s.z);
    scene.add(post);
  }
  const line = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.04, 0.5), paint('#efe3c6'));
  line.position.set(0, 0.07, 1);
  scene.add(line);
  // portão do castelo na chegada
  const gate = new THREE.Group();
  const stone = paint('#a39b8e', { facet: 0.12 });
  for (const sx of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.15, 5.5, 8), stone);
    tower.position.set(sx * (W + 0.9), 2.75, 0);
    gate.add(tower);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.05, 0.35, 8), paint('#8a8378', { facet: 0.12 }));
    ring.position.set(sx * (W + 0.9), 5.6, 0);
    gate.add(ring);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.7, 8), paint('#8e2430', { facet: 0.14 }));
    roof.position.set(sx * (W + 0.9), 6.6, 0);
    gate.add(roof);
    const t = torch();
    t.position.set(sx * (W - 0.3), 0, 1.2);
    gate.add(t);
    const b = bannerPole(sx < 0 ? '#8e2430' : '#2f5a8f', 3.2);
    b.position.set(sx * (W + 0.9), 4.2, 1.1);
    b.scale.setScalar(0.8);
    gate.add(b);
  }
  const arch = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.4, 1.1, 1.2), stone);
  arch.position.y = 4.4;
  gate.add(arch);
  for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 1.2), stone);
    m.position.set(-W + 0.4 + (k * (W * 2 - 0.8)) / 5, 5.15, 0);
    gate.add(m);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, 0.8), new THREE.MeshBasicMaterial({
    map: canvasTexture(512, 128, (g, w, h) => {
      g.fillStyle = '#efe3c6'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8e2430'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
      g.font = '700 70px "Cinzel","Times New Roman",serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#22170e';
      g.fillText('CHEGADA', w / 2, h / 2 + 4);
    }),
  }));
  sign.position.set(0, 4.4, 0.62);
  gate.add(sign);
  gate.position.z = RACE.finishZ - 0.5;
  scene.add(gate);
  const finish = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.04, 0.7), metal('#e0b33a', 0.3));
  finish.position.set(0, 0.07, RACE.finishZ);
  scene.add(finish);
  addMotes(scene, 'poeira', 10, 0, 6).position.z = RACE.finishZ / 2;
  return {
    size: 12,
    update: (dt) => {
      for (const tex of currents) tex.offset.y -= dt * (RACE.conveyors[0].vz / 3);
    },
  };
}

function chuva(scene: THREE.Scene): Env {
  roundYard(scene, CHUVA.radius, '#7d7468');
  // baús abertos e pilhas de ouro em volta do pátio do dragão
  const rand = seeded(3);
  const gold = metal('#e0b33a', 0.25);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const x = Math.cos(a) * (CHUVA.radius + 2.6);
    const z = Math.sin(a) * (CHUVA.radius + 2.6);
    const pile = new THREE.Mesh(new THREE.ConeGeometry(0.8 + rand() * 0.4, 0.6, 7), gold);
    pile.position.set(x, -0.05, z);
    scene.add(pile);
    if (i % 2 === 0) {
      const chest = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), paint('#6a4628', { facet: 0.14 }));
      box.position.y = 0.25;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 6, 1, false, 0, Math.PI), paint('#7a5333', { facet: 0.14 }));
      lid.rotation.set(0, 0, Math.PI / 2);
      lid.position.set(0, 0.5, -0.28);
      lid.rotation.x = -0.9;
      const shine = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.5), metal('#e0b33a', 0.2));
      shine.position.y = 0.48;
      chest.add(box, lid, shine);
      chest.position.set(x * 0.92 + 0.8, 0, z * 0.92);
      chest.lookAt(0, 0, 0);
      scene.add(chest);
    }
  }
  addMotes(scene, 'poeira', CHUVA.radius + 2, 0, 7);
  return { size: CHUVA.radius, update: () => {} };
}

function bomba(scene: THREE.Scene): Env {
  roundYard(scene, BOMBA.radius, '#6f685e');
  for (let i = 0; i < 6; i++) {
    const r = rock(1 + i * 0.2);
    const a = i * 1.1;
    r.position.set(Math.cos(a) * (BOMBA.radius + 3), -0.3, Math.sin(a) * (BOMBA.radius + 3));
    scene.add(r);
  }
  addMotes(scene, 'brasa', BOMBA.radius, 0, 6);
  return { size: BOMBA.radius, update: () => {} };
}

/* ---------------- Torneio da Bola ---------------- */
function futebol(scene: THREE.Scene): Env {
  const { halfX, halfZ, goalHalf, goalDepth } = SOCCER;
  const side = paint('#5a4a32', { facet: 0.14 });
  const fw = halfX * 2 + 1.4;
  const fd = halfZ * 2 + 1.4;
  const field = new THREE.Mesh(new THREE.BoxGeometry(fw, 1, fd), [side, side, paint('#5f8a3c', { facet: 0.06 }), side, side, side]);
  field.position.y = -0.5;
  field.userData.noCast = true;
  scene.add(field);
  // grama aparada em faixas
  const stripe = paint('#6a9844', { facet: 0.06 });
  const n = 8;
  for (let i = 0; i < n; i += 2) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry((halfX * 2) / n, halfZ * 2), stripe);
    m.rotation.x = -Math.PI / 2;
    m.position.set(-halfX + ((i + 0.5) * halfX * 2) / n, 0.005, 0);
    m.userData.noCast = true;
    scene.add(m);
  }
  // linhas de cal
  const chalk = paint('#f1ead8', { facet: 0 });
  const lineMesh = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), chalk);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.012, z);
    m.userData.noCast = true;
    scene.add(m);
  };
  lineMesh(0.12, halfZ * 2, 0, 0);
  lineMesh(halfX * 2, 0.12, 0, -halfZ + 0.1);
  lineMesh(halfX * 2, 0.12, 0, halfZ - 0.1);
  const circle = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.02, 32), chalk);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.013;
  scene.add(circle);
  // cerca de madeira: mourões e duas travessas
  const wood = paint('#7a5333', { facet: 0.16 });
  const fence = (len: number, x: number, z: number, alongX: boolean) => {
    const g = new THREE.Group();
    const posts = Math.max(2, Math.round(len / 1.6) + 1);
    for (let i = 0; i < posts; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.16), wood);
      p.position.set(-len / 2 + (i * len) / (posts - 1), 0.42, 0);
      g.add(p);
    }
    for (const y of [0.3, 0.62]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.08), wood);
      rail.position.set(0, y, 0);
      g.add(rail);
    }
    g.position.set(x, 0, z);
    if (!alongX) g.rotation.y = Math.PI / 2;
    scene.add(g);
  };
  fence(fw, 0, -halfZ - 0.5, true);
  fence(fw, 0, halfZ + 0.5, true);
  for (const sx of [-1, 1]) {
    const seg = halfZ - goalHalf;
    fence(seg, sx * (halfX + 0.5), -(goalHalf + seg / 2), false);
    fence(seg, sx * (halfX + 0.5), goalHalf + seg / 2, false);
    const color = SOCCER.teamColors[sx < 0 ? 0 : 1];
    const goal = new THREE.Group();
    const postMat = paint('#efe3c6', { facet: 0.1 });
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 6), postMat);
      post.position.set(0, 1.3, sz * goalHalf);
      goal.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, goalHalf * 2, 6), postMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.y = 2.6;
    goal.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(goalDepth, 2.6, goalHalf * 2), paint(color, { opacity: 0.35 }));
    net.position.set(sx * goalDepth / 2, 1.3, 0);
    goal.add(net);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(goalDepth, 0.9, goalHalf * 2), paint(color, { facet: 0.1 }));
    floor.position.set(sx * goalDepth / 2, -0.45, 0);
    goal.add(floor);
    goal.position.x = sx * halfX;
    scene.add(goal);
    // estandartes da casa atrás do gol
    for (const sz of [-1, 1]) {
      const b = bannerPole(color, 3.4);
      b.position.set(sx * (halfX + goalDepth + 1), 0, sz * (goalHalf + 1.2));
      b.rotation.y = sx * Math.PI / 2;
      scene.add(b);
    }
  }
  // gramado em volta, com tufos e flores
  const around = new THREE.Mesh(new THREE.CylinderGeometry(halfX + 9, halfX + 9.5, 1, 20), paint('#567f37', { facet: 0.1 }));
  around.position.y = -0.52;
  around.userData.noCast = true;
  scene.add(around);
  scatterGrass(scene, 420, { radius: halfX + 8.5 }, (x, z) => Math.abs(x) > halfX + goalDepth + 0.4 || Math.abs(z) > halfZ + 0.9, 44, -0.02);
  addMotes(scene, 'poeira', halfX + 2, 0, 6);
  return { size: halfX, update: () => {} };
}
