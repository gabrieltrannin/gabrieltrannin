import * as THREE from 'three';
import { HOUSE_SIZE, MUSEUM, OLD_BRIDGE_GAP, SEED_SHOP } from '../../data/village';
import { VILLAGERS } from '../../data/villagers';
import { materials } from '../../render/materials';
import { paintSign } from '../../render/textures';
import type { AssetRegistry } from '../registry';
import { box, cyl, dot, group, meshOf, torus, vcMesh } from './parts';
import { gable } from './work';

/**
 * Stage 4 buildings: a cottage for each villager (in their colors), the museum, Flora's seed shop,
 * the notice board, the well, Lino's sign and the two bridges. Origins on the ground, fronts facing +z.
 */

const WOOD = 0xa87445;
const WOOD_DARK = 0x6e4a2e;
const CREAM = 0xf6efdd;
const STONE = 0xb4ab9c;

/** Wall, roof and door colors of each villager's cottage. */
const HOUSE_COLORS: Record<string, [number, number, number]> = {
  lumi: [0xf6e3c4, 0xe8833a, 0x9c5a2e], pipo: [0x9ec9db, 0x3e7a8a, 0xf2c14e], celeste: [0xd9cbe8, 0x7c4da6, 0x5a3a2a],
  bento: [0xb4ab9c, 0x5e4a42, 0x7a4e2c], flora: [0xcdebc0, 0xf2c14e, 0xf27ba5], dudu: [0xf2d49a, 0xa0703f, 0x6e4a2e],
  margo: [0xf7d3e0, 0xb892ff, 0xffffff], tico: [0xcfe0f5, 0x5b8dd9, 0xe5484d], juca: [0xc8e6a0, 0x5e9c42, 0xf2b33d],
  lino: [0xe3d3b0, 0x8a6a4a, 0x5e9c42], perola: [0xf4f1ea, 0x3e5c8a, 0xd9537d], nico: [0xf5c9a0, 0xc46a2e, 0x6b4f3f],
};

function signTexture(label: string, icon: string, style: 'crop' | 'stall', w = 256, h = 96): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paintSign(canvas, label, icon, style);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function cottage(npc: string, icon: string): THREE.Group {
  const [wall, roof, door] = HOUSE_COLORS[npc] ?? [CREAM, 0xc8553d, WOOD_DARK];
  const { w: W, d: D } = HOUSE_SIZE;
  const H = 1.45;
  const p = [
    box(W + 0.12, 0.18, D + 0.12, 0, 0.09, 0, STONE), box(W, H, D, 0, 0.18 + H / 2, 0, wall),
    ...gable(W, D, 0.18 + H, 0.85, roof, 0.22),
    box(0.1, 0.12, D + 0.5, 0, 0.18 + H + 0.86, 0, roof),
    bake3(W, D, H, wall),
    // Door with a frame and a step.
    box(0.62, 0.95, 0.06, 0, 0.66, D / 2 + 0.02, door), box(0.74, 0.08, 0.08, 0, 1.15, D / 2 + 0.04, CREAM),
    dot(0.035, 0.035, 0.03, 0.2, 0.65, D / 2 + 0.07, 0xf2c14e), box(0.9, 0.08, 0.4, 0, 0.04, D / 2 + 0.22, STONE),
    // Chimney, flower box and a little lamp.
    box(0.26, 0.6, 0.26, W * 0.28, 0.18 + H + 0.6, -0.25, 0x9a8f80),
    box(0.62, 0.14, 0.16, -0.75, 0.62, D / 2 + 0.08, WOOD), dot(0.06, 0.05, 0.06, -0.92, 0.73, D / 2 + 0.1, 0xf27ba5), dot(0.06, 0.05, 0.06, -0.75, 0.74, D / 2 + 0.1, 0xffd166), dot(0.06, 0.05, 0.06, -0.58, 0.73, D / 2 + 0.1, 0xffffff),
  ];
  // Window frames (the glass is a night-glow mesh).
  const glass: THREE.BufferGeometry[] = [];
  for (const x of [-0.75, 0.75]) {
    p.push(box(0.56, 0.5, 0.06, x, 1.05, D / 2 + 0.02, CREAM), box(0.04, 0.42, 0.07, x, 1.05, D / 2 + 0.04, WOOD_DARK), box(0.46, 0.04, 0.07, x, 1.05, D / 2 + 0.04, WOOD_DARK));
    glass.push(box(0.46, 0.4, 0.04, x, 1.05, D / 2 + 0.035, 0xffffff));
  }
  const windows = new THREE.Mesh(vcMesh(glass).geometry, materials().window);
  windows.name = 'window';
  const sign = meshOf(new THREE.CircleGeometry(0.2, 20), new THREE.MeshLambertMaterial({ map: signTexture('', icon, 'crop', 96, 96) }), 'sign_face', false);
  sign.position.set(0, 1.42, D / 2 + 0.05);
  return group(`house.${npc}`, vcMesh(p, 'house'), windows, sign);
}

