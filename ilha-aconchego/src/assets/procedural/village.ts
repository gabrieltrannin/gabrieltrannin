import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { t } from '../../i18n';
import { materials } from '../../render/materials';
import { paintSign } from '../../render/textures';
import type { AssetRegistry } from '../registry';
import { bake, ball, box, cone, cyl, dot, group, merge, meshOf, shade, vcMesh } from './parts';

const STONE = 0xb8b0a2;
const DOOR = 0x7a4e2c;
const DOOR_DARK = 0x5e3a20;
const CREAM = 0xf4eed9;
const IRON = 0x2e2e34;
const SNOW_ONLY = 'only:winter';

/** Profile of the thatched roof (radius, height), spun around the vertical axis. */
const ROOF_PROFILE = [[2.8, 0], [2.65, 0.22], [2.35, 0.6], [1.9, 1.0], [1.35, 1.38], [0.75, 1.68], [0.25, 1.86], [0, 1.9]].map(([r, y]) => new THREE.Vector2(r, y));

function hut(): THREE.Group {
  const m = materials();
  const g = group('house.hut');
  g.add(vcMesh([cyl(2.2, 2.3, 0.28, 0, 0.14, 0, STONE, 28)], 'base'));
  const wall = meshOf(new THREE.CylinderGeometry(2, 2, 1.95, 32, 1, true), m.hutWall, 'walls');
  wall.position.y = 1.255;
  const roof = meshOf(new THREE.LatheGeometry(ROOF_PROFILE, 36), m.thatch, 'roof');
  roof.position.y = 2.18;
  const snowRoof = meshOf(new THREE.LatheGeometry(ROOF_PROFILE.slice(2).map(v => new THREE.Vector2(v.x * 1.03, v.y + 0.06)), 36), m.snow, SNOW_ONLY, false);
  snowRoof.position.y = 2.18;
  g.add(wall, roof, snowRoof);

  const parts = [
    box(0.95, 1.2, 0.16, 0, 0.88, 1.98, DOOR), cyl(0.475, 0.475, 0.16, 0, 1.48, 1.98, DOOR, 18, Math.PI / 2),
    box(0.06, 1.5, 0.18, 0, 1.0, 1.99, DOOR_DARK), box(0.8, 0.06, 0.18, 0, 1.1, 1.99, DOOR_DARK), ball(0.05, 0.05, 0.05, 0.3, 0.95, 2.08, 0xf2c14e),
    box(1.5, 0.16, 0.6, 0, 0.36, 2.35, STONE), cyl(0.12, 0.12, 0.6, 0.9, 3.85, -0.45, 0x5a5a5a, 10),
  ];
  for (const s of [-1, 1]) {
    parts.push(cyl(0.18, 0.14, 0.3, s * 0.95, 0.43, 2.25, 0xc0704a), ball(0.22, 0.18, 0.22, s * 0.95, 0.68, 2.25, 0x5e9c42));
    parts.push(ball(0.07, 0.05, 0.07, s * 0.95 + 0.08, 0.86, 2.32, s < 0 ? 0xf27ba5 : 0xffd166), ball(0.07, 0.05, 0.07, s * 0.95 - 0.1, 0.84, 2.2, 0xffffff));
  }
  const glass: THREE.BufferGeometry[] = [];
  for (const a of [-0.85, 0.85]) {
    const sin = Math.sin(a), cos = Math.cos(a);
    parts.push(box(0.72, 0.72, 0.1, sin * 2.01, 1.45, cos * 2.01, 0x8a5a34, 0, a));
    parts.push(box(0.05, 0.56, 0.04, sin * 2.1, 1.45, cos * 2.1, 0x8a5a34, 0, a), box(0.56, 0.05, 0.04, sin * 2.1, 1.45, cos * 2.1, 0x8a5a34, 0, a));
    glass.push(box(0.56, 0.56, 0.04, sin * 2.075, 1.45, cos * 2.075, 0xffffff, 0, a));
  }
  g.add(vcMesh(parts, 'details'));
  const windows = new THREE.Mesh(vcMesh(glass).geometry, m.window);
  windows.name = 'window';
  g.add(windows);
  return g;
}

