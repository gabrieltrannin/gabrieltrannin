import * as THREE from 'three';
import { materials } from '../../render/materials';
import type { AssetRegistry } from '../registry';
import { ball, box, cone, cyl, dot, group, meshOf, merge, torus, vcMesh } from './parts';

/**
 * Stage 5: furniture and decorations ("decor.<name>"), the player's market cart, the newcomers' tents,
 * the rooms the house grows and the pet's dig mound. Every decoration stands on its footprint's middle,
 * on the floor, facing +z (the front). Glowing parts are named "lamp" and use the night-glow material.
 */

const WOOD = 0xc69058, WOOD2 = 0xa8743f, DARK = 0x7a4f2e, CREAM = 0xf6ebd9, WHITE = 0xfaf7f0, PINK = 0xe8708f, ROSE = 0xf7b6c8;
const MINT = 0x9adbb5, BLUE = 0x5b8dd9, SKY = 0x8fd3f4, YELLOW = 0xf2c14e, RED = 0xe5484d, GREEN = 0x5e9c42, LEAF = 0x7cc45e;
const STONE = 0xb8b2a6, STONE2 = 0x9c968b, METAL = 0x4a4a52, GOLD = 0xe2b33c, SAND = 0xeed9a8, HAY = 0xe6c46a;

type Parts = THREE.BufferGeometry[];
const one = (name: string, parts: Parts, glow?: Parts): THREE.Group => {
  const g = group(name, vcMesh(parts, 'body'));
  if (glow?.length) {
    const lamp = meshOf(merge(glow), materials().globe, 'lamp', false);
    g.add(lamp);
  }
  return g;
};
/** Four legs under a top at height h. */
const legs = (w: number, d: number, h: number, color: number, r = 0.035): Parts =>
  [-1, 1].flatMap(sx => [-1, 1].map(sz => cyl(r, r, h, sx * (w / 2 - 0.06), h / 2, sz * (d / 2 - 0.06), color, 6)));

