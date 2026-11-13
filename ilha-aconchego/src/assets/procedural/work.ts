import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GREENHOUSE, GREENHOUSE_BED } from '../../data/map';
import { materials } from '../../render/materials';
import { seededRandom } from '../../render/textures';
import type { AssetRegistry } from '../registry';
import { bake, ball, box, cone, cyl, dot, group, meshOf, shade, torus, vcMesh } from './parts';

/**
 * Stage 3 props: the barn, the coop and their animals, Bento's smithy, the shipping bin, the kitchen
 * stove, the workbench, the greenhouse, the machines, the rocks for the pickaxe, the stumps and bugs.
 * Origins sit on the ground; buildings face +z (toward the camera).
 */

const WOOD = 0xa87445;
const WOOD_DARK = 0x6e4a2e;
const WOOD_LIGHT = 0xd2a878;
const CREAM = 0xf6efdd;
const IRON = 0x3a3a40;
const STONE = 0xb4ab9c;
const RED = 0xc8553d;
const INK = 0x2a1e1e;

/** Gable roof of two slanted boards over a box of width w and depth d, starting at height y. */
function gable(w: number, d: number, y: number, rise: number, color: number, overhang = 0.18): THREE.BufferGeometry[] {
  const half = w / 2 + overhang;
  const slope = Math.atan2(rise, half);
  const len = Math.hypot(half, rise);
  return [-1, 1].map(s => box(len, 0.1, d + overhang * 2, (s * half) / 2, y + rise / 2, 0, color, 0, 0, -s * slope));
}

function barn(): THREE.Group {
  const W = 3.0, H = 1.7, D = 2.1;
  const p = [
    box(W, H, D, 0, H / 2, 0, RED), box(W + 0.06, 0.12, D + 0.06, 0, 0.06, 0, 0x8c3a2b),
    // Front: big white-trimmed door with a cross, and the hay loft window.
    box(1.3, 1.25, 0.06, 0, 0.63, D / 2 + 0.02, 0xa8402e), box(1.42, 0.08, 0.08, 0, 1.28, D / 2 + 0.04, CREAM),
    box(0.08, 1.25, 0.08, -0.67, 0.63, D / 2 + 0.04, CREAM), box(0.08, 1.25, 0.08, 0.67, 0.63, D / 2 + 0.04, CREAM),
    box(1.75, 0.07, 0.07, 0, 0.63, D / 2 + 0.05, CREAM, 0, 0, 0.75), box(1.75, 0.07, 0.07, 0, 0.63, D / 2 + 0.05, CREAM, 0, 0, -0.75),
    box(0.55, 0.45, 0.06, 0, 1.95, D / 2 + 0.02, 0x5a3a2a), box(0.65, 0.06, 0.07, 0, 2.2, D / 2 + 0.04, CREAM), box(0.65, 0.06, 0.07, 0, 1.7, D / 2 + 0.04, CREAM),
    // Corner trims.
    ...[-1, 1].map(s => box(0.09, H, 0.09, s * (W / 2), H / 2, D / 2, CREAM)),
    // Gable end and roof.
    bake(new THREE.CylinderGeometry(0.001, (W / 2) * 1.414, 0.9, 4, 1), { y: H + 0.45, sz: D / (W * 1.414) * 1.414, ry: Math.PI / 4 }, RED),
    ...gable(W, D, H, 0.95, 0x5e4a42),
    box(0.12, 0.16, D + 0.4, 0, H + 0.96, 0, 0x4a3a34),
    // Hay bales by the door.
    box(0.6, 0.38, 0.4, -1.15, 0.19, D / 2 + 0.45, 0xe3c46a), box(0.6, 0.38, 0.4, 1.2, 0.19, D / 2 + 0.4, 0xe3c46a, 0, 0.3),
  ];
  return group('barn', vcMesh(p, 'barn'));
}