type StallKind = 'bread' | 'honey' | 'flowers';
const STALL_ICONS: Record<StallKind, string> = { bread: '🥖', honey: '🍯', flowers: '🌻' };
const stallSigns = new Map<StallKind, { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture }>();

function stallSign(kind: StallKind) {
  let s = stallSigns.get(kind);
  if (!s) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    s = { canvas, texture };
    stallSigns.set(kind, s);
  }
  paintSign(s.canvas, t(`stall.${kind}`), STALL_ICONS[kind], 'stall');
  s.texture.needsUpdate = true;
  return s;
}

/** Repaints the stall signs (call after the web fonts finish loading). */
export function repaintStallSigns(): void {
  for (const kind of stallSigns.keys()) stallSign(kind);
}

const STALL_GOODS: Record<StallKind, () => THREE.BufferGeometry[]> = {
  bread: () => {
    const p = [-0.8, -0.45, -0.1].map((x, i) => ball(0.18, 0.1, 0.12, x, 0.98, 0.3 + (i % 2) * 0.15, 0xd9a066, 0, 0.3));
    p.push(cyl(0.24, 0.24, 0.08, 0.55, 0.96, 0.35, 0xd9a066, 16), cyl(0.2, 0.2, 0.03, 0.55, 1.01, 0.35, 0x7b3f6e, 16), cyl(0.04, 0.04, 0.7, 0.1, 1.45, -0.9, 0xe0b070, 6, 0, 0, 1.3));
    for (const x of [-0.8, -0.4, 0.3, 0.7]) p.push(ball(0.13, 0.08, 0.1, x, 1.43, -0.95, 0xc98a4b));
    return p;
  },
  honey: () => {
    const p: THREE.BufferGeometry[] = [];
    [-0.85, -0.55, -0.25, 0.05].forEach((x, i) => p.push(cyl(0.1, 0.1, 0.22, x, 1.03, 0.3 + (i % 2) * 0.15, 0xf2b33d, 10), cyl(0.105, 0.105, 0.04, x, 1.16, 0.3 + (i % 2) * 0.15, 0xe5484d, 10)));
    p.push(box(0.5, 0.14, 0.35, 0.6, 0.99, 0.35, 0xf6c543));
    for (let x = -0.9; x <= 0.91; x += 0.3) p.push(cyl(0.08, 0.08, 0.18, x, 1.47, -0.95, 0xf2b33d, 8), cyl(0.085, 0.085, 0.03, x, 1.58, -0.95, CREAM, 8));
    return p;
  },
  flowers: () => {
    const p: THREE.BufferGeometry[] = [];
    for (const [x, c] of [[-0.7, 0xffc93c], [-0.15, 0xf27ba5], [0.45, 0xffffff], [0.85, 0xb892ff]] as const) {
      p.push(cyl(0.16, 0.13, 0.25, x, 1.04, 0.35, 0x9aa3ad, 10), ball(0.2, 0.17, 0.2, x, 1.3, 0.35, 0x5e9c42));
      p.push(ball(0.08, 0.05, 0.08, x - 0.08, 1.44, 0.4, c), ball(0.08, 0.05, 0.08, x + 0.08, 1.42, 0.3, c), ball(0.08, 0.05, 0.08, x, 1.48, 0.32, c));
    }
    for (const x of [-0.8, -0.3, 0.2, 0.7]) p.push(cyl(0.12, 0.1, 0.2, x, 1.48, -0.95, 0xc0704a, 8), ball(0.15, 0.13, 0.15, x, 1.65, -0.95, 0x5bae4a));
    return p;
  },
};

