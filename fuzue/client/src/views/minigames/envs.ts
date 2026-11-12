import * as THREE from 'three';
import {
  BOMBA, CHUVA, HEX, HEX_PER_LAYER, HEX_TILES, RACE, RING, SOCCER, TILE_CRACK, TILE_GONE,
  type MinigameId,
} from '@fuzue/shared';
import { canvasTexture, outline, stripeTexture, toon, toonMap } from '../../engine/materials';
import { addHorizon, addLights, addSea } from '../../engine/scenery';
import type { NetMinigame } from '../../net/types';

/** Cenário de um minijogo: monta a arena e reage ao estado (raio, pisos). */
export interface Env {
  update(dt: number, t: number, mg: NetMinigame | null): void;
  /** Raio aproximado da área de jogo (para a câmera). */
  size: number;
}

export function buildEnv(id: MinigameId, scene: THREE.Scene): Env {
  addLights(scene, id === 'corrida' ? 16 : 13);
  const sea = addSea(scene, 13, id === 'hexa' ? -22 : -3);
  addHorizon(scene, 36);
  const env = ({ ringue, hexa, corrida, chuva, bomba, futebol } as const)[id](scene);
  return {
    size: env.size,
    update: (dt, t, mg) => { sea(dt, t); env.update(dt, t, mg); },
  };
}

function ringTexture(): THREE.Texture {
  return canvasTexture(512, 512, (g, w) => {
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
  });
}

/* ---------------- Ringue Escorregadio ---------------- */
function ringue(scene: THREE.Scene): Env {
  const side = stripeTexture('#ffffff', '#ff5fa2');
  side.repeat.set(12, 1);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 72), [toonMap(side), toonMap(ringTexture()), toon('#9fd8f5')]);
  platform.position.y = -0.5;
  platform.receiveShadow = true;
  outline(platform, 1.006, 1.04);
  scene.add(platform);
  return {
    size: RING.startRadius,
    update: (_dt, _t, mg) => {
      const r = mg?.radius || RING.startRadius;
      platform.scale.set(r, 1, r);
    },
  };
}

/* ---------------- Chão que Some ---------------- */
function hexa(scene: THREE.Scene): Env {
  const geo = new THREE.CylinderGeometry(HEX.size * 0.94, HEX.size * 0.94, 0.5, 6);
  geo.rotateY(Math.PI / 6);
  const colors = ['#ff8fc0', '#7fe3c4', '#ffd166'];
  const crackColors = ['#ffd0e4', '#c6f7e6', '#fff0b8'];
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

/* ---------------- Corrida Doce ---------------- */
function corrida(scene: THREE.Scene): Env {
  const W = RACE.halfWidth;
  const floorTex = canvasTexture(256, 256, (g, w) => {
    g.fillStyle = '#fff6ea';
    g.fillRect(0, 0, w, w);
    g.fillStyle = '#ffe0ef';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) g.fillRect(x * 64, y * 64, 64, 64);
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  for (const f of RACE.floors) {
    const len = f.z1 - f.z0;
    const tex = floorTex.clone();
    tex.repeat.set(2, len / 4);
    tex.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 1, len), [toon('#ffb3d9'), toon('#ffb3d9'), toonMap(tex), toon('#e88cb8'), toon('#ffb3d9'), toon('#ffb3d9')]);
    floor.position.set(0, -0.5, (f.z0 + f.z1) / 2);
    floor.receiveShadow = true;
    outline(floor, 1.01, 1.04);
    scene.add(floor);
    // grades nas laterais
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, len), toon('#ff5fa2'));
      rail.position.set(sx * (W + 0.05), 0.22, (f.z0 + f.z1) / 2);
      scene.add(rail);
    }
  }
  const belts: THREE.Texture[] = [];
  for (const c of RACE.conveyors) {
    const tex = stripeTexture('#7fe3c4', '#3fd6b0');
    tex.repeat.set(1, (c.z1 - c.z0) / 2);
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, c.z1 - c.z0), toonMap(tex));
    belt.rotation.x = -Math.PI / 2;
    belt.rotation.z = Math.PI / 2;
    belt.position.set(0, 0.01, (c.z0 + c.z1) / 2);
    scene.add(belt);
    belts.push(tex);
  }
  const bumperTex = stripeTexture('#ffffff', '#4aa3ff');
  bumperTex.repeat.set(2, 1);
  for (const b of RACE.bumpers) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r, b.h, 20), toonMap(bumperTex));
    m.position.set(b.x, b.h / 2, b.z);
    m.castShadow = true;
    outline(m, 1.06);
    scene.add(m);
  }
  for (const s of RACE.sweepers) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.5, 14), toon('#a77bff'));
    post.position.set(0, 0.75, s.z);
    outline(post, 1.06);
    scene.add(post);
  }
  const line = (z: number, colorA: string, colorB: string) => {
    const tex = canvasTexture(256, 32, (g, _w, h) => {
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? colorA : colorB; g.fillRect(i * 16, 0, 16, h / 2); g.fillStyle = i % 2 ? colorB : colorA; g.fillRect(i * 16, h / 2, 16, h / 2); }
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 1), new THREE.MeshBasicMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.02, z);
    scene.add(m);
  };
  line(RACE.finishZ, '#2a1d45', '#ffffff');
  line(1, '#ff5fa2', '#ffffff');
  // arco de chegada
  const arch = new THREE.Group();
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4, 12), toonMap(stripeTexture('#ffffff', '#ffc93c')));
    pole.position.set(sx * (W + 0.4), 2, 0);
    arch.add(pole);
  }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 1.2, 0.9, 0.2), new THREE.MeshBasicMaterial({
    map: canvasTexture(512, 64, (g, w, h) => {
      g.fillStyle = '#ffc93c'; g.fillRect(0, 0, w, h);
      g.font = '48px "Lilita One","Arial Rounded MT Bold",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2a1d45';
      g.fillText('CHEGADA', w / 2, h / 2 + 3);
    }),
  }));
  banner.position.y = 4;
  arch.add(banner);
  arch.position.z = RACE.finishZ;
  scene.add(arch);
  return {
    size: 12,
    update: (dt) => {
      for (const tex of belts) tex.offset.y -= dt * (RACE.conveyors[0].vz / 2);
    },
  };
}