function coop(): THREE.Group {
  const W = 2.0, H = 1.05, D = 1.4;
  const WALL = 0xf1d18a;
  const p = [
    box(W, H, D, 0, H / 2 + 0.2, 0, WALL),
    ...[-0.8, 0.8].flatMap(x => [-0.55, 0.55].map(z => box(0.12, 0.25, 0.12, x, 0.12, z, WOOD_DARK))),
    ...gable(W, D, H + 0.2, 0.6, RED, 0.16),
    box(0.45, 0.6, 0.06, -0.45, 0.5, D / 2 + 0.02, WOOD_DARK), box(0.55, 0.06, 0.08, -0.45, 0.82, D / 2 + 0.03, CREAM),
    box(0.44, 0.06, 0.9, -0.45, 0.12, D / 2 + 0.38, WOOD, 0.35),
    cyl(0.17, 0.17, 0.06, 0.45, 0.85, D / 2 + 0.02, 0x5a3a2a, 14, Math.PI / 2), torus(0.17, 0.035, 0.45, 0.85, D / 2 + 0.04, CREAM),
    // Nesting box on the side, with an egg peeking out.
    box(0.4, 0.35, 0.5, W / 2 + 0.2, 0.55, 0.2, WALL), box(0.48, 0.06, 0.58, W / 2 + 0.2, 0.75, 0.2, RED, 0, 0, -0.2),
    dot(0.07, 0.09, 0.07, W / 2 + 0.2, 0.75, 0.48, 0xfdf6e3),
  ];
  return group('coop', vcMesh(p, 'coop'));
}

function chicken(): THREE.Group {
  const p = [
    ball(0.2, 0.18, 0.24, 0, 0.26, 0, 0xfbf7ee), ball(0.12, 0.12, 0.12, 0, 0.44, 0.15, 0xfbf7ee), ball(0.09, 0.1, 0.09, 0, 0.34, -0.2, 0xf1ebdc),
    dot(0.03, 0.05, 0.04, 0, 0.56, 0.15, 0xe5484d), dot(0.025, 0.035, 0.03, 0, 0.53, 0.2, 0xe5484d),
    cone(0.035, 0.07, 0, 0.44, 0.28, 0xf2b33d, 6, Math.PI / 2), dot(0.02, 0.04, 0.02, 0, 0.38, 0.24, 0xe5484d),
    dot(0.018, 0.022, 0.015, -0.07, 0.47, 0.25, INK), dot(0.018, 0.022, 0.015, 0.07, 0.47, 0.25, INK),
    cyl(0.015, 0.015, 0.12, -0.06, 0.06, 0, 0xf2b33d, 5), cyl(0.015, 0.015, 0.12, 0.06, 0.06, 0, 0xf2b33d, 5),
    ball(0.06, 0.12, 0.14, -0.18, 0.28, -0.02, 0xf1ebdc), ball(0.06, 0.12, 0.14, 0.18, 0.28, -0.02, 0xf1ebdc),
  ];
  return group('animal.chicken', vcMesh(p, 'body'));
}

function cow(): THREE.Group {
  const W = 0xfbf7f0, B = 0x3a3434;
  const p = [
    ball(0.36, 0.34, 0.55, 0, 0.72, 0, W),
    dot(0.18, 0.15, 0.2, 0.22, 0.82, 0.12, B), dot(0.16, 0.13, 0.16, -0.24, 0.72, -0.2, B), dot(0.12, 0.1, 0.12, 0.1, 0.95, -0.3, B),
    ball(0.25, 0.24, 0.26, 0, 0.98, 0.55, W), ball(0.19, 0.12, 0.12, 0, 0.88, 0.76, 0xf3b6c0),
    dot(0.025, 0.03, 0.02, -0.06, 0.88, 0.875, 0x8e4a52), dot(0.025, 0.03, 0.02, 0.06, 0.88, 0.875, 0x8e4a52),
    dot(0.035, 0.04, 0.025, -0.11, 1.05, 0.76, INK), dot(0.035, 0.04, 0.025, 0.11, 1.05, 0.76, INK),
    cone(0.04, 0.14, -0.13, 1.22, 0.5, 0xe9dcc0, 6, 0, 0, 0.4), cone(0.04, 0.14, 0.13, 1.22, 0.5, 0xe9dcc0, 6, 0, 0, -0.4),
    ball(0.1, 0.05, 0.08, -0.25, 1.1, 0.48, W, 0, 0, 0.5), ball(0.1, 0.05, 0.08, 0.25, 1.1, 0.48, W, 0, 0, -0.5),
    ...[-1, 1].flatMap(sx => [-1, 1].map(sz => cyl(0.07, 0.065, 0.48, sx * 0.2, 0.24, sz * 0.32, W, 8))),
    ...[-1, 1].flatMap(sx => [-1, 1].map(sz => cyl(0.072, 0.072, 0.07, sx * 0.2, 0.03, sz * 0.32, 0x5a4a44, 8))),
    ball(0.11, 0.07, 0.11, 0, 0.42, 0.12, 0xf3b6c0), cyl(0.02, 0.02, 0.45, 0, 0.62, -0.58, W, 5, 0.4), dot(0.05, 0.08, 0.05, 0, 0.42, -0.66, B),
    torus(0.12, 0.025, 0, 0.82, 0.5, 0xe5484d, Math.PI / 2 - 0.3), dot(0.05, 0.06, 0.05, 0, 0.7, 0.62, 0xf2c14e),
  ];
  return group('animal.cow', vcMesh(p, 'body'));
}