/** Triangle walls under the gable roof (front and back). */
function bake3(W: number, D: number, H: number, color: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0);
  shape.lineTo(W / 2, 0);
  shape.lineTo(0, 0.85);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
  g.translate(0, 0.18 + H, -D / 2);
  const geometry = g.toNonIndexed();
  const count = geometry.attributes.position!.count;
  const c = new THREE.Color(color);
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Array.from({ length: count }, () => [c.r, c.g, c.b]).flat()), 3));
  geometry.deleteAttribute('uv');
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  return geometry;
}

function museum(): THREE.Group {
  const { w: W, d: D } = MUSEUM;
  const H = 2.3, COL = 0xf4f1ea;
  const p = [
    box(W + 0.4, 0.2, D + 0.4, 0, 0.1, 0, STONE), box(W, H, D - 0.6, 0, 0.2 + H / 2, -0.3, 0xe9e2d0),
    ...[0.2, 0.36, 0.52].map((y, i) => box(2.4 - i * 0.2, 0.16, 0.5, 0, y - 0.08, D / 2 + 0.25 - i * 0.18, STONE)),
    ...[-2.4, -1.2, 1.2, 2.4].map(x => cyl(0.16, 0.18, H, x, 0.2 + H / 2, D / 2 - 0.35, COL, 12)),
    box(W + 0.2, 0.22, D, 0, 0.2 + H + 0.11, 0, 0xd9cfba),
    box(0.9, 1.4, 0.06, 0, 0.9, D / 2 - 0.58, 0x6e4a2e),
  ];
  // Pediment.
  const tri = new THREE.Shape();
  tri.moveTo(-W / 2 - 0.1, 0);
  tri.lineTo(W / 2 + 0.1, 0);
  tri.lineTo(0, 0.9);
  tri.closePath();
  const pediment = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: D, bevelEnabled: false }), new THREE.MeshLambertMaterial({ color: 0xe0d6c0 }));
  pediment.position.set(0, 0.2 + H + 0.22, -D / 2);
  pediment.castShadow = pediment.receiveShadow = true;
  const sign = meshOf(new THREE.PlaneGeometry(1.8, 0.5), new THREE.MeshLambertMaterial({ map: signTexture('MUSEU', '🦴', 'crop', 320, 90) }), 'sign_face', false);
  sign.position.set(0, 0.2 + H + 0.45, D / 2 + 0.01);
  const closed = vcMesh([
    box(1.1, 0.12, 0.06, 0, 1.0, D / 2 - 0.5, WOOD, 0, 0, 0.3), box(1.1, 0.12, 0.06, 0, 1.4, D / 2 - 0.5, WOOD, 0, 0, -0.25),
    ...[-2.9, 2.9].map(x => cyl(0.04, 0.04, 2.6, x, 1.3, D / 2 + 0.1, 0xc9a06b, 6)), box(6.0, 0.06, 0.06, 0, 2.5, D / 2 + 0.1, 0xc9a06b),
  ], 'only:closed');
  const open = vcMesh([
    box(0.08, 1.2, 0.08, -0.9, 0.8, D / 2 + 0.5, 0x8e6a4a), box(0.5, 0.8, 0.03, -0.9, 1.45, D / 2 + 0.5, 0x3e5c8a),
    box(0.08, 1.2, 0.08, 0.9, 0.8, D / 2 + 0.5, 0x8e6a4a), box(0.5, 0.8, 0.03, 0.9, 1.45, D / 2 + 0.5, 0xd9537d),
  ], 'only:open');
  return group('museum', vcMesh(p, 'museum'), pediment, sign, closed, open);
}

function seedShop(): THREE.Group {
  const { w: W, d: D } = SEED_SHOP;
  const p = [
    box(W, 1.7, D, 0, 0.85, 0, 0xcdebc0), ...gable(W, D, 1.7, 0.7, 0x5e9c42, 0.2),
    box(W - 0.4, 0.8, 0.5, 0, 0.4, D / 2 + 0.25, WOOD), box(W - 0.3, 0.06, 0.6, 0, 0.82, D / 2 + 0.25, 0xd9b48a),
  ];
  const colors = [0xf27ba5, 0xffd166, 0x7cc35a, 0xf08a2b, 0xb892ff, 0xe5483b];
  colors.forEach((c, i) => p.push(box(0.2, 0.26, 0.03, -1.0 + i * 0.4, 0.98, D / 2 + 0.3, c)));
  const awning = meshOf(new THREE.BoxGeometry(W + 0.2, 0.06, 0.9), materials().awning, 'awning');
  awning.position.set(0, 1.55, D / 2 + 0.4);
  awning.rotation.x = 0.25;
  const sign = meshOf(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshLambertMaterial({ map: signTexture('SEMENTES', '🌱', 'stall') }), 'sign_face', false);
  sign.position.set(0, 1.95, D / 2 + 0.02);
  return group('shop.seeds', vcMesh(p, 'shop'), awning, sign);
}

