import * as THREE from 'three';
import {
  BOMBA, CHUVA, HEX, HEX_PER_LAYER, HEX_TILES, RACE, RING, SOCCER, TILE_CRACK, TILE_GONE,
  seeded, type MinigameId,
} from '@fuzue/shared';
import { canvasTexture, outline, toon, toonMap } from '../../engine/materials';
import {
  addHorizon, addLights, addSea, bannerPole, cobbleTexture, flicker, grassTexture, planksTexture, rock, torch,
} from '../../engine/scenery';
import type { NetMinigame } from '../../net/types';

/** Cenário de um minijogo: monta a arena e reage ao estado (raio, pisos). */
export interface Env {
  update(dt: number, t: number, mg: NetMinigame | null): void;
  /** Raio aproximado da área de jogo (para a câmera). */
  size: number;
}

const FOG: Record<MinigameId, string> = {
  ringue: '#a9b8c6',
  hexa: '#6a4030',
  corrida: '#b98f6a',
  chuva: '#b98f6a',
  bomba: '#8f8090',
  futebol: '#b9a07a',
};

export function buildEnv(id: MinigameId, scene: THREE.Scene): Env {
  addLights(scene, id === 'corrida' ? 16 : 13, { color: FOG[id], near: 34, far: 110 });
  const sea = addSea(scene, 13, id === 'hexa' ? -22 : -3, id === 'hexa' ? 'lava' : 'water');
  addHorizon(scene, 36);
  const env = ({ ringue, hexa, corrida, chuva, bomba, futebol } as const)[id](scene);
  return {
    size: env.size,
    update: (dt, t, mg) => {
      sea(dt, t);
      flicker(scene, t);
      env.update(dt, t, mg);
    },
  };
}