function sheep(): THREE.Group {
  const WOOL = 0xf7f3ea, FACE = 0x4a4040;
  const fluff: THREE.BufferGeometry[] = [];
  const rnd = seededRandom(31);
  for (let k = 0; k < 14; k++) {
    const a = rnd() * Math.PI * 2, y = 0.48 + rnd() * 0.22, r = 0.2 + rnd() * 0.1;
    fluff.push(ball(r, r * 0.9, r, Math.cos(a) * 0.17, y, Math.sin(a) * 0.26, WOOL));
  }
  const p = [
    ...fluff, ball(0.32, 0.27, 0.42, 0, 0.55, 0, WOOL),
    ball(0.15, 0.16, 0.17, 0, 0.66, 0.42, FACE), ball(0.15, 0.08, 0.12, 0, 0.78, 0.38, WOOL),
    ball(0.09, 0.04, 0.06, -0.17, 0.66, 0.36, FACE, 0, 0, 0.6), ball(0.09, 0.04, 0.06, 0.17, 0.66, 0.36, FACE, 0, 0, -0.6),
    dot(0.03, 0.035, 0.02, -0.06, 0.69, 0.57, 0xffffff), dot(0.03, 0.035, 0.02, 0.06, 0.69, 0.57, 0xffffff),
    dot(0.018, 0.02, 0.015, -0.06, 0.69, 0.585, INK), dot(0.018, 0.02, 0.015, 0.06, 0.69, 0.585, INK),
    ...[-1, 1].flatMap(sx => [-1, 1].map(sz => cyl(0.045, 0.045, 0.32, sx * 0.15, 0.16, sz * 0.22, FACE, 6))),
  ];
  return group('animal.sheep', vcMesh(p, 'body'));
}

/** Bento, the badger blacksmith: grey fur, a white stripe, a leather apron and a big smile. */
function bento(): THREE.Group {
  const FUR = 0x7d7a80, DARK = 0x3b393e, WHITE = 0xf4f1ea, APRON = 0x8a5a3c;
  const p = [
    ball(0.32, 0.38, 0.28, 0, 0.55, 0, FUR), box(0.42, 0.5, 0.06, 0, 0.55, 0.25, APRON, -0.1), box(0.5, 0.05, 0.05, 0, 0.82, 0.22, APRON),
    ball(0.33, 0.3, 0.3, 0, 1.12, 0.02, FUR), ball(0.1, 0.27, 0.27, 0, 1.17, 0.06, WHITE, -0.25),
    ball(0.13, 0.1, 0.06, -0.12, 1.11, 0.26, DARK, 0, 0, -0.3), ball(0.13, 0.1, 0.06, 0.12, 1.11, 0.26, DARK, 0, 0, 0.3),
    dot(0.035, 0.04, 0.02, -0.11, 1.12, 0.31, WHITE), dot(0.035, 0.04, 0.02, 0.11, 1.12, 0.31, WHITE),
    dot(0.02, 0.025, 0.015, -0.11, 1.12, 0.325, INK), dot(0.02, 0.025, 0.015, 0.11, 1.12, 0.325, INK),
    ball(0.12, 0.08, 0.1, 0, 1.0, 0.26, WHITE), dot(0.05, 0.035, 0.035, 0, 1.04, 0.35, INK),
    ball(0.07, 0.07, 0.04, -0.24, 1.36, -0.02, DARK), ball(0.07, 0.07, 0.04, 0.24, 1.36, -0.02, DARK),
    ball(0.08, 0.2, 0.08, -0.33, 0.6, 0.06, FUR, 0, 0, 0.35), ball(0.08, 0.2, 0.08, 0.33, 0.6, 0.06, FUR, 0, 0, -0.35),
    ball(0.09, 0.08, 0.13, -0.13, 0.08, 0.06, DARK), ball(0.09, 0.08, 0.13, 0.13, 0.08, 0.06, DARK),
    // Hammer in the right paw.
    cyl(0.025, 0.025, 0.4, 0.4, 0.5, 0.12, WOOD_DARK, 6, 0, 0, 0.3), box(0.2, 0.09, 0.09, 0.46, 0.68, 0.12, IRON, 0, 0, 0.3),
  ];
  return group('npc.bento', vcMesh(p, 'body'));
}