/** Market stall: counter, shelves, striped awning with a scalloped fringe and a sign. */
function stall(kind: StallKind): THREE.Group {
  const m = materials();
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-1.25, 1.25]) for (const z of [-0.85, 0.78]) parts.push(cyl(0.06, 0.06, 2.3, x, 1.15, z, CREAM, 8));
  parts.push(
    box(2.4, 0.85, 0.8, 0, 0.43, 0.35, 0xa87445), box(2.5, 0.08, 0.9, 0, 0.88, 0.35, 0xc69a6b),
    box(2.3, 0.06, 0.3, 0, 1.35, -0.95, 0xc69a6b), box(2.3, 0.06, 0.3, 0, 0.9, -0.95, 0xc69a6b), box(2.3, 1.2, 0.06, 0, 1.0, -1.1, 0x8e5f36),
    ...STALL_GOODS[kind](),
  );
  const awning = meshOf(new THREE.BoxGeometry(2.8, 0.07, 1.95), m.awning, 'awning');
  awning.position.set(0, 2.32, -0.08);
  awning.rotation.x = 0.16;
  const fringe = meshOf(new THREE.PlaneGeometry(2.8, 0.32), m.valance, 'fringe', false);
  fringe.position.set(0, 2.02, 0.88);
  const sign = meshOf(new THREE.PlaneGeometry(1.15, 0.43), new THREE.MeshLambertMaterial({ map: stallSign(kind).texture }), 'sign_face', false);
  sign.position.set(0, 0.48, 0.76);
  return group(`stall.${kind}`, vcMesh(parts, 'stall'), awning, fringe, sign);
}

/** Wooden wind pump: a slim tower, white blades with red tips and a red tail vane. */
function windmill(): THREE.Group {
  const WOOD = 0xc49a6c, BEAM = 0xa47650, RED = 0xe0534f, WHITE = 0xf7f3ea;
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(cyl(0.06, 0.08, 4.7, sx * 0.45, 2.3, sz * 0.45, WOOD, 8, -sz * 0.1, 0, sx * 0.1));
  for (const [i, y] of [0.8, 1.9, 3.0, 4.1].entries()) {
    const w = 1.02 - i * 0.12;
    parts.push(box(w, 0.07, 0.07, 0, y, 0.45 - i * 0.05, BEAM), box(w, 0.07, 0.07, 0, y, -0.45 + i * 0.05, BEAM));
    parts.push(box(0.07, 0.07, w, 0.45 - i * 0.05, y, 0, BEAM), box(0.07, 0.07, w, -0.45 + i * 0.05, y, 0, BEAM));
  }
  parts.push(box(0.6, 0.42, 0.62, 0, 4.66, 0, WHITE), box(0.7, 0.1, 0.72, 0, 4.92, 0, RED), box(0.06, 0.06, 1.4, 0, 4.65, -0.7, BEAM));
  parts.push(box(0.05, 0.62, 0.82, 0, 4.66, -1.42, RED), box(0.055, 0.14, 0.82, 0, 4.66, -1.42, WHITE));
  const bladeParts = [cyl(0.2, 0.2, 0.25, 0, 0, 0, RED, 14, Math.PI / 2), ball(0.12, 0.12, 0.12, 0, 0, 0.14, WHITE)];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    bladeParts.push(box(0.17, 0.95, 0.03, Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0, WHITE, 0, 0, a - Math.PI / 2));
    bladeParts.push(box(0.19, 0.26, 0.035, Math.cos(a) * 1.18, Math.sin(a) * 1.18, 0, RED, 0, 0, a - Math.PI / 2));
  }
  const blades = group('blades', vcMesh(bladeParts, 'blade'));
  blades.position.set(0, 4.6, 0.45);
  return group('windmill', vcMesh(parts, 'tower'), blades);
}