const FURNITURE: Record<string, () => THREE.Object3D> = {
  bed: () => one('bed', [
    box(1.7, 0.28, 1.8, 0, 0.26, 0.05, WOOD), ...legs(1.7, 1.8, 0.14, DARK, 0.05),
    box(1.62, 0.18, 1.7, 0, 0.48, 0.07, WHITE), box(1.64, 0.14, 1.15, 0, 0.6, 0.36, PINK),
    box(1.64, 0.04, 0.2, 0, 0.68, -0.18, WHITE), ball(0.34, 0.12, 0.22, -0.4, 0.66, -0.6, WHITE), ball(0.34, 0.12, 0.22, 0.4, 0.66, -0.6, WHITE),
    box(1.8, 0.9, 0.1, 0, 0.55, -0.88, WOOD2), box(1.8, 0.08, 0.14, 0, 1.02, -0.88, DARK),
  ]),
  table: () => one('table', [box(1.8, 0.08, 0.86, 0, 0.72, 0, WOOD), ...legs(1.7, 0.78, 0.7, WOOD2, 0.05), box(1.6, 0.06, 0.05, 0, 0.62, 0.36, WOOD2)]),
  chair: () => one('chair', [
    box(0.5, 0.06, 0.5, 0, 0.44, 0, WOOD), ...legs(0.48, 0.48, 0.44, WOOD2), box(0.5, 0.5, 0.06, 0, 0.72, -0.23, WOOD2),
    box(0.44, 0.05, 0.44, 0, 0.49, 0.01, PINK),
  ]),
  sofa: () => one('sofa', [
    box(1.8, 0.32, 0.8, 0, 0.28, 0.02, BLUE), box(1.8, 0.5, 0.22, 0, 0.6, -0.3, BLUE),
    box(0.2, 0.42, 0.8, -0.86, 0.48, 0.02, BLUE), box(0.2, 0.42, 0.8, 0.86, 0.48, 0.02, BLUE),
    ball(0.38, 0.12, 0.32, -0.4, 0.5, 0.06, SKY), ball(0.38, 0.12, 0.32, 0.4, 0.5, 0.06, SKY), ball(0.18, 0.18, 0.08, 0.55, 0.66, -0.12, YELLOW),
    ...legs(1.7, 0.7, 0.12, DARK, 0.04),
  ]),
  bookshelf: () => {
    const p: Parts = [box(1.8, 1.7, 0.4, 0, 0.85, -0.05, WOOD2), box(1.66, 1.56, 0.06, 0, 0.85, -0.22, DARK)];
    const colors = [RED, BLUE, YELLOW, GREEN, PINK, CREAM, 0x8e5bbe];
    for (const y of [0.35, 0.85, 1.35]) {
      p.push(box(1.7, 0.05, 0.36, 0, y - 0.2, -0.03, WOOD));
      for (let i = 0; i < 9; i++) if ((i * 7 + y * 10) % 4 > 0.6) p.push(box(0.12, 0.34 + (i % 3) * 0.04, 0.26, -0.72 + i * 0.18, y - 0.01, -0.05, colors[(i + Math.round(y * 3)) % colors.length]!));
    }
    return one('bookshelf', p);
  },
  lamp: () => one('lamp', [cyl(0.16, 0.2, 0.06, 0, 0.03, 0, DARK, 10), cyl(0.03, 0.03, 1.2, 0, 0.62, 0, METAL, 6)], [cyl(0.16, 0.26, 0.3, 0, 1.3, 0, CREAM, 14)]),
  rug: () => {
    const p: Parts = [cyl(0.92, 0.92, 0.02, 0, 0.012, 0, ROSE, 28)];
    p.push(torus(0.7, 0.03, 0, 0.026, 0, PINK, Math.PI / 2), torus(0.4, 0.03, 0, 0.026, 0, WHITE, Math.PI / 2), cyl(0.18, 0.18, 0.022, 0, 0.026, 0, PINK, 14));
    return group('rug', vcMesh(p, 'body', false));
  },
  plant: () => one('plant', [
    cyl(0.2, 0.15, 0.32, 0, 0.16, 0, 0xc0704a, 12), cyl(0.21, 0.21, 0.04, 0, 0.32, 0, 0xa95f3d, 12),
    ball(0.28, 0.3, 0.28, 0, 0.6, 0, GREEN), ball(0.18, 0.22, 0.18, 0.15, 0.78, 0.05, LEAF), ball(0.16, 0.2, 0.16, -0.14, 0.74, -0.04, LEAF),
  ]),
  wardrobe: () => one('wardrobe', [
    box(1.6, 1.9, 0.6, 0, 0.95, -0.1, WOOD), box(1.68, 0.1, 0.68, 0, 1.92, -0.1, WOOD2), box(0.76, 1.6, 0.04, -0.4, 0.98, 0.21, 0xd9a876),
    box(0.76, 1.6, 0.04, 0.4, 0.98, 0.21, 0xd9a876), dot(0.04, 0.06, 0.03, -0.06, 1.0, 0.24, GOLD), dot(0.04, 0.06, 0.03, 0.06, 1.0, 0.24, GOLD),
    ...legs(1.5, 0.5, 0.06, DARK),
  ]),
  mirror: () => one('mirror', [
    box(0.5, 0.06, 0.3, 0, 0.03, -0.1, WOOD2), box(0.06, 1.5, 0.06, -0.26, 0.8, -0.1, WOOD2), box(0.06, 1.5, 0.06, 0.26, 0.8, -0.1, WOOD2),
    cyl(0.28, 0.28, 0.06, 0, 1.0, -0.1, WOOD, 20, Math.PI / 2), cyl(0.23, 0.23, 0.07, 0, 1.0, -0.09, 0xcfe8f5, 20, Math.PI / 2),
    box(0.06, 0.3, 0.075, -0.08, 1.06, -0.06, WHITE, 0, 0, 0.5),
  ]),
  workbench: () => one('workbench', [
    box(1.8, 0.1, 0.8, 0, 0.8, 0, WOOD), ...legs(1.7, 0.7, 0.8, WOOD2, 0.06), box(1.6, 0.06, 0.6, 0, 0.25, 0, WOOD2),
    box(0.3, 0.12, 0.16, -0.5, 0.91, 0.05, RED), box(0.06, 0.04, 0.4, -0.1, 0.87, 0.1, METAL), box(0.12, 0.1, 0.1, -0.1, 0.89, 0.3, DARK),
    box(0.4, 0.06, 0.1, 0.5, 0.88, -0.2, WOOD2), cyl(0.08, 0.08, 0.2, 0.55, 0.36, 0.1, 0x8a8a90, 8),
  ]),
  stove: () => one('stove', [
    box(0.86, 0.82, 0.76, 0, 0.41, -0.02, 0xf4f1ea), box(0.88, 0.05, 0.78, 0, 0.84, -0.02, METAL), box(0.6, 0.36, 0.04, 0, 0.42, 0.37, 0x3a3a40),
    box(0.5, 0.04, 0.05, 0, 0.66, 0.37, GOLD), cyl(0.14, 0.14, 0.04, -0.2, 0.88, 0.05, 0x2b2b30, 12), cyl(0.12, 0.12, 0.04, 0.2, 0.88, -0.12, 0x2b2b30, 12),
    cyl(0.15, 0.13, 0.16, -0.2, 0.98, 0.05, RED, 12), box(0.86, 0.3, 0.06, 0, 1.0, -0.38, 0xf4f1ea),
  ]),
  loom: () => one('loom', [
    box(0.8, 0.06, 0.6, 0, 0.66, 0, WOOD), ...legs(0.76, 0.56, 0.66, WOOD2, 0.04), box(0.06, 0.6, 0.06, -0.34, 0.98, -0.2, WOOD2), box(0.06, 0.6, 0.06, 0.34, 0.98, -0.2, WOOD2),
    box(0.74, 0.06, 0.06, 0, 1.26, -0.2, WOOD2), box(0.62, 0.44, 0.02, 0, 1.0, -0.2, PINK), ball(0.12, 0.12, 0.12, -0.2, 0.78, 0.12, MINT), ball(0.1, 0.1, 0.1, 0.08, 0.76, 0.16, YELLOW),
    cyl(0.01, 0.01, 0.3, 0.2, 0.8, 0.14, METAL, 4, 0.5),
  ]),
  alchemy: () => one('alchemy', [
    box(0.84, 0.06, 0.64, 0, 0.7, 0, DARK), ...legs(0.8, 0.6, 0.7, DARK, 0.04), cyl(0.12, 0.16, 0.3, -0.22, 0.88, 0, 0x7fd1b9, 10),
    ball(0.13, 0.13, 0.13, 0.12, 0.85, 0.05, 0xb892ff), cyl(0.03, 0.03, 0.16, 0.12, 1.0, 0.05, 0xb892ff, 6), cyl(0.05, 0.06, 0.18, 0.3, 0.82, -0.15, 0xf27ba5, 8),
    box(0.3, 0.2, 0.04, 0.05, 0.84, -0.26, CREAM),
  ], [ball(0.06, 0.06, 0.06, 0.12, 0.85, 0.12, 0xe0ffd0)]),
  jeweler: () => one('jeweler', [
    box(0.84, 0.7, 0.62, 0, 0.35, 0, WOOD2), box(0.88, 0.06, 0.66, 0, 0.73, 0, DARK), box(0.36, 0.12, 0.04, 0, 0.42, 0.31, WOOD),
    box(0.3, 0.14, 0.2, -0.2, 0.83, -0.08, 0x3e5c8a), dot(0.05, 0.05, 0.05, -0.25, 0.92, -0.05, 0x9be7ff), dot(0.05, 0.05, 0.05, -0.14, 0.92, -0.05, GOLD),
    cyl(0.02, 0.02, 0.3, 0.26, 0.9, -0.15, METAL, 6), cyl(0.08, 0.08, 0.03, 0.26, 1.05, -0.1, 0xcfe8f5, 12, Math.PI / 2),
  ]),
  beachChair: () => one('beachChair', [
    box(0.08, 0.3, 1.6, -0.3, 0.15, 0.1, WHITE), box(0.08, 0.3, 1.6, 0.3, 0.15, 0.1, WHITE), box(0.6, 0.04, 1.3, 0, 0.3, 0.25, 0xf27b8f),
    box(0.6, 0.04, 0.7, 0, 0.55, -0.55, 0xf27b8f, -0.9), box(0.62, 0.05, 0.08, 0, 0.32, 0.6, WHITE), box(0.62, 0.05, 0.08, 0, 0.32, 0.1, WHITE),
  ]),
  parasol: () => one('parasol', [
    cyl(0.03, 0.03, 2.0, 0, 1.0, 0, WHITE, 6), cyl(0.18, 0.2, 0.08, 0, 0.04, 0, SAND, 10),
    cone(0.9, 0.35, 0, 2.0, 0, 0xf27b8f, 8), dot(0.05, 0.05, 0.05, 0, 2.2, 0, WHITE),
    ...Array.from({ length: 4 }, (_, i) => box(0.12, 0.05, 0.9, Math.sin((i * Math.PI) / 2) * 0.45, 1.9, Math.cos((i * Math.PI) / 2) * 0.45, WHITE, 0.32, (i * Math.PI) / 2, 0)),
  ]),
  surfboard: () => one('surfboard', [ball(0.22, 0.8, 0.06, 0, 0.82, -0.2, 0x4ac5d6, -0.12), box(0.05, 1.3, 0.065, 0, 0.82, -0.18, WHITE, -0.12), cyl(0.04, 0.04, 0.1, 0, 0.05, -0.12, SAND, 6)]),
  shellLamp: () => one('shellLamp', [cyl(0.12, 0.16, 0.08, 0, 0.04, 0, STONE, 10), cyl(0.025, 0.025, 0.7, 0, 0.42, 0, WHITE, 6)], [ball(0.24, 0.2, 0.14, 0, 0.86, 0, 0xffd8e0), ball(0.2, 0.06, 0.12, 0, 0.98, 0.02, 0xf9b8c8)]),
  sandcastle: () => one('sandcastle', [
    box(0.7, 0.3, 0.7, 0, 0.15, 0, SAND), cyl(0.12, 0.14, 0.5, -0.28, 0.25, -0.28, SAND, 8), cyl(0.12, 0.14, 0.5, 0.28, 0.25, -0.28, SAND, 8),
    cyl(0.16, 0.18, 0.6, 0, 0.45, 0.02, 0xe4cc95, 10), cone(0.18, 0.2, 0, 0.85, 0.02, 0xe4cc95, 10), cyl(0.008, 0.008, 0.25, 0, 1.05, 0.02, DARK, 4),
    box(0.14, 0.08, 0.01, 0.07, 1.12, 0.02, RED), box(0.14, 0.16, 0.04, 0, 0.12, 0.35, 0xc9a96a),
  ]),
  lifebuoy: () => one('lifebuoy', [
    box(0.06, 1.1, 0.06, -0.3, 0.55, -0.1, WOOD2), box(0.06, 1.1, 0.06, 0.3, 0.55, -0.1, WOOD2), box(0.7, 0.08, 0.06, 0, 1.05, -0.1, WOOD2),
    torus(0.24, 0.07, 0, 0.72, -0.04, RED), torus(0.24, 0.072, 0, 0.72, -0.04, WHITE, 0, 0, Math.PI / 4),
  ]),
  hayBale: () => one('hayBale', [box(0.84, 0.5, 0.6, 0, 0.25, 0, HAY), box(0.86, 0.04, 0.62, 0, 0.18, 0, 0xc9a24a), box(0.86, 0.04, 0.62, 0, 0.36, 0, 0xc9a24a), box(0.04, 0.52, 0.62, -0.2, 0.25, 0, 0xb9893a)]),
  crate: () => one('crate', [box(0.7, 0.56, 0.7, 0, 0.28, 0, WOOD), box(0.72, 0.06, 0.72, 0, 0.53, 0, WOOD2), box(0.72, 0.06, 0.72, 0, 0.06, 0, WOOD2), box(0.72, 0.06, 0.06, 0, 0.3, 0.34, WOOD2, 0, 0, 0.65)]),
  milkCan: () => one('milkCan', [cyl(0.2, 0.22, 0.5, 0, 0.25, 0, 0xc9ced6, 14), cyl(0.12, 0.2, 0.14, 0, 0.57, 0, 0xc9ced6, 14), cyl(0.12, 0.12, 0.08, 0, 0.68, 0, 0xa9aeb6, 14), torus(0.16, 0.025, 0.24, 0.48, 0, 0xa9aeb6, 0, Math.PI / 2), cyl(0.225, 0.225, 0.05, 0, 0.32, 0, BLUE, 14)]),
  flowerBox: () => {
    const p: Parts = [box(1.7, 0.4, 0.5, 0, 0.2, 0, WOOD), box(1.62, 0.04, 0.42, 0, 0.4, 0, 0x6b4f3f)];
    const c = [0xf27ba5, YELLOW, WHITE, 0xb892ff, 0xff8c69];
    for (let i = 0; i < 9; i++) p.push(ball(0.12, 0.12, 0.12, -0.72 + i * 0.18, 0.5 + (i % 2) * 0.05, (i % 3 - 1) * 0.08, GREEN), dot(0.08, 0.06, 0.08, -0.72 + i * 0.18, 0.62 + (i % 2) * 0.05, (i % 3 - 1) * 0.08, c[i % c.length]!));
    return one('flowerBox', p);
  },
  miniScarecrow: () => one('miniScarecrow', [
    cyl(0.03, 0.03, 1.2, 0, 0.6, 0, WOOD2, 6), box(0.8, 0.05, 0.05, 0, 0.85, 0, WOOD2), box(0.36, 0.4, 0.18, 0, 0.8, 0, 0x5b8dd9),
    ball(0.16, 0.16, 0.16, 0, 1.18, 0, SAND), cyl(0.28, 0.28, 0.03, 0, 1.3, 0, HAY, 14), cyl(0.12, 0.14, 0.14, 0, 1.38, 0, HAY, 10), dot(0.1, 0.1, 0.06, 0.24, 0.8, 0.05, RED),
  ]),
  birdhouse: () => one('birdhouse', [
    cyl(0.04, 0.04, 1.1, 0, 0.55, 0, WOOD2, 6), box(0.36, 0.34, 0.32, 0, 1.25, 0, 0x9adbb5), box(0.44, 0.04, 0.4, -0.11, 1.48, 0, RED, 0, 0, 0.55),
    box(0.44, 0.04, 0.4, 0.11, 1.48, 0, RED, 0, 0, -0.55), cyl(0.07, 0.07, 0.02, 0, 1.27, 0.17, 0x2b2b30, 10, Math.PI / 2), cyl(0.012, 0.012, 0.1, 0, 1.18, 0.2, DARK, 4, Math.PI / 2),
  ]),
  cafeTable: () => one('cafeTable', [
    cyl(0.42, 0.42, 0.05, 0, 0.72, 0, WHITE, 18), cyl(0.04, 0.05, 0.7, 0, 0.36, 0, METAL, 8), cyl(0.22, 0.24, 0.04, 0, 0.02, 0, METAL, 12),
    cyl(0.04, 0.04, 0.12, 0.1, 0.8, 0.05, 0xc0704a, 8), ball(0.07, 0.07, 0.07, 0.1, 0.9, 0.05, 0xf27ba5),
    ...[-1, 1].flatMap(s => [box(0.36, 0.05, 0.36, s * 0.66, 0.42, 0.2, PINK), ...legs(0.32, 0.32, 0.4, METAL, 0.02).map(g => g.translate(s * 0.66, 0, 0.2)), box(0.36, 0.36, 0.04, s * 0.66, 0.62, s > 0 ? 0.36 : 0.04, METAL)]),
  ]),
  bunting: () => {
    const p: Parts = [cyl(0.03, 0.03, 1.8, -0.9, 0.9, 0, WOOD2, 6), cyl(0.03, 0.03, 1.8, 0.9, 0.9, 0, WOOD2, 6), cyl(0.008, 0.008, 1.8, 0, 1.68, 0, CREAM, 4, 0, 0, Math.PI / 2)];
    const c = [RED, YELLOW, BLUE, MINT, PINK];
    for (let i = 0; i < 7; i++) p.push(cone(0.1, 0.24, -0.72 + i * 0.24, 1.55 - Math.sin((i / 6) * Math.PI) * 0.1, 0, c[i % c.length]!, 3, Math.PI));
    return one('bunting', p);
  },
  fruitCrate: () => {
    const p: Parts = [box(0.72, 0.4, 0.6, 0, 0.2, 0, WOOD), box(0.74, 0.05, 0.62, 0, 0.38, 0, WOOD2)];
    for (let i = 0; i < 6; i++) p.push(ball(0.11, 0.11, 0.11, -0.2 + (i % 3) * 0.2, 0.46, -0.12 + Math.floor(i / 3) * 0.24, i % 2 ? RED : 0xff9f1c));
    return one('fruitCrate', p);
  },
  umbrella: () => {
    const p: Parts = [cyl(0.03, 0.03, 2.1, 0, 1.05, 0, WOOD2, 6), cyl(0.2, 0.24, 0.1, 0, 0.05, 0, METAL, 10)];
    for (let i = 0; i < 8; i++) p.push(box(0.36, 0.03, 0.9, Math.sin((i * Math.PI) / 4) * 0.42, 2.0, Math.cos((i * Math.PI) / 4) * 0.42, i % 2 ? CREAM : GREEN, 0.3, (i * Math.PI) / 4, 0));
    p.push(dot(0.06, 0.06, 0.06, 0, 2.2, 0, GOLD));
    return one('umbrella', p);
  },
  chalkboard: () => one('chalkboard', [
    box(0.06, 1.0, 0.06, -0.28, 0.5, -0.16, WOOD2, 0.22), box(0.06, 1.0, 0.06, 0.28, 0.5, -0.16, WOOD2, 0.22), box(0.06, 1.0, 0.06, 0, 0.5, 0.16, WOOD2, -0.25),
    box(0.62, 0.5, 0.04, 0, 0.7, -0.08, 0x2f4a3a, 0.22), box(0.36, 0.03, 0.01, 0, 0.78, -0.05, WHITE, 0.22), box(0.24, 0.03, 0.01, -0.04, 0.68, -0.03, WHITE, 0.22),
  ]),
  lantern: () => one('lantern', [cyl(0.03, 0.03, 1.2, 0, 0.6, 0, METAL, 6), box(0.36, 0.04, 0.04, 0.16, 1.18, 0, METAL), cyl(0.14, 0.12, 0.06, 0, 0.03, 0, METAL, 8), cone(0.14, 0.12, 0.32, 1.06, 0, METAL, 6)], [cyl(0.1, 0.1, 0.22, 0.32, 0.9, 0, 0xffe6a8, 6)]),
  bench: () => {
    const p: Parts = [];
    [-0.12, 0.02, 0.16].forEach((z, i) => p.push(box(1.6, 0.05, 0.12, 0, 0.48, z, i % 2 ? WOOD2 : WOOD)));
    p.push(box(1.6, 0.11, 0.04, 0, 0.7, -0.22, WOOD2, -0.14), box(1.6, 0.11, 0.04, 0, 0.86, -0.24, WOOD, -0.14));
    for (const s of [-1, 1]) p.push(box(0.06, 0.48, 0.06, s * 0.74, 0.24, 0.17, METAL), box(0.06, 0.98, 0.06, s * 0.74, 0.49, -0.21, METAL, -0.14), box(0.06, 0.05, 0.46, s * 0.74, 0.64, -0.01, METAL));
    return one('bench', p);
  },
  streetLamp: () => one('streetLamp', [cyl(0.05, 0.07, 2.2, 0, 1.1, 0, METAL, 8), cyl(0.18, 0.22, 0.12, 0, 0.06, 0, METAL, 10), cyl(0.08, 0.1, 0.08, 0, 2.24, 0, METAL, 8)], [ball(0.22, 0.24, 0.22, 0, 2.48, 0, WHITE)]),
  fence: () => one('fence', [
    box(0.08, 0.7, 0.08, -0.42, 0.35, 0, WHITE), box(0.08, 0.7, 0.08, 0.42, 0.35, 0, WHITE), box(0.92, 0.07, 0.05, 0, 0.5, 0, WHITE), box(0.92, 0.07, 0.05, 0, 0.25, 0, WHITE),
    ...[-0.2, 0, 0.2].map(x => box(0.07, 0.62, 0.04, x, 0.33, 0.02, WHITE)), cone(0.06, 0.08, -0.42, 0.74, 0, WHITE, 4), cone(0.06, 0.08, 0.42, 0.74, 0, WHITE, 4),
  ]),
  fountain: () => {
    const p: Parts = [cyl(0.92, 0.95, 0.4, 0, 0.2, 0, STONE, 24), cyl(0.8, 0.8, 0.06, 0, 0.36, 0, 0x6fc7dd, 24), cyl(0.12, 0.16, 0.8, 0, 0.6, 0, STONE2, 12)];
    p.push(cyl(0.42, 0.3, 0.14, 0, 1.0, 0, STONE, 18), cyl(0.36, 0.36, 0.04, 0, 1.06, 0, 0x8ad6e8, 18), ball(0.12, 0.16, 0.12, 0, 1.2, 0, STONE2));
    for (let i = 0; i < 6; i++) p.push(dot(0.05, 0.12, 0.05, Math.cos(i) * 0.3, 0.86, Math.sin(i) * 0.3, 0xbfeaf5));
    return one('fountain', p);
  },
  birdbath: () => one('birdbath', [cyl(0.2, 0.24, 0.08, 0, 0.04, 0, STONE, 12), cyl(0.07, 0.1, 0.7, 0, 0.42, 0, STONE2, 10), cyl(0.36, 0.22, 0.14, 0, 0.82, 0, STONE, 16), cyl(0.3, 0.3, 0.03, 0, 0.88, 0, 0x8ad6e8, 16), ball(0.08, 0.07, 0.1, 0.18, 0.95, 0, SKY), dot(0.04, 0.04, 0.04, 0.2, 1.02, 0.06, SKY)]),
  flowerBed: () => {
    const p: Parts = [box(0.86, 0.14, 0.86, 0, 0.07, 0, 0x7a5a3a), box(0.8, 0.04, 0.8, 0, 0.15, 0, 0x5a4030)];
    const c = [0xf27ba5, YELLOW, WHITE, 0xb892ff, 0xff8c69, RED];
    for (let i = 0; i < 9; i++) {
      const x = -0.26 + (i % 3) * 0.26, z = -0.26 + Math.floor(i / 3) * 0.26;
      p.push(cyl(0.015, 0.015, 0.22, x, 0.27, z, GREEN, 4), ball(0.08, 0.06, 0.08, x, 0.4, z, c[i % c.length]!), dot(0.03, 0.03, 0.03, x, 0.43, z, YELLOW));
    }
    return one('flowerBed', p);
  },
  stonePath: () => group('stonePath', vcMesh([cyl(0.3, 0.32, 0.05, -0.16, 0.025, -0.16, STONE, 9), cyl(0.24, 0.26, 0.05, 0.22, 0.025, 0.12, STONE2, 8), cyl(0.18, 0.2, 0.05, -0.18, 0.025, 0.28, STONE, 7)], 'body', false)),
};