function smithy(): THREE.Group {
  const W = 3.4, D = 1.7;
  const p = [
    box(W, 0.12, D, 0, 0.06, 0, STONE), box(W, 1.9, 0.3, 0, 1.0, -D / 2 + 0.15, 0x9a8f80),
    ...[-1, 1].map(s => cyl(0.08, 0.08, 2.1, s * (W / 2 - 0.15), 1.05, D / 2 - 0.15, WOOD_DARK, 8)),
    box(W + 0.4, 0.1, D + 0.5, 0, 2.15, 0.05, 0x7a5a4a, 0.18), box(W + 0.5, 0.12, 0.12, 0, 2.02, D / 2 + 0.28, WOOD_DARK),
    // Furnace with its chimney.
    box(1.0, 1.0, 0.8, -1.0, 0.55, -0.35, 0x8a7f72), cyl(0.18, 0.22, 1.3, -1.2, 2.3, -0.5, 0x6f665c, 8),
    box(0.5, 0.36, 0.06, -1.0, 0.5, 0.06, 0x2a1d18),
    // Anvil on a stump.
    cyl(0.22, 0.26, 0.4, 0.4, 0.2, 0.25, WOOD, 10), box(0.5, 0.12, 0.2, 0.4, 0.47, 0.25, IRON), box(0.32, 0.12, 0.16, 0.4, 0.58, 0.25, IRON), cone(0.08, 0.2, 0.7, 0.58, 0.25, IRON, 6, 0, 0, -Math.PI / 2),
    // Tool rack and a water barrel.
    box(1.0, 0.06, 0.08, 1.1, 1.5, -D / 2 + 0.34, WOOD_DARK), cyl(0.02, 0.02, 0.5, 0.8, 1.25, -D / 2 + 0.36, WOOD, 5), box(0.12, 0.2, 0.03, 0.8, 1.0, -D / 2 + 0.36, IRON),
    cyl(0.02, 0.02, 0.5, 1.3, 1.25, -D / 2 + 0.36, WOOD, 5), box(0.22, 0.06, 0.06, 1.3, 1.02, -D / 2 + 0.36, IRON),
    cyl(0.3, 0.3, 0.6, 1.25, 0.3, 0.35, 0xa0703f, 12), cyl(0.27, 0.27, 0.02, 1.25, 0.6, 0.35, 0x5aa9c9, 12),
  ];
  const fire = meshOf(new THREE.PlaneGeometry(0.42, 0.28), new THREE.MeshBasicMaterial({ color: 0xff8a2a }), 'fire', false);
  fire.position.set(-1.0, 0.48, 0.1);
  return group('smithy', vcMesh(p, 'smithy'), fire);
}

function shippingBin(): THREE.Group {
  const p = [
    box(1.1, 0.6, 0.72, 0, 0.32, 0, WOOD), ...[-0.4, 0, 0.4].map(x => box(0.06, 0.62, 0.74, x, 0.32, 0, WOOD_DARK)),
    box(1.18, 0.1, 0.8, 0, 0.67, -0.06, WOOD_LIGHT, -0.18), cyl(0.12, 0.12, 0.04, 0, 0.38, 0.38, 0xf2b33d, 14, Math.PI / 2),
    ...[-1, 1].flatMap(sx => [-1, 1].map(sz => box(0.1, 0.06, 0.1, sx * 0.48, 0.03, sz * 0.3, WOOD_DARK))),
  ];
  return group('shipping.bin', vcMesh(p, 'bin'));
}