/* ---------------- arenas redondas com mureta ---------------- */
function roundArena(scene: THREE.Scene, radius: number, wall: string): void {
  const side = stripeTexture('#ffffff', wall);
  side.repeat.set(14, 1);
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.3, radius + 0.3, 1, 72), [toonMap(side), toonMap(ringTexture()), toon('#9fd8f5')]);
  plaza.position.y = -0.5;
  plaza.receiveShadow = true;
  outline(plaza, 1.006, 1.04);
  scene.add(plaza);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.15, 0.22, 10, 90), toon(wall));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.2;
  scene.add(rim);
}

function chuva(scene: THREE.Scene): Env {
  roundArena(scene, CHUVA.radius, '#ffc93c');
  return { size: CHUVA.radius, update: () => {} };
}

function bomba(scene: THREE.Scene): Env {
  roundArena(scene, BOMBA.radius, '#ff4d5a');
  return { size: BOMBA.radius, update: () => {} };
}

/* ---------------- Futebol Caótico ---------------- */
function futebol(scene: THREE.Scene): Env {
  const { halfX, halfZ, goalHalf, goalDepth } = SOCCER;
  const grass = canvasTexture(512, 256, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#8fe3a8' : '#7dd897'; g.fillRect((i * w) / 8, 0, w / 8 + 1, h); }
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w / 2, h - 8); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 40, 0, Math.PI * 2); g.stroke();
  });
  const field = new THREE.Mesh(new THREE.BoxGeometry(halfX * 2 + 1.4, 1, halfZ * 2 + 1.4), [toon('#5cc47a'), toon('#5cc47a'), toonMap(grass), toon('#5cc47a'), toon('#5cc47a'), toon('#5cc47a')]);
  field.position.y = -0.5;
  field.receiveShadow = true;
  outline(field, 1.004, 1.04);
  scene.add(field);
  const wallMat = toon('#fff6ea');
  const wall = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), wallMat);
    m.position.set(x, 0.35, z);
    m.castShadow = true;
    outline(m, 1.02, 1.08);
    scene.add(m);
  };
  wall(halfX * 2 + 1.4, 0.4, 0, -halfZ - 0.5);
  wall(halfX * 2 + 1.4, 0.4, 0, halfZ + 0.5);
  for (const sx of [-1, 1]) {
    const seg = halfZ - goalHalf;
    wall(0.4, seg, sx * (halfX + 0.5), -(goalHalf + seg / 2));
    wall(0.4, seg, sx * (halfX + 0.5), goalHalf + seg / 2);
    // gol
    const color = SOCCER.teamColors[sx < 0 ? 0 : 1];
    const goal = new THREE.Group();
    const postMat = toon('#ffffff');
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 10), postMat);
      post.position.set(0, 1.3, sz * goalHalf);
      goal.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, goalHalf * 2, 10), postMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.y = 2.6;
    goal.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(goalDepth, 2.6, goalHalf * 2), new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.45 }));
    net.position.set(sx * goalDepth / 2, 1.3, 0);
    goal.add(net);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(goalDepth, 0.9, goalHalf * 2), toon(color));
    floor.position.set(sx * goalDepth / 2, -0.45, 0);
    goal.add(floor);
    goal.position.x = sx * halfX;
    scene.add(goal);
  }
  return { size: halfX, update: () => {} };
}