/* ---------------- Lago Congelado ---------------- */
function ringue(scene: THREE.Scene): Env {
  const rand = seeded(21);
  const ice = canvasTexture(512, 512, (g, w) => {
    g.fillStyle = '#dfeaf0';
    g.fillRect(0, 0, w, w);
    g.fillStyle = '#eef4f7';
    for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(rand() * w, rand() * w, 20 + rand() * 50, 10 + rand() * 30, rand() * 3, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#a9c3d1';
    g.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      let x = w / 2 + (rand() - 0.5) * 120;
      let y = w / 2 + (rand() - 0.5) * 120;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (rand() - 0.5) * 90; y += (rand() - 0.5) * 90; g.lineTo(x, y); }
      g.stroke();
    }
  });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 64), [toon('#9fb8c6'), toonMap(ice), toon('#7f98a6')]);
  platform.position.y = -0.5;
  platform.receiveShadow = true;
  outline(platform, 1.006, 1.04);
  scene.add(platform);
  // placas de gelo boiando em volta
  for (let i = 0; i < 9; i++) {
    const floe = new THREE.Mesh(new THREE.CylinderGeometry(0.6 + rand() * 0.8, 0.7 + rand() * 0.8, 0.2, 7), toon('#dfeaf0'));
    const a = rand() * Math.PI * 2;
    const r = 12 + rand() * 8;
    floe.position.set(Math.cos(a) * r, -2.9, Math.sin(a) * r);
    scene.add(floe);
  }
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
  const geo = new THREE.CylinderGeometry(HEX.size * 0.94, HEX.size * 0.94, 0.5, 6);
  geo.rotateY(Math.PI / 6);
  const colors = ['#a39b8e', '#8a8378', '#6f7d55'];
  const crackColors = ['#cdc4b6', '#b3ac9f', '#97a37c'];
  const tiles: { mesh: THREE.Mesh; layer: number; state: number; fall: number; baseY: number }[] = [];
  HEX.layers.forEach((h, layer) => {
    for (const t of HEX_TILES) {
      const mesh = new THREE.Mesh(geo, toon(colors[layer]));
      mesh.position.set(t.x, h - 0.25, t.z);
      mesh.receiveShadow = true;
      mesh.castShadow = layer === 0;
      outline(mesh, 1.03, 1.1);
      scene.add(mesh);
      tiles.push({ mesh, layer, state: 0, fall: 0, baseY: h - 0.25 });
    }
  });
  // colunas quebradas saindo da lava
  const rand = seeded(5);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rand() * 0.3;
    const r = 13 + rand() * 4;
    const hgt = 6 + rand() * 12;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, hgt, 10), toon('#8a8378'));
    col.position.set(Math.cos(a) * r, -22 + hgt / 2, Math.sin(a) * r);
    col.rotation.z = (rand() - 0.5) * 0.2;
    outline(col, 1.04);
    scene.add(col);
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
          if (s === TILE_CRACK) tile.mesh.material = toon(crackColors[tile.layer]);
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
  const stoneSide = toon('#7d7468');
  for (const f of RACE.floors) {
    const len = f.z1 - f.z0;
    const top = cobbleTexture('#8c857a', '#a39b8e', '#5f594f', 3);
    top.repeat.set(2, len / 4);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 1.2, len), [stoneSide, stoneSide, toonMap(top), stoneSide, stoneSide, stoneSide]);
    floor.position.set(0, -0.6, (f.z0 + f.z1) / 2);
    floor.receiveShadow = true;
    outline(floor, 1.01, 1.04);
    scene.add(floor);
    // parapeito de pedra dos dois lados
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, len), toon('#9a9286'));
      wall.position.set(sx * (W + 0.1), 0.25, (f.z0 + f.z1) / 2);
      wall.castShadow = true;
      outline(wall, 1.04, 1.06);
      scene.add(wall);
    }
    // pilar de sustentação da ponte
    const pier = new THREE.Mesh(new THREE.BoxGeometry(W * 1.4, 3, 1.4), stoneSide);
    pier.position.set(0, -2.4, (f.z0 + f.z1) / 2);
    scene.add(pier);
  }
  // correnteza: água passando por cima da ponte
  const currents: THREE.Texture[] = [];
  for (const c of RACE.conveyors) {
    const tex = canvasTexture(64, 256, (g, w, h) => {
      g.fillStyle = '#4f7f95';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#9cc3d3';
      g.lineWidth = 4;
      for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(4, y); g.quadraticCurveTo(w / 2, y + 12, w - 4, y); g.stroke(); }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, (c.z1 - c.z0) / 3);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, c.z1 - c.z0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.02, (c.z0 + c.z1) / 2);
    scene.add(water);
    currents.push(tex);
  }
  // barris como obstáculos
  const barrelMat = new THREE.MeshToonMaterial({ map: planksTexture('#7a5333', '#4a3322') });
  for (const b of RACE.bumpers) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r * 0.92, b.h, 14), barrelMat);
    barrel.position.set(b.x, b.h / 2, b.z);
    barrel.castShadow = true;
    outline(barrel, 1.05);
    scene.add(barrel);
    for (const y of [0.25, 0.75]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(b.r * 1.01, 0.04, 6, 20), toon('#3a3a3a'));
      band.rotation.x = Math.PI / 2;
      band.position.set(b.x, b.h * y, b.z);
      scene.add(band);
    }
  }
  for (const s of RACE.sweepers) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.5, 10), toon('#6f685e'));
    post.position.set(0, 0.75, s.z);
    outline(post, 1.06);
    scene.add(post);
  }
  const line = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 0.6), toon('#efe3c6'));
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.02, 1);
  scene.add(line);
  // portão do castelo na chegada
  const gate = new THREE.Group();
  const stone = new THREE.MeshToonMaterial({ map: cobbleTexture('#a39b8e', '#b5ad9f', '#6f685e', 5) });
  for (const sx of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 5.5, 10), stone);
    tower.position.set(sx * (W + 0.9), 2.75, 0);
    tower.castShadow = true;
    outline(tower, 1.03);
    gate.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.5, 10), toon('#8e2430'));
    roof.position.set(sx * (W + 0.9), 6.25, 0);
    outline(roof, 1.05);
    gate.add(roof);
  }
  const arch = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.4, 1.1, 1.2), stone);
  arch.position.y = 4.4;
  outline(arch, 1.02);
  gate.add(arch);
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
  const finish = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 0.7), toon('#c9a227'));
  finish.rotation.x = -Math.PI / 2;
  finish.position.set(0, 0.02, RACE.finishZ);
  scene.add(finish);
  return {
    size: 12,
    update: (dt) => {
      for (const tex of currents) tex.offset.y -= dt * (RACE.conveyors[0].vz / 3);
    },
  };
}