function kitchen(): THREE.Group {
  const BRICK = 0xb5654a;
  const p = [
    box(1.1, 0.75, 0.7, 0, 0.38, 0, BRICK), box(1.16, 0.06, 0.76, 0, 0.78, 0, IRON), box(0.46, 0.3, 0.05, 0, 0.35, 0.36, 0x2a1d18),
    cyl(0.07, 0.07, 1.2, 0.42, 1.35, -0.2, IRON, 8),
    cyl(0.22, 0.2, 0.26, -0.18, 0.94, 0.02, 0x4b4f56, 14), cyl(0.23, 0.23, 0.03, -0.18, 1.08, 0.02, 0x5a5e66, 14), dot(0.04, 0.03, 0.04, -0.18, 1.11, 0.02, IRON),
    box(0.6, 0.06, 0.5, -1.0, 0.72, 0, WOOD_LIGHT), ...[-1, 1].map(s => box(0.06, 0.7, 0.4, -1.0 + s * 0.24, 0.35, 0, WOOD)),
    box(0.36, 0.04, 0.24, -1.0, 0.77, 0, 0xd9b48a), dot(0.06, 0.05, 0.06, -0.92, 0.82, 0.02, 0xf08a2b), dot(0.05, 0.04, 0.05, -1.08, 0.82, -0.03, 0xe5483b),
  ];
  const fire = meshOf(new THREE.PlaneGeometry(0.36, 0.2), new THREE.MeshBasicMaterial({ color: 0xff8a2a }), 'fire', false);
  fire.position.set(0, 0.33, 0.37);
  return group('kitchen', vcMesh(p, 'stove'), fire);
}

function workbench(): THREE.Group {
  const p = [
    box(1.5, 0.1, 0.65, 0, 0.82, 0, WOOD_LIGHT), ...[-1, 1].flatMap(sx => [-1, 1].map(sz => box(0.09, 0.8, 0.09, sx * 0.66, 0.4, sz * 0.26, WOOD))),
    box(1.3, 0.06, 0.5, 0, 0.25, 0, WOOD),
    box(0.4, 0.03, 0.14, -0.35, 0.89, 0.05, 0xc9ccd1, 0, 0.3), box(0.12, 0.05, 0.05, -0.12, 0.9, 0.08, WOOD_DARK, 0, 0.3),
    cyl(0.02, 0.02, 0.3, 0.3, 0.9, 0.1, WOOD_DARK, 6, 0, 0, Math.PI / 2), box(0.1, 0.07, 0.06, 0.46, 0.9, 0.1, IRON),
    box(0.3, 0.12, 0.3, 0.45, 0.93, -0.15, WOOD, 0, 0.2), box(0.6, 0.6, 0.06, 0, 1.2, -0.3, WOOD_DARK),
  ];
  return group('workbench', vcMesh(p, 'bench'));
}