function noticeBoard(): THREE.Group {
  const p = [
    ...[-0.6, 0.6].map(x => cyl(0.06, 0.07, 1.8, x, 0.9, 0, WOOD_DARK, 8)), box(1.4, 0.95, 0.08, 0, 1.25, 0, 0xc69a6b), box(1.55, 0.08, 0.3, 0, 1.82, 0, 0x8e5f36),
  ];
  const papers: [number, number, number][] = [[-0.4, 1.45, 0xfff6de], [0.05, 1.5, 0xffe3e3], [0.45, 1.38, 0xe3f2ff], [-0.25, 1.05, 0xfff6de], [0.3, 1.02, 0xe8f6dc]];
  for (const [x, y, c] of papers) p.push(box(0.32, 0.36, 0.02, x, y, 0.05, c), dot(0.025, 0.025, 0.02, x, y + 0.15, 0.065, 0xe5484d));
  return group('board.notices', vcMesh(p, 'board'));
}

function well(): THREE.Group {
  return group('well', vcMesh([
    cyl(0.55, 0.6, 0.7, 0, 0.35, 0, STONE, 16), cyl(0.45, 0.45, 0.04, 0, 0.66, 0, 0x4fa3c0, 16), torus(0.52, 0.06, 0, 0.72, 0, 0xa9a39a, Math.PI / 2),
    ...[-0.5, 0.5].map(x => box(0.08, 1.3, 0.08, x, 1.0, 0, WOOD_DARK)), ...gable(1.2, 0.8, 1.6, 0.4, 0xc8553d, 0.1), cyl(0.04, 0.04, 1.0, 0, 1.4, 0, WOOD, 6, 0, 0, Math.PI / 2),
    cyl(0.12, 0.1, 0.18, 0.15, 1.1, 0, WOOD, 8),
  ], 'well'));
}

function bridgeSign(): THREE.Group {
  const face = meshOf(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshLambertMaterial({ map: signTexture('EM OBRAS', '🔨', 'crop', 256, 128) }), 'sign_face', false);
  face.position.set(0, 1.05, 0.04);
  return group('bridge.sign', vcMesh([box(0.1, 1.2, 0.1, 0, 0.6, -0.02, WOOD_DARK), box(1.0, 0.55, 0.05, 0, 1.05, 0, WOOD)], 'post'), face);
}

/** A wooden bridge of length `length` along +x, deck at the origin height; gap = missing planks (old bridge). */
function bridge(length: number, gap?: readonly [number, number]): THREE.Group {
  const planks: THREE.BufferGeometry[] = [], fixedPlanks: THREE.BufferGeometry[] = [];
  for (let x = 0.2; x < length; x += 0.42) {
    const inGap = gap && x > gap[0] && x < gap[1];
    (inGap ? fixedPlanks : planks).push(box(0.38, 0.1, 1.45, x, -0.05, 0, (Math.round(x * 3) % 2 ? 0xb8875a : 0xa87445)));
  }
  const rails: THREE.BufferGeometry[] = [];
  for (const z of [-0.72, 0.72]) {
    for (let x = 0.1; x <= length; x += 1.5) rails.push(box(0.1, 0.8, 0.1, x, 0.35, z, WOOD_DARK), cyl(0.09, 0.09, 1.8, x, -0.9, z, 0x7a563a, 8));
    rails.push(box(length, 0.08, 0.08, length / 2, 0.72, z, WOOD));
  }
  const g = group('bridge', vcMesh(planks, 'deck'), vcMesh(rails, 'rails'));
  if (fixedPlanks.length) g.add(vcMesh(fixedPlanks, 'only:fixed'));
  return g;
}

export function registerTown(registry: AssetRegistry): void {
  for (const v of VILLAGERS) registry.register(`house.${v.id}`, () => cottage(v.id, v.icon));
  registry.register('museum', museum);
  registry.register('shop.seeds', seedShop);
  registry.register('board.notices', noticeBoard);
  registry.register('well', well);
  registry.register('bridge.sign', bridgeSign);
  registry.register('bridge.new', () => bridge(9.2));
  registry.register('bridge.old', () => bridge(7.0, [OLD_BRIDGE_GAP.z0 + 18.9 - 0.2, OLD_BRIDGE_GAP.z1 + 18.9 + 0.2]));
}