export function registerFurniture(registry: AssetRegistry): void {
  for (const [name, make] of Object.entries(FURNITURE)) registry.register(`decor.${name}`, make);

  // The player's market cart: a wooden cart with a pink striped awning and a sign.
  registry.register('stall.player', () => {
    const p: Parts = [
      box(1.6, 0.5, 0.86, 0, 0.6, 0, WOOD), box(1.66, 0.06, 0.92, 0, 0.86, 0, WOOD2), box(1.5, 0.05, 0.6, 0, 0.4, 0.05, WOOD2),
      cyl(0.3, 0.3, 0.08, -0.62, 0.3, 0.46, DARK, 14, 0, 0, Math.PI / 2), cyl(0.3, 0.3, 0.08, 0.62, 0.3, 0.46, DARK, 14, 0, 0, Math.PI / 2),
      cyl(0.08, 0.08, 0.1, -0.62, 0.3, 0.46, GOLD, 8, 0, 0, Math.PI / 2), cyl(0.08, 0.08, 0.1, 0.62, 0.3, 0.46, GOLD, 8, 0, 0, Math.PI / 2),
      box(0.05, 1.3, 0.05, -0.76, 1.5, -0.38, WOOD2), box(0.05, 1.3, 0.05, 0.76, 1.5, -0.38, WOOD2), box(0.05, 1.3, 0.05, -0.76, 1.5, 0.38, WOOD2), box(0.05, 1.3, 0.05, 0.76, 1.5, 0.38, WOOD2),
      box(0.9, 0.34, 0.04, 0, 1.18, 0.47, CREAM), cyl(0.2, 0.2, 0.86, 0.95, 0.72, 0, WOOD2, 8, 0, 0, Math.PI / 2),
    ];
    for (let i = 0; i < 8; i++) p.push(box(0.22, 0.05, 1.12, -0.77 + i * 0.22, 2.18 - Math.abs(i - 3.5) * 0.02, 0.06, i % 2 ? CREAM : 0xf27ba5, 0.12));
    for (let i = 0; i < 8; i++) p.push(cone(0.1, 0.16, -0.77 + i * 0.22, 2.02, 0.62, i % 2 ? CREAM : 0xf27ba5, 3, Math.PI));
    return group('stall.player', vcMesh(p, 'body'));
  });

  // A newcomer's tent on the beach.
  registry.register('tent', () => {
    const p: Parts = [
      cone(1.0, 1.5, 0, 0.75, 0, 0xf2c14e, 4, 0, Math.PI / 4), cone(0.42, 0.9, 0, 0.45, 0.62, 0x6b4f3f, 3, -0.1, Math.PI),
      cyl(0.02, 0.02, 1.7, 0, 0.85, 0, DARK, 4), box(1.6, 0.03, 1.5, 0, 0.015, 0, 0xc9a96a), box(0.3, 0.04, 0.2, 0, 1.6, 0, RED),
    ];
    return group('tent', vcMesh(p, 'body'));
  });

  // The pet's find: a little mound of soil with a sparkle.
  registry.register('dig.mound', () => group('dig.mound', vcMesh([ball(0.32, 0.12, 0.28, 0, 0.02, 0, 0x8a6a45), ball(0.12, 0.08, 0.1, 0.16, 0.06, 0.08, 0x7a5a3a), dot(0.05, 0.05, 0.05, -0.1, 0.12, 0, 0x5a4030)], 'body', false)));

  // How the house grows outside: a side room, a loft with a dormer, the cellar door.
  registry.register('house.annex', () => {
    const m = materials();
    const g = group('house.annex');
    const wall = meshOf(new THREE.CylinderGeometry(1.25, 1.25, 1.5, 24, 1, true), m.hutWall, 'walls');
    wall.position.y = 0.98;
    const roof = meshOf(new THREE.ConeGeometry(1.55, 1.2, 24), m.thatch, 'roof');
    roof.position.y = 2.25;
    g.add(wall, roof, vcMesh([cyl(1.35, 1.4, 0.24, 0, 0.12, 0, STONE, 22), box(0.5, 0.5, 0.08, 0.6, 1.1, 1.08, 0x8a5a34, 0, 0.5)], 'base'));
    const win = new THREE.Mesh(merge([box(0.38, 0.38, 0.04, 0.62, 1.1, 1.12, 0xffffff, 0, 0.5)]), m.window);
    win.name = 'window';
    g.add(win);
    return g;
  });
  registry.register('house.loft', () => {
    const m = materials();
    const g = group('house.loft');
    const dormer = vcMesh([box(0.9, 0.8, 0.8, 0, 0, 0, 0xe9dcc3), box(1.1, 0.08, 1.0, -0.26, 0.5, 0, 0x9c6b3e, 0, 0, 0.6), box(1.1, 0.08, 1.0, 0.26, 0.5, 0, 0x9c6b3e, 0, 0, -0.6)], 'dormer');
    const win = new THREE.Mesh(merge([box(0.46, 0.42, 0.04, 0, 0, 0.42, 0xffffff)]), m.window);
    win.name = 'window';
    g.add(dormer, win);
    return g;
  });
  registry.register('house.cellar', () => group('house.cellar', vcMesh([box(1.2, 0.2, 0.9, 0, 0.1, 0, STONE), box(1.0, 0.08, 0.8, -0.25, 0.26, 0, WOOD2, 0, 0, 0.25), box(1.0, 0.08, 0.8, 0.25, 0.26, 0, WOOD, 0, 0, -0.25), dot(0.05, 0.05, 0.05, 0.12, 0.34, 0.2, METAL)], 'body')));
}