/** Glass greenhouse; "only:broken" parts show before the repair, "only:fixed" ones after. */
function greenhouse(): THREE.Group {
  const { w: W, d: D, door } = GREENHOUSE;
  const H = 1.9, FRAME = 0xf4f4ef;
  const frame: THREE.BufferGeometry[] = [box(W, 0.14, D, 0, 0.07, 0, 0xc9c2b4)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) frame.push(box(0.09, H, 0.09, (sx * W) / 2, H / 2, (sz * D) / 2, FRAME));
  for (const x of [-W / 4, 0, W / 4]) frame.push(box(0.06, H, 0.06, x, H / 2, -D / 2, FRAME));
  for (const s of [-1, 1]) {
    frame.push(box(0.06, 0.06, D, (s * W) / 2, H, 0, FRAME), box(0.06, H, 0.06, s * (door / 2 + 0.03), H / 2, D / 2, FRAME));
    frame.push(box(Math.hypot(W / 2, 0.7), 0.06, 0.06, (s * W) / 4, H + 0.35, D / 2, FRAME, 0, 0, -s * Math.atan2(0.7, W / 2)));
    frame.push(box(Math.hypot(W / 2, 0.7), 0.06, 0.06, (s * W) / 4, H + 0.35, -D / 2, FRAME, 0, 0, -s * Math.atan2(0.7, W / 2)));
  }
  frame.push(box(0.08, 0.08, D, 0, H + 0.7, 0, FRAME), box(W, 0.06, 0.06, 0, H, D / 2, FRAME), box(W, 0.06, 0.06, 0, H, -D / 2, FRAME));
  // Raised bed inside (its tiles are FARM_TILES of bed "GH").
  const bx = (GREENHOUSE_BED.x0 + GREENHOUSE_BED.x1) / 2 - GREENHOUSE.x, bz = (GREENHOUSE_BED.z0 + GREENHOUSE_BED.z1) / 2 - GREENHOUSE.z;
  const bw = GREENHOUSE_BED.x1 - GREENHOUSE_BED.x0, bd = GREENHOUSE_BED.z1 - GREENHOUSE_BED.z0;
  frame.push(box(bw + 0.2, 0.2, 0.1, bx, 0.18, bz - bd / 2 - 0.05, WOOD), box(bw + 0.2, 0.2, 0.1, bx, 0.18, bz + bd / 2 + 0.05, WOOD));
  frame.push(box(0.1, 0.2, bd, bx - bw / 2 - 0.05, 0.18, bz, WOOD), box(0.1, 0.2, bd, bx + bw / 2 + 0.05, 0.18, bz, WOOD), box(bw, 0.1, bd, bx, 0.12, bz, 0x6b4426));

  const glassMat = new THREE.MeshLambertMaterial({ color: 0xcfeef5, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
  const panes = (full: boolean) => {
    const g: THREE.BufferGeometry[] = [];
    const add = (geo: THREE.BufferGeometry, keep: boolean) => keep && g.push(geo);
    add(box(W, H, 0.02, 0, H / 2, -D / 2, 0xffffff), true);
    add(box(0.02, H, D, -W / 2, H / 2, 0, 0xffffff), true);
    add(box(0.02, H, D, W / 2, H / 2, 0, 0xffffff), full);
    for (const s of [-1, 1]) {
      add(box((W - door) / 2, H, 0.02, s * (door / 2 + (W - door) / 4), H / 2, D / 2, 0xffffff), full || s < 0);
      add(box(Math.hypot(W / 2, 0.7), 0.02, D, (s * W) / 4, H + 0.35, 0, 0xffffff, 0, 0, -s * Math.atan2(0.7, W / 2)), full || s > 0);
    }
    return vcMesh(g, full ? 'only:fixed' : 'only:broken', false);
  };
  const fixed = panes(true), broken = panes(false);
  fixed.material = glassMat;
  broken.material = glassMat;
  const boards = vcMesh([box(door + 0.2, 0.12, 0.06, 0, 0.7, D / 2 + 0.06, WOOD_DARK, 0, 0, 0.2), box(door + 0.2, 0.12, 0.06, 0, 1.2, D / 2 + 0.06, WOOD_DARK, 0, 0, -0.15), dot(0.4, 0.3, 0.3, W / 2 - 0.2, 0.25, D / 2, 0x5e9c42), dot(0.3, 0.5, 0.25, -W / 2 + 0.1, 0.4, -D / 2 + 0.2, 0x5e9c42)], 'only:broken');
  const door3d = vcMesh([box(door, 0.08, 0.04, 0, H - 0.05, D / 2, FRAME), box(0.05, 0.3, 0.05, 0, 0.3, D / 2 + 0.25, WOOD_DARK)], 'only:fixed');
  return group('greenhouse', vcMesh(frame, 'frame'), fixed, broken, boards, door3d);
}

function keg(): THREE.Group {
  return group('machine.keg', vcMesh([
    cyl(0.32, 0.32, 0.7, 0, 0.45, 0, 0xa0703f, 14), cyl(0.335, 0.335, 0.05, 0, 0.24, 0, IRON, 14), cyl(0.335, 0.335, 0.05, 0, 0.66, 0, IRON, 14),
    box(0.5, 0.1, 0.5, 0, 0.05, 0, WOOD_DARK), cyl(0.03, 0.03, 0.14, 0, 0.35, 0.34, 0xb87333, 6, Math.PI / 2), dot(0.06, 0.06, 0.06, 0, 0.82, 0, 0xf08a2b),
  ], 'machine'));
}

function press(): THREE.Group {
  return group('machine.press', vcMesh([
    box(0.7, 0.12, 0.55, 0, 0.06, 0, WOOD_DARK), ...[-1, 1].map(s => box(0.08, 0.95, 0.08, s * 0.28, 0.55, 0, WOOD)), box(0.7, 0.1, 0.12, 0, 1.0, 0, WOOD),
    cyl(0.03, 0.03, 0.5, 0, 0.8, 0, IRON, 6), box(0.36, 0.06, 0.06, 0, 1.1, 0, IRON), cyl(0.2, 0.2, 0.08, 0, 0.55, 0, WOOD_LIGHT, 12), cyl(0.18, 0.18, 0.16, 0, 0.2, 0, 0xf2d17a, 14),
  ], 'machine'));
}

function wheel(): THREE.Group {
  const spokes = Array.from({ length: 6 }, (_, k) => box(0.03, 0.5, 0.03, 0, 0.75, 0, WOOD_LIGHT, 0, 0, (k * Math.PI) / 6));
  return group('machine.wheel', vcMesh([
    box(0.7, 0.08, 0.3, 0, 0.3, 0, WOOD), ...[-1, 1].map(s => cyl(0.03, 0.03, 0.35, s * 0.28, 0.14, 0, WOOD_DARK, 6)),
    torus(0.25, 0.03, 0, 0.75, 0, WOOD), ...spokes, box(0.05, 0.5, 0.05, 0, 0.55, -0.05, WOOD_DARK), box(0.06, 0.25, 0.06, 0.28, 0.48, 0, WOOD_DARK),
    cyl(0.05, 0.07, 0.14, 0.28, 0.68, 0, 0xf7f3ea, 8),
  ], 'machine'));
}

let rockShape: THREE.BufferGeometry | null = null;
function rockBase(): THREE.BufferGeometry {
  if (rockShape) return rockShape;
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 1).deleteAttribute('normal').deleteAttribute('uv'));
  const p = g.attributes.position!;
  const rnd = seededRandom(5);
  for (let i = 0; i < p.count; i++) {
    const k = 0.88 + rnd() * 0.2;
    p.setXYZ(i, p.getX(i) * k, Math.max(-0.25, p.getY(i)) * k, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return (rockShape = g);
}

const ORE_COLORS = { stone: null, copper: 0xd27a3a, silver: 0xdfe6ee, gold: 0xf2c230, crystal: 0xb48cf2 } as const;
function oreRock(ore: keyof typeof ORE_COLORS): THREE.Group {
  const base = shade(bake(rockBase(), { y: 0.18, sx: 0.55, sy: 0.48, sz: 0.5 }, ore === 'stone' ? 0xa9a39a : 0x9a948c), { y0: 0, y1: 0.6, dark: 0.72, light: 1.12 });
  const parts = [base];
  const color = ORE_COLORS[ore];
  if (color !== null) {
    const spots: [number, number, number][] = [[0.3, 0.35, 0.25], [-0.25, 0.42, 0.22], [0.05, 0.55, -0.1], [-0.15, 0.25, 0.4], [0.38, 0.22, -0.15]];
    for (const [x, y, z] of spots) {
      parts.push(ore === 'crystal' ? cone(0.07, 0.24, x, y + 0.08, z, color, 5, z * 0.8, 0, -x * 0.8) : dot(0.075, 0.06, 0.075, x, y, z, color));
    }
  }
  return group(`node.${ore}`, vcMesh(parts, 'rock'));
}

function stump(): THREE.Group {
  const top = [cyl(0.36, 0.42, 0.45, 0, 0.22, 0, 0x8b5e3c, 14), cyl(0.33, 0.33, 0.02, 0, 0.455, 0, 0xd9b48a, 14), torus(0.2, 0.015, 0, 0.465, 0, 0xb88a5a, Math.PI / 2), torus(0.1, 0.012, 0, 0.465, 0, 0xb88a5a, Math.PI / 2)];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    top.push(dot(0.12, 0.08, 0.28, Math.cos(a) * 0.38, 0.04, Math.sin(a) * 0.38, 0x6e4a2e, 0, -a + Math.PI / 2));
  }
  const logs = [cyl(0.11, 0.11, 0.7, 0.55, 0.12, 0.15, 0x9c6b3c, 10, 0, 0.3, Math.PI / 2), cyl(0.1, 0.1, 0.6, 0.5, 0.32, 0.12, 0xa87445, 10, 0, -0.2, Math.PI / 2), cyl(0.1, 0.1, 0.02, 0.85, 0.12, 0.25, 0xd9b48a, 10, 0, 0.3, Math.PI / 2)];
  return group('stump', vcMesh(top, 'stump'), vcMesh(logs, 'wood'));
}

/** Little floating sparkle above things that are ready to pick up. */
function readyMarker(): THREE.Group {
  const star = meshOf(new THREE.OctahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: 0xffd34d }), 'marker', false);
  star.scale.set(1, 1.4, 0.5);
  return group('marker.ready', star);
}