export function registerVillage(registry: AssetRegistry): void {
  registry.register('house.hut', hut);
  for (const kind of ['bread', 'honey', 'flowers'] as const) registry.register(`stall.${kind}`, () => stall(kind));
  registry.register('windmill', windmill);

  registry.register('mailbox', () =>
    group('mailbox', vcMesh([box(0.12, 0.9, 0.12, 0, 0.45, 0, 0x8a5a3c), box(0.38, 0.32, 0.55, 0, 1.02, 0, 0x5b8dd9), cyl(0.19, 0.19, 0.55, 0, 1.18, 0, 0x5b8dd9, 12, Math.PI / 2), box(0.04, 0.28, 0.14, 0.22, 1.22, 0.1, 0xe5484d)], 'mailbox')),
  );

  registry.register('barrel', () =>
    group('barrel', vcMesh([cyl(0.32, 0.32, 0.72, 0, 0.36, 0, 0xa0703f, 14), cyl(0.335, 0.335, 0.05, 0, 0.15, 0, 0x4a4a52, 14), cyl(0.335, 0.335, 0.05, 0, 0.57, 0, 0x4a4a52, 14), cyl(0.3, 0.3, 0.03, 0, 0.72, 0, 0xc69a6b, 14)], 'barrel')),
  );

  registry.register('sack', () => group('sack', vcMesh([ball(0.3, 0.36, 0.28, 0, 0.32, 0, 0xe3d3b0), cyl(0.08, 0.12, 0.12, 0, 0.68, 0, 0xc9b78f, 8)], 'sack')));

  // Park bench: wooden slats on dark iron sides with armrests.
  registry.register('bench', () => {
    const WOOD = 0xc69058, WOOD2 = 0xb47f4a, IRON_SIDE = 0x3a3a40;
    const p: THREE.BufferGeometry[] = [];
    [-0.15, 0, 0.15].forEach((z, i) => p.push(box(1.6, 0.05, 0.12, 0, 0.48, z + 0.02, i % 2 ? WOOD2 : WOOD)));
    [0.66, 0.83].forEach((y, i) => p.push(box(1.6, 0.11, 0.04, 0, y, -0.21 - (y - 0.6) * 0.14, i ? WOOD : WOOD2, -0.14)));
    for (const s of [-1, 1]) {
      const x = s * 0.74;
      p.push(box(0.06, 0.48, 0.06, x, 0.24, 0.17, IRON_SIDE), box(0.06, 0.98, 0.06, x, 0.49, -0.21, IRON_SIDE, -0.14));
      p.push(box(0.06, 0.05, 0.46, x, 0.64, -0.01, IRON_SIDE), box(0.05, 0.05, 0.42, x, 0.3, -0.02, IRON_SIDE), dot(0.05, 0.05, 0.05, x, 0.645, 0.22, IRON_SIDE));
    }
    return group('bench', vcMesh(p, 'bench'));
  });

  for (const [name, color] of [['crate.orange', 0xf39a2b], ['crate.apple', 0xe5383b]] as const) {
    registry.register(name, () => {
      const p = [box(0.62, 0.36, 0.46, 0, 0.18, 0, 0x6e9e58), box(0.64, 0.05, 0.48, 0, 0.37, 0, 0x5e8a4a)];
      for (let k = 0; k < 6; k++) p.push(ball(0.1, 0.1, 0.1, -0.2 + (k % 3) * 0.2, 0.42, -0.1 + Math.floor(k / 3) * 0.2, color));
      return group(name, vcMesh(p, 'crate'));
    });
  }

  registry.register('lamp.globe', () => {
    const globe = meshOf(new THREE.SphereGeometry(0.26, 16, 12), materials().globe, 'lamp');
    globe.position.y = 2.85;
    return group('lamp.globe', vcMesh([cyl(0.14, 0.18, 0.2, 0, 0.1, 0, IRON, 10), cyl(0.05, 0.05, 2.4, 0, 1.3, 0, IRON, 8), cyl(0.1, 0.07, 0.14, 0, 2.55, 0, IRON, 10)], 'post'), globe);
  });

  // One unit of hedge (about 1 x 1); the world lines up copies along each hedge. Rounded edges and
  // a lumpy top, darker near the ground.
  registry.register('hedge.block', () => {
    const parts = [bake(new RoundedBoxGeometry(1, 0.74, 1, 2, 0.2).translate(0, 0.37, 0), {})];
    for (const [x, z, r] of [[-0.3, 0.08, 0.32], [0.26, -0.08, 0.34], [0, 0.02, 0.3]] as const) {
      parts.push(bake(new THREE.SphereGeometry(1, 10, 6), { x, y: 0.7, z, sx: r, sy: 0.2, sz: 0.42 }));
    }
    const g = shade(merge(parts), { y0: 0, y1: 0.95, dark: 0.55, light: 1.12, center: new THREE.Vector3(0, 0.45, 0) });
    return group('hedge.block', meshOf(g, materials().hedge, 'hedge'));
  });

  registry.register('table.cafe', () => {
    const p = [
      cyl(0.5, 0.5, 0.05, 0, 0.75, 0, 0xf4f1ea, 20), cyl(0.04, 0.04, 0.7, 0, 0.38, 0, 0x3a3a40, 6), cyl(0.25, 0.25, 0.04, 0, 0.03, 0, 0x3a3a40, 12),
      ball(0.18, 0.07, 0.18, -0.15, 0.81, 0, 0xf4f1ea), ball(0.13, 0.05, 0.13, -0.15, 0.84, 0, 0xf08a2b), box(0.24, 0.08, 0.16, 0.2, 0.81, 0.1, 0xe3c48a),
    ];
    for (const s of [-1, 1]) {
      const cx = s * 0.85;
      p.push(box(0.42, 0.05, 0.42, cx, 0.45, 0, 0xc0c3c7), box(0.05, 0.45, 0.42, cx + s * 0.2, 0.68, 0, 0xc0c3c7));
      for (const dx of [-0.17, 0.17]) for (const dz of [-0.17, 0.17]) p.push(box(0.04, 0.44, 0.04, cx + dx, 0.22, dz, 0x8e9196));
    }
    return group('table.cafe', vcMesh(p, 'table'));
  });

  registry.register('plant.potted', () =>
    group('plant.potted', vcMesh([cyl(0.3, 0.24, 0.45, 0, 0.23, 0, 0xc0704a, 14), ball(0.45, 0.55, 0.45, 0, 0.9, 0, 0x4e9a44), ball(0.3, 0.35, 0.3, 0.25, 1.25, 0.1, 0x5bae4a)], 'plant')),
  );

  // Brick silo with a teal cone roof, metal bands, a door, a little window and a ladder.
  registry.register('silo', () => {
    const tower = meshOf(new THREE.CylinderGeometry(1.1, 1.1, 3.4, 28), materials().brick, 'silo');
    tower.position.y = 1.7;
    const ROOF = 0x5f9ea0, TRIM = 0xeee6d3, METAL = 0x8a8f94;
    const p = [
      cone(1.34, 1.05, 0, 3.95, 0, ROOF, 28), cyl(1.22, 1.22, 0.14, 0, 3.45, 0, TRIM, 28), ball(0.16, 0.16, 0.16, 0, 4.5, 0, TRIM),
      cyl(1.125, 1.125, 0.08, 0, 1.15, 0, METAL, 28), cyl(1.125, 1.125, 0.08, 0, 2.35, 0, METAL, 28),
      box(0.76, 1.08, 0.06, 0, 0.6, 1.08, TRIM), box(0.62, 0.95, 0.1, 0, 0.55, 1.1, DOOR), box(0.05, 0.9, 0.11, 0, 0.55, 1.11, DOOR_DARK),
      box(0.46, 0.46, 0.06, 0, 2.85, 1.08, TRIM), box(0.34, 0.34, 0.08, 0, 2.85, 1.1, 0x3d5a6b),
    ];
    for (const dz of [-0.17, 0.17]) p.push(box(0.05, 3.1, 0.05, 1.15, 1.75, dz, METAL));
    for (let y = 0.5; y < 3.2; y += 0.35) p.push(box(0.04, 0.04, 0.34, 1.15, y, 0, METAL));
    return group('silo', tower, vcMesh(p, 'roof'));
  });

  // Beehive: two boxes, a little gable roof, a landing board and a bee.
  registry.register('beehive', () => {
    const BOX = 0xf6f0e2, ROOF = 0xc98552, HONEY = 0xf2b33d;
    const p = [
      box(0.7, 0.5, 0.6, 0, 0.27, 0, BOX), box(0.74, 0.06, 0.64, 0, 0.53, 0, HONEY), box(0.66, 0.4, 0.56, 0, 0.76, 0, BOX),
      box(0.46, 0.06, 0.8, -0.2, 1.08, 0, ROOF, 0, 0, 0.5), box(0.46, 0.06, 0.8, 0.2, 1.08, 0, ROOF, 0, 0, -0.5),
      box(0.4, 0.2, 0.04, 0, 1.03, 0.29, BOX), box(0.36, 0.04, 0.12, 0, 0.06, 0.35, 0x8a5a34), box(0.22, 0.05, 0.02, 0, 0.1, 0.305, 0x5a3b22),
      box(0.03, 0.12, 0.02, 0.18, 0.5, 0.305, HONEY), dot(0.035, 0.05, 0.03, 0.18, 0.43, 0.31, HONEY),
    ];
    // A bee resting on the roof edge.
    p.push(dot(0.07, 0.06, 0.09, 0.22, 1.2, 0.25, 0xffd23f), box(0.145, 0.03, 0.035, 0.22, 1.2, 0.25, 0x3a2a20), dot(0.05, 0.015, 0.035, 0.18, 1.27, 0.24, 0xffffff), dot(0.05, 0.015, 0.035, 0.27, 1.27, 0.24, 0xffffff));
    return group('beehive', vcMesh(p, 'beehive'));
  });

  // Origin at the water line.
  registry.register('boat', () =>
    group('boat', vcMesh([box(1.9, 0.5, 1.05, 0, 0.18, 0, 0xd9694f), box(1.7, 0.08, 0.82, 0, 0.4, 0, 0xf2e3cc), box(0.3, 0.1, 0.95, 0.2, 0.48, 0, 0xb8875a), cyl(0.52, 0.52, 0.5, -1.05, 0.18, 0, 0xd9694f, 3, 0, Math.PI / 2, 0)], 'boat')),
  );

  // The companion pet: a round white bunny with big shiny eyes, pink cheeks and a puff tail.
  registry.register('pet.bunny', () => {
    const W = 0xffffff, PINK = 0xf7b6c8, INK = 0x2a1e1e;
    const p = [
      ball(0.36, 0.32, 0.36, 0, 0.34, 0, W),
      ball(0.08, 0.26, 0.06, -0.13, 0.78, -0.02, W, 0, 0, 0.2), ball(0.08, 0.26, 0.06, 0.13, 0.78, -0.02, W, 0, 0, -0.2),
      ball(0.045, 0.18, 0.03, -0.13, 0.78, 0.03, PINK, 0, 0, 0.2), ball(0.045, 0.18, 0.03, 0.13, 0.78, 0.03, PINK, 0, 0, -0.2),
      ball(0.1, 0.1, 0.1, 0, 0.3, -0.36, W),
      ball(0.09, 0.05, 0.12, -0.15, 0.04, 0.2, W), ball(0.09, 0.05, 0.12, 0.15, 0.04, 0.2, W),
      dot(0.035, 0.028, 0.03, 0, 0.36, 0.355, PINK),
    ];
    for (const s of [-1, 1]) {
      p.push(dot(0.06, 0.07, 0.04, s * 0.13, 0.43, 0.3, INK), dot(0.022, 0.022, 0.015, s * 0.13 + 0.02, 0.455, 0.335, W));
      p.push(dot(0.06, 0.035, 0.03, s * 0.21, 0.33, 0.285, PINK));
    }
    return group('pet.bunny', vcMesh(p, 'pet'));
  });
}