/* ---------------- pátios redondos com ameias ---------------- */
function roundYard(scene: THREE.Scene, radius: number, sideColor: string): void {
  const cobble = cobbleTexture('#8c857a', '#a39b8e', '#5f594f', 9);
  cobble.repeat.set(6, 6);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.3, radius + 0.5, 3, 48), [toon(sideColor), toonMap(cobble), toon(sideColor)]);
  yard.position.y = -1.5;
  yard.receiveShadow = true;
  outline(yard, 1.006, 1.02);
  scene.add(yard);
  const merlon = toon('#9a9286');
  const n = Math.round(radius * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.45), merlon);
    m.position.set(Math.cos(a) * (radius + 0.35), 0.27, Math.sin(a) * (radius + 0.35));
    m.rotation.y = -a + Math.PI / 2;
    m.castShadow = true;
    outline(m, 1.05);
    scene.add(m);
  }
  for (const [x, c] of [[-1, '#8e2430'], [1, '#2f5a8f']] as const) {
    const b = bannerPole(c, 3.4);
    b.position.set(x * (radius + 1.2), 0, -radius * 0.6);
    scene.add(b);
    const t = torch();
    t.position.set(x * (radius + 1.1), 0, radius * 0.3);
    scene.add(t);
  }
}

function chuva(scene: THREE.Scene): Env {
  roundYard(scene, CHUVA.radius, '#7d7468');
  // baús e pilhas de ouro pelo pátio do dragão
  const rand = seeded(3);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const pile = new THREE.Mesh(new THREE.ConeGeometry(0.7 + rand() * 0.3, 0.5, 10), toon('#d4af37'));
    pile.position.set(Math.cos(a) * (CHUVA.radius + 2.4), 0.1, Math.sin(a) * (CHUVA.radius + 2.4));
    scene.add(pile);
  }
  return { size: CHUVA.radius, update: () => {} };
}

function bomba(scene: THREE.Scene): Env {
  roundYard(scene, BOMBA.radius, '#6f685e');
  for (let i = 0; i < 5; i++) {
    const r = rock(1 + i * 0.2);
    const a = i * 1.3;
    r.position.set(Math.cos(a) * (BOMBA.radius + 3), -0.3, Math.sin(a) * (BOMBA.radius + 3));
    scene.add(r);
  }
  return { size: BOMBA.radius, update: () => {} };
}

/* ---------------- Torneio da Bola ---------------- */
function futebol(scene: THREE.Scene): Env {
  const { halfX, halfZ, goalHalf, goalDepth } = SOCCER;
  const grass = grassTexture('#6f8f4e', '#64844a', 15);
  grass.repeat.set(4, 3);
  const field = new THREE.Mesh(new THREE.BoxGeometry(halfX * 2 + 1.4, 1, halfZ * 2 + 1.4), [toon('#5f7d42'), toon('#5f7d42'), toonMap(grass), toon('#5f7d42'), toon('#5f7d42'), toon('#5f7d42')]);
  field.position.y = -0.5;
  field.receiveShadow = true;
  outline(field, 1.004, 1.04);
  scene.add(field);
  // linhas de cal
  const chalk = toon('#efe3c6');
  const lineMesh = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), chalk);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.015, z);
    scene.add(m);
  };
  lineMesh(0.12, halfZ * 2, 0, 0);
  lineMesh(halfX * 2, 0.12, 0, -halfZ + 0.1);
  lineMesh(halfX * 2, 0.12, 0, halfZ - 0.1);
  const circle = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.02, 40), chalk);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.016;
  scene.add(circle);
  // cerca de madeira
  const wood = new THREE.MeshToonMaterial({ map: planksTexture('#7a5333', '#4a3322') });
  const fence = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), wood);
    m.position.set(x, 0.35, z);
    m.castShadow = true;
    outline(m, 1.02, 1.08);
    scene.add(m);
  };
  fence(halfX * 2 + 1.4, 0.3, 0, -halfZ - 0.5);
  fence(halfX * 2 + 1.4, 0.3, 0, halfZ + 0.5);
  for (const sx of [-1, 1]) {
    const seg = halfZ - goalHalf;
    fence(0.3, seg, sx * (halfX + 0.5), -(goalHalf + seg / 2));
    fence(0.3, seg, sx * (halfX + 0.5), goalHalf + seg / 2);
    const color = SOCCER.teamColors[sx < 0 ? 0 : 1];
    const goal = new THREE.Group();
    const postMat = toon('#6a4628');
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 10), postMat);
      post.position.set(0, 1.3, sz * goalHalf);
      outline(post, 1.08);
      goal.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, goalHalf * 2, 10), postMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.y = 2.6;
    goal.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(goalDepth, 2.6, goalHalf * 2), new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.4 }));
    net.position.set(sx * goalDepth / 2, 1.3, 0);
    goal.add(net);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(goalDepth, 0.9, goalHalf * 2), toon(color));
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
  return { size: halfX, update: () => {} };
}