function bug(kind: string): THREE.Group {
  const parts: Record<string, () => THREE.BufferGeometry[]> = {
    butterfly: () => [box(0.03, 0.03, 0.14, 0, 0, 0, INK), ball(0.11, 0.015, 0.09, -0.1, 0, 0.02, 0xf27ba5), ball(0.11, 0.015, 0.09, 0.1, 0, 0.02, 0xf27ba5), ball(0.07, 0.012, 0.06, -0.08, 0, -0.07, 0xffd166), ball(0.07, 0.012, 0.06, 0.08, 0, -0.07, 0xffd166)],
    ladybug: () => [ball(0.07, 0.05, 0.08, 0, 0.04, 0, 0xe5383b), dot(0.04, 0.035, 0.035, 0, 0.04, 0.07, INK), dot(0.015, 0.01, 0.015, 0.03, 0.085, 0, INK), dot(0.015, 0.01, 0.015, -0.03, 0.085, -0.02, INK)],
    bee: () => [ball(0.06, 0.055, 0.08, 0, 0, 0, 0xffd23f), box(0.13, 0.11, 0.025, 0, 0, 0, 0x3a2a20), ball(0.06, 0.01, 0.04, -0.05, 0.06, 0, 0xffffff), ball(0.06, 0.01, 0.04, 0.05, 0.06, 0, 0xffffff)],
    grasshopper: () => [ball(0.04, 0.04, 0.12, 0, 0.05, 0, 0x7cc35a), ball(0.035, 0.035, 0.04, 0, 0.07, 0.11, 0x6aae4a), cyl(0.01, 0.01, 0.14, -0.05, 0.07, -0.02, 0x5e9c42, 4, 0.9), cyl(0.01, 0.01, 0.14, 0.05, 0.07, -0.02, 0x5e9c42, 4, 0.9)],
    snail: () => [ball(0.05, 0.03, 0.12, 0, 0.03, 0, 0xd9c7a8), torus(0.05, 0.03, 0, 0.09, -0.02, 0xb07a4a, 0, Math.PI / 2), cyl(0.008, 0.008, 0.06, -0.02, 0.07, 0.1, 0xd9c7a8, 4, -0.4), cyl(0.008, 0.008, 0.06, 0.02, 0.07, 0.1, 0xd9c7a8, 4, -0.4)],
    firefly: () => [dot(0.03, 0.03, 0.05, 0, 0, 0, 0x3a3a2a)],
    caterpillar: () => [0, 1, 2, 3, 4].map(k => dot(0.04, 0.04, 0.04, 0, 0.04 + (k === 4 ? 0.02 : 0), -0.12 + k * 0.06, k === 4 ? 0x5e9c42 : 0x8dcf5f)),
    beetle: () => [ball(0.07, 0.045, 0.09, 0, 0.045, 0, 0x2d4a8a), dot(0.04, 0.03, 0.035, 0, 0.04, 0.09, INK), cone(0.015, 0.08, 0, 0.08, 0.13, INK, 4, -0.8)],
  };
  const g = group(`bug.${kind}`, vcMesh(parts[kind]!(), 'bug', false));
  if (kind === 'firefly') {
    const glow = meshOf(new THREE.SphereGeometry(0.035, 8, 6), materials().bulb, 'lamp', false);
    glow.position.z = -0.04;
    g.add(glow);
  }
  return g;
}

export function registerWork(registry: AssetRegistry): void {
  registry.register('barn', barn);
  registry.register('coop', coop);
  registry.register('animal.chicken', chicken);
  registry.register('animal.cow', cow);
  registry.register('animal.sheep', sheep);
  registry.register('npc.bento', bento);
  registry.register('smithy', smithy);
  registry.register('shipping.bin', shippingBin);
  registry.register('kitchen', kitchen);
  registry.register('workbench', workbench);
  registry.register('greenhouse', greenhouse);
  registry.register('machine.keg', keg);
  registry.register('machine.press', press);
  registry.register('machine.wheel', wheel);
  registry.register('machine.pad', () => group('machine.pad', vcMesh([box(0.95, 0.08, 0.95, 0, 0.04, 0, WOOD_LIGHT), ...[-0.3, 0, 0.3].map(x => box(0.02, 0.085, 0.9, x, 0.045, 0, WOOD))], 'pad', false)));
  for (const ore of Object.keys(ORE_COLORS) as (keyof typeof ORE_COLORS)[]) registry.register(`node.${ore}`, () => oreRock(ore));
  registry.register('node.rubble', () => group('node.rubble', vcMesh([dot(0.12, 0.07, 0.1, -0.1, 0.03, 0, 0xa9a39a), dot(0.09, 0.05, 0.08, 0.12, 0.02, 0.08, 0x9a948c), dot(0.07, 0.04, 0.07, 0.02, 0.02, -0.12, 0xb5afa4)], 'rubble', false)));
  registry.register('stump', stump);
  registry.register('marker.ready', readyMarker);
  for (const kind of ['butterfly', 'ladybug', 'bee', 'grasshopper', 'snail', 'firefly', 'caterpillar', 'beetle']) registry.register(`bug.${kind}`, () => bug(kind));
}
