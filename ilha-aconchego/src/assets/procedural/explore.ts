import * as THREE from 'three';
import { materials } from '../../render/materials';
import type { AssetRegistry } from '../registry';
import { bake, ball, box, cone, cyl, dot, group, meshOf, merge, torus, vcMesh } from './parts';

/**
 * Stage 6 placeholders: region scenery, puzzle pieces, the cute creatures, the mine, the festival
 * decorations and the museum's new wings. Glowing parts are named "lamp" (night-glow material) or use
 * their own emissive material ("glow").
 */

type Parts = THREE.BufferGeometry[];
const WOOD = 0xc69058, WOOD2 = 0xa8743f, DARK = 0x7a4f2e, CREAM = 0xf6ebd9, WHITE = 0xfaf7f0, PINK = 0xf27ba5, YELLOW = 0xf2c14e, RED = 0xe5484d;
const GREEN = 0x5e9c42, LEAF = 0x7cc45e, STONE = 0xb8b2a6, STONE2 = 0x8f897e, METAL = 0x4a4a52, GOLD = 0xe2b33c;

const one = (name: string, parts: Parts, castShadow = true) => group(name, vcMesh(parts, 'body', castShadow));
const glowMat = (color: number, intensity = 1) => new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: intensity });
const withGlow = (g: THREE.Group, parts: Parts, color: number, intensity = 1) => {
  const m = meshOf(merge(parts), glowMat(color, intensity), 'glow', false);
  g.add(m);
  return g;
};
const eyes = (y: number, z: number, spread = 0.1, size = 0.05): Parts => [-1, 1].flatMap(s => [dot(size, size * 1.2, size * 0.6, s * spread, y, z, 0x2a1e1e), dot(size * 0.35, size * 0.35, size * 0.3, s * spread + size * 0.3, y + size * 0.4, z + size * 0.4, 0xffffff)]);

const ASSETS: Record<string, () => THREE.Object3D> = {
  // ---------- Beach ----------
  'region.tidepool': () => one('tidepool', [cyl(1.1, 1.15, 0.12, 0, 0.04, 0, STONE2, 16), cyl(0.95, 0.95, 0.04, 0, 0.1, 0, 0x5fc7d8, 16), ball(0.12, 0.08, 0.12, 0.4, 0.12, 0.2, PINK), dot(0.1, 0.05, 0.1, -0.3, 0.12, -0.2, YELLOW), ball(0.25, 0.18, 0.2, 0.9, 0.12, -0.5, STONE)], false),
  'region.coral': () => one('coral', [cyl(0.05, 0.08, 0.6, 0, 0.3, 0, 0xf28b82, 6), cyl(0.04, 0.06, 0.4, 0.15, 0.25, 0.05, 0xf28b82, 6, 0, 0, -0.5), cyl(0.04, 0.06, 0.45, -0.14, 0.28, -0.04, 0xf7a1c4, 6, 0, 0, 0.5), ball(0.08, 0.08, 0.08, 0, 0.62, 0, 0xffb3a7)]),
  'region.sign': () => one('sign', [box(0.08, 0.9, 0.08, 0, 0.45, 0, WOOD2), box(0.7, 0.42, 0.06, 0, 0.9, 0.02, WOOD), box(0.56, 0.04, 0.02, 0, 0.98, 0.06, DARK), box(0.42, 0.04, 0.02, 0, 0.86, 0.06, DARK)]),
  'region.pier': () => {
    const p: Parts = [];
    for (let i = 0; i < 9; i++) p.push(box(1.6, 0.1, 0.46, 0, 0.12, i * 0.5, i % 2 ? WOOD : WOOD2));
    for (const z of [0, 2, 4]) for (const x of [-0.75, 0.75]) p.push(cyl(0.08, 0.08, 1.2, x, -0.4, z, DARK, 8));
    return one('pier', p);
  },
  // ---------- Forest ----------
  'region.bigTree': () => {
    const p: Parts = [cyl(0.42, 0.6, 2.4, 0, 1.2, 0, 0x7a5232, 10), ...[0, 2.1, 4.2].map(a => cyl(0.12, 0.22, 0.9, Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5, 0x6b4a2c, 6, Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8))];
    for (const [x, y, z, r] of [[0, 3.2, 0, 1.5], [0.9, 2.7, 0.4, 1.0], [-0.8, 2.8, -0.3, 1.05], [0.2, 3.9, -0.3, 0.95]] as const) p.push(ball(r, r * 0.85, r, x, y, z, x > 0 ? GREEN : 0x4f8c3a));
    return one('bigTree', p);
  },
  'region.mushrooms': () => one('mushrooms', [cyl(0.06, 0.08, 0.35, 0, 0.17, 0, CREAM, 8), ball(0.22, 0.12, 0.22, 0, 0.36, 0, RED), dot(0.04, 0.03, 0.04, 0.08, 0.45, 0.06, WHITE), cyl(0.04, 0.05, 0.22, 0.25, 0.11, 0.1, CREAM, 8), ball(0.14, 0.08, 0.14, 0.25, 0.23, 0.1, 0xd9734f), cyl(0.04, 0.05, 0.18, -0.2, 0.09, 0.12, CREAM, 8), ball(0.11, 0.07, 0.11, -0.2, 0.19, 0.12, RED)]),
  'region.log': () => one('log', [cyl(0.32, 0.32, 1.8, 0, 0.3, 0, 0x7a5232, 12, 0, 0, Math.PI / 2), cyl(0.27, 0.27, 0.02, 0.91, 0.3, 0, 0xc69a6b, 12, 0, 0, Math.PI / 2), ball(0.12, 0.06, 0.12, 0.3, 0.6, 0.05, LEAF)]),
  'region.berryBush': () => one('berryBush', [ball(0.45, 0.38, 0.45, 0, 0.36, 0, 0x4f8c3a), ...[[0.2, 0.55, 0.3], [-0.25, 0.5, 0.25], [0.3, 0.35, -0.2], [-0.1, 0.65, -0.1], [0.05, 0.45, 0.42]].map(([x, y, z]) => dot(0.06, 0.06, 0.06, x!, y!, z!, 0x3f2a6b))]),
  // ---------- Volcano ----------
  'region.lava': () => {
    const g = one('lava', [cyl(1.85, 1.95, 0.14, 0, 0.04, 0, 0x3a2f30, 20)], false);
    return withGlow(g, [cyl(1.6, 1.6, 0.04, 0, 0.12, 0, 0xff6a2a, 20), ball(0.25, 0.08, 0.25, 0.5, 0.15, 0.3, 0xffb347)], 0xff6a2a, 0.9);
  },
  'region.basalt': () => one('basalt', [cyl(0.35, 0.35, 1.3, 0, 0.65, 0, 0x3a3436, 6), cyl(0.3, 0.3, 0.9, 0.5, 0.45, 0.1, 0x45403f, 6), cyl(0.28, 0.28, 1.6, -0.25, 0.8, 0.45, 0x332e30, 6)]),
  'region.vent': () => withGlow(one('vent', [cyl(0.42, 0.5, 0.3, 0, 0.15, 0, 0x45403f, 10)]), [cyl(0.22, 0.22, 0.04, 0, 0.31, 0, 0xffa94d)], 0xff8a3d, 0.8),
  'region.oreRock': () => withGlow(one('oreRock', [ball(0.6, 0.45, 0.55, 0, 0.35, 0, 0x4a4244), ball(0.35, 0.3, 0.35, 0.35, 0.25, 0.25, 0x3e3739)]), [cone(0.09, 0.3, 0.1, 0.75, 0.15, 0xff7b54, 5), cone(0.07, 0.24, -0.2, 0.68, 0.25, 0xffb347, 5), cone(0.06, 0.2, 0.3, 0.55, -0.15, 0x9be7ff, 5)], 0xff9a5a, 0.6),
  // ---------- Clouds ----------
  'region.rainbow': () => {
    const colors = [0xf28b82, 0xf7b267, 0xf9e07a, 0x9ad9a0, 0x8ec5f2, 0xb69ef2];
    return one('rainbow', colors.map((c, i) => bakeArc(2.4 - i * 0.12, 0.07, c)), false);
  },
  'region.starLamp': () => withGlow(one('starLamp', [cyl(0.04, 0.05, 1.5, 0, 0.75, 0, 0xdfe3f7, 6)]), [cone(0.16, 0.3, 0, 1.68, 0, 0xfff1a8, 5), cone(0.16, 0.3, 0, 1.68, 0, 0xfff1a8, 5, Math.PI)], 0xffe680, 0.9),
  'region.cloudPuff': () => one('cloudPuff', [ball(0.6, 0.4, 0.5, 0, 0.35, 0, WHITE), ball(0.42, 0.32, 0.38, 0.45, 0.3, 0.1, 0xf2f4ff), ball(0.38, 0.3, 0.35, -0.42, 0.28, -0.05, 0xf2f4ff)]),
  'region.crystalPillar': () => withGlow(one('crystalPillar', [cyl(0.32, 0.38, 0.2, 0, 0.1, 0, 0xdfe3f7, 8)]), [cone(0.22, 1.3, 0, 0.85, 0, 0xb9a1e6, 6), cone(0.12, 0.7, 0.2, 0.5, 0.1, 0x9be7ff, 6, 0, 0, -0.3)], 0xb9a1e6, 0.5),
  'region.windPad': () => {
    const g = one('windPad', [cyl(0.55, 0.6, 0.06, 0, 0.03, 0, 0xdfe3f7, 18)], false);
    return withGlow(g, [torus(0.42, 0.04, 0, 0.08, 0, 0x8ec5f2, Math.PI / 2), torus(0.25, 0.035, 0, 0.09, 0, 0xb9e3ff, Math.PI / 2)], 0x8ec5f2, 0.5);
  },
  // ---------- Things to pick up and tall grass ----------
  'forage.beach': () => one('forage', [ball(0.16, 0.06, 0.14, 0, 0.05, 0, 0xf7d9c4), ball(0.1, 0.04, 0.09, 0.18, 0.04, 0.1, 0xf5b3a4), dot(0.05, 0.05, 0.05, -0.12, 0.05, 0.08, 0xffffff)], false),
  'forage.forest': () => one('forage', [ball(0.35, 0.3, 0.35, 0, 0.28, 0, 0x4f8c3a), ...[[0.15, 0.45, 0.22], [-0.2, 0.4, 0.18], [0.22, 0.28, -0.15], [0.02, 0.52, -0.05]].map(([x, y, z]) => dot(0.055, 0.055, 0.055, x!, y!, z!, 0x3f2a6b))]),
  'forage.volcano': () => one('forage', [ball(0.28, 0.14, 0.24, 0, 0.08, 0, 0x6b5e5a), torus(0.09, 0.025, 0.05, 0.18, 0.05, 0xd9c8a4, 0.3)], false),
  'forage.clouds': () => withGlow(group('forage'), [cone(0.1, 0.18, 0, 0.25, 0, 0xfff1a8, 5), cone(0.1, 0.18, 0, 0.25, 0, 0xfff1a8, 5, Math.PI), dot(0.05, 0.05, 0.05, 0.2, 0.15, 0.1, 0xffffff)], 0xffe680, 0.9),
  'region.tallGrass': () => grassClump(0x6fb85a, 0x4f8c3a),
  'region.ashGrass': () => grassClump(0x8a7f74, 0x6b5e5a),
  'region.cloudGrass': () => grassClump(0xdfe8ff, 0xb9c8f2),
  // ---------- Puzzles ----------
  'puzzle.blockSand': () => one('block', [box(0.92, 0.9, 0.92, 0, 0.45, 0, 0xe4c98f), box(0.94, 0.06, 0.94, 0, 0.88, 0, 0xd8bb7d), dot(0.12, 0.05, 0.1, 0.15, 0.92, 0.1, 0xf7d9c4)]),
  'puzzle.blockBasalt': () => one('block', [box(0.92, 0.9, 0.92, 0, 0.45, 0, 0x45403f), box(0.94, 0.06, 0.94, 0, 0.88, 0, 0x3a3436)]),
  'puzzle.plateShell': () => one('plate', [cyl(0.46, 0.48, 0.05, 0, 0.025, 0, 0xf7d9c4, 14), ...[0, 1, 2, 3, 4].map(i => box(0.05, 0.02, 0.4, 0, 0.06, 0, 0xe8b8a0, 0, (i * Math.PI) / 5))], false),
  'puzzle.plateVent': () => withGlow(one('plate', [cyl(0.46, 0.5, 0.08, 0, 0.04, 0, 0x45403f, 12)], false), [cyl(0.25, 0.25, 0.02, 0, 0.09, 0, 0xffa94d)], 0xff8a3d, 0.8),
  'puzzle.switch': () => one('switch', [cyl(0.08, 0.1, 0.4, 0, 0.2, 0, CREAM, 8), ball(0.3, 0.16, 0.3, 0, 0.42, 0, 0xb892ff), dot(0.06, 0.04, 0.06, 0.12, 0.54, 0.08, WHITE), dot(0.05, 0.04, 0.05, -0.1, 0.52, -0.1, WHITE)]),
  'puzzle.bell': () => one('bell', [box(0.08, 1.4, 0.08, -0.4, 0.7, 0, 0xdfe3f7), box(0.08, 1.4, 0.08, 0.4, 0.7, 0, 0xdfe3f7), box(0.9, 0.08, 0.1, 0, 1.4, 0, 0xdfe3f7), cone(0.22, 0.3, 0, 1.15, 0, GOLD, 12), dot(0.06, 0.06, 0.06, 0, 0.98, 0, 0xb8862e)]),
  'puzzle.chest': () => one('chest', [box(0.8, 0.42, 0.55, 0, 0.21, 0, 0xb5733d), box(0.82, 0.2, 0.57, 0, 0.5, 0, 0xc98a4b), box(0.84, 0.06, 0.06, 0, 0.42, 0.28, GOLD), box(0.1, 0.16, 0.04, 0, 0.36, 0.29, GOLD)]),
  'puzzle.chestOpen': () => one('chest', [box(0.8, 0.42, 0.55, 0, 0.21, 0, 0xb5733d), box(0.82, 0.08, 0.57, 0, 0.62, -0.28, 0xc98a4b, -1.2), box(0.7, 0.04, 0.45, 0, 0.42, 0, 0x3a2516)]),
  'wall.rock': () => one('wall', [ball(0.55, 0.5, 0.5, 0, 0.35, 0, STONE2), ball(0.4, 0.35, 0.38, 0.3, 0.25, 0.2, STONE)]),
  'wall.bramble': () => one('wall', [ball(0.55, 0.5, 0.5, 0, 0.45, 0, 0x3e6b2f), ...[[0.3, 0.6, 0.3], [-0.25, 0.55, 0.32], [0.1, 0.8, 0.2]].map(([x, y, z]) => cone(0.04, 0.12, x!, y!, z!, 0x8a5a3c, 4))]),
  'wall.crater': () => one('wall', [ball(0.55, 0.55, 0.5, 0, 0.4, 0, 0x3a3436), ball(0.35, 0.3, 0.32, 0.3, 0.22, 0.2, 0x4a4244)]),
  'wall.steam': () => {
    const g = group('wall');
    const m = meshOf(merge([ball(0.45, 0.6, 0.45, 0, 0.6, 0, 0xffffff), ball(0.35, 0.5, 0.35, 0.25, 1.1, 0.1, 0xffffff), ball(0.3, 0.4, 0.3, -0.2, 1.4, -0.1, 0xffffff)]), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), 'steam', false);
    g.add(m);
    return g;
  },
  // ---------- Creatures ----------
  'creature.bubble': () => {
    const g = group('creature');
    const body = meshOf(new THREE.SphereGeometry(0.42, 18, 12).scale(1, 0.8, 1).translate(0, 0.34, 0), new THREE.MeshLambertMaterial({ color: 0x7fe0e8, transparent: true, opacity: 0.85 }), 'body');
    g.add(body, vcMesh([...eyes(0.42, 0.36), ball(0.08, 0.05, 0.03, 0, 0.3, 0.38, 0xf27ba5), dot(0.1, 0.06, 0.05, 0.18, 0.62, 0.15, 0xffffff)], 'face', false));
    return g;
  },
  'creature.moss': () => one('creature', [ball(0.42, 0.36, 0.42, 0, 0.36, 0, 0x7cc45e), ball(0.18, 0.08, 0.1, 0, 0.78, 0, 0x4f8c3a, 0, 0, 0.6), ...eyes(0.42, 0.38), ball(0.07, 0.04, 0.03, 0, 0.3, 0.4, 0xf7b6c8)]),
  'creature.ember': () => {
    const g = one('creature', [...eyes(0.42, 0.35, 0.1, 0.055)]);
    return withGlow(g, [ball(0.38, 0.4, 0.38, 0, 0.38, 0, 0xff8a3d), cone(0.22, 0.4, 0, 0.82, 0, 0xffc061, 7), cone(0.12, 0.25, 0.18, 0.72, 0.05, 0xffc061, 6, 0, 0, -0.4)], 0xff7b2e, 0.6);
  },
  'creature.puff': () => one('creature', [ball(0.42, 0.32, 0.38, 0, 0.42, 0, WHITE), ball(0.28, 0.24, 0.26, 0.3, 0.48, 0, 0xf2f4ff), ball(0.26, 0.22, 0.24, -0.3, 0.46, 0, 0xf2f4ff), ...eyes(0.46, 0.34), ball(0.06, 0.04, 0.03, 0, 0.36, 0.37, 0xf7b6c8)]),
  'creature.dust': () => one('creature', [ball(0.38, 0.32, 0.38, 0, 0.32, 0, 0x8f897e), ...[0, 1, 2, 3, 4, 5].map(i => cone(0.06, 0.16, Math.cos(i) * 0.34, 0.36 + Math.sin(i * 2) * 0.1, Math.sin(i) * 0.34, 0x7a746a, 4, 0, 0, Math.cos(i) * 1.2)), ...eyes(0.38, 0.32)]),
  // ---------- Mine ----------
  'mine.cave': () => one('cave', [
    ball(1.4, 1.2, 1.1, 0, 0.5, 0, STONE2), ball(0.9, 0.8, 0.8, 0.7, 0.4, 0.6, STONE), ball(0.8, 0.7, 0.7, -0.6, 0.35, 0.6, STONE),
    box(1.0, 1.3, 0.2, 0, 0.65, 1.0, 0x1d1714), box(0.14, 1.5, 0.16, -0.58, 0.75, 1.06, WOOD2), box(0.14, 1.5, 0.16, 0.58, 0.75, 1.06, WOOD2), box(1.3, 0.16, 0.18, 0, 1.45, 1.06, WOOD2),
    cyl(0.04, 0.04, 0.4, 0.82, 1.1, 1.1, DARK, 5), ball(0.08, 0.1, 0.08, 0.82, 1.35, 1.1, 0xffb347),
  ]),
  'mine.wall': () => one('wall', [box(1, 1.3, 1, 0, 0.65, 0, 0x6b5e55), box(1.02, 0.12, 1.02, 0, 1.3, 0, 0x5a4e46)]),
  'mine.wallLow': () => one('wall', [box(1, 0.3, 1, 0, 0.15, 0, 0x6b5e55), box(1.02, 0.08, 1.02, 0, 0.3, 0, 0x5a4e46)]),
  'mine.rock': () => one('rock', [ball(0.42, 0.34, 0.4, 0, 0.26, 0, 0x8f897e), ball(0.24, 0.2, 0.22, 0.24, 0.18, 0.18, 0xa39d92), dot(0.06, 0.05, 0.05, -0.15, 0.42, 0.2, 0xd9a066)]),
  'mine.crystalRock': () => withGlow(one('rock', [ball(0.42, 0.34, 0.4, 0, 0.26, 0, 0x7d7690)]), [cone(0.09, 0.32, 0.1, 0.62, 0.05, 0x9be7ff, 5), cone(0.07, 0.24, -0.18, 0.52, 0.12, 0xb9a1e6, 5)], 0x9be7ff, 0.5),
  'mine.ladder': () => one('ladder', [box(0.9, 0.02, 0.9, 0, 0.01, 0, 0x120d0b), box(0.06, 0.04, 0.9, -0.3, 0.03, 0, WOOD), box(0.06, 0.04, 0.9, 0.3, 0.03, 0, WOOD), ...[-0.3, 0, 0.3].map(z => box(0.6, 0.03, 0.06, 0, 0.04, z, WOOD2))], false),
  'mine.rope': () => one('rope', [cyl(0.03, 0.03, 2.2, 0, 1.1, 0, 0xd9b979, 6), torus(0.12, 0.03, 0, 0.1, 0, 0xd9b979, Math.PI / 2), box(0.6, 0.06, 0.4, 0, 2.2, 0, WOOD2)]),
  'mine.elevator': () => one('elevator', [box(1.2, 0.08, 1.2, 0, 0.04, 0, METAL), ...[-1, 1].flatMap(sx => [-1, 1].map(sz => box(0.06, 2.2, 0.06, sx * 0.55, 1.1, sz * 0.55, 0x8a8a90))), box(1.2, 0.08, 1.2, 0, 2.2, 0, METAL), box(0.3, 0.4, 0.06, 0.4, 1.1, 0.58, YELLOW)]),
  'mine.torch': () => withGlow(one('torch', [box(0.06, 0.5, 0.06, 0, 0.25, 0, DARK)]), [ball(0.09, 0.12, 0.09, 0, 0.55, 0, 0xffb347)], 0xffa94d, 1),
  'mine.treasure': () => one('treasure', [box(0.9, 0.5, 0.6, 0, 0.25, 0, 0x7d4e9c), box(0.92, 0.22, 0.62, 0, 0.6, 0, 0x9466b3), box(0.94, 0.06, 0.06, 0, 0.5, 0.31, GOLD), dot(0.08, 0.08, 0.05, 0, 0.42, 0.32, 0x9be7ff)]),
  // ---------- Festival decorations (the market square) ----------
  'festival.stand': () => one('stand', [box(1.6, 0.8, 0.7, 0, 0.4, 0, WOOD), box(1.7, 0.06, 0.8, 0, 0.82, 0, WOOD2), box(0.06, 1.4, 0.06, -0.78, 1.5, -0.3, WOOD2), box(0.06, 1.4, 0.06, 0.78, 1.5, -0.3, WOOD2), ...Array.from({ length: 6 }, (_, i) => box(0.3, 0.05, 1.0, -0.75 + i * 0.3, 2.2, 0, i % 2 ? CREAM : PINK, 0.2)), box(1.0, 0.3, 0.04, 0, 1.1, 0.36, CREAM)]),
  'festival.flowers': () => one('festival', [
    ...[-1, 1].map(s => cyl(0.06, 0.06, 2.0, s * 1.0, 1.0, 0, GREEN, 6)), torus(1.0, 0.07, 0, 2.0, 0, GREEN, 0, 0, 0),
    ...Array.from({ length: 14 }, (_, i) => { const a = (i / 13) * Math.PI; return ball(0.12, 0.1, 0.12, Math.cos(a) * 1.0, 1.98 + Math.sin(a) * 1.0 - 1.0, 0, [PINK, YELLOW, WHITE, 0xb892ff][i % 4]!); }),
    cyl(0.25, 0.2, 0.3, 1.3, 0.15, 0.3, 0xc0704a, 10), ball(0.3, 0.25, 0.3, 1.3, 0.45, 0.3, PINK), cyl(0.25, 0.2, 0.3, -1.3, 0.15, 0.3, 0xc0704a, 10), ball(0.3, 0.25, 0.3, -1.3, 0.45, 0.3, YELLOW),
  ]),
  'festival.lanterns': () => {
    const g = one('festival', [cyl(0.04, 0.04, 2.4, -1.4, 1.2, 0, DARK, 6), cyl(0.04, 0.04, 2.4, 1.4, 1.2, 0, DARK, 6), cyl(0.008, 0.008, 2.8, 0, 2.3, 0, CREAM, 4, 0, 0, Math.PI / 2)]);
    return withGlow(g, [-1, -0.33, 0.33, 1].map((x, i) => ball(0.18, 0.24, 0.18, x, 2.0 - Math.abs(x) * 0.1, 0, [RED, YELLOW, PINK, 0xff9f43][i]!)), 0xffb347, 0.8);
  },
  'festival.harvest': () => one('festival', [
    box(1.0, 0.5, 0.6, 0, 0.25, 0, 0xe6c46a), box(0.6, 0.45, 0.5, 0.75, 0.22, 0.35, 0xe6c46a), ball(0.3, 0.24, 0.3, -0.6, 0.24, 0.4, 0xf28c38), ball(0.22, 0.18, 0.22, -0.2, 0.68, 0.1, 0xf28c38),
    ...[-0.9, -0.75].map(x => cyl(0.03, 0.03, 1.4, x, 0.7, -0.3, 0xc9a24a, 5)), ball(0.12, 0.3, 0.12, -0.82, 1.3, -0.3, YELLOW), dot(0.06, 0.06, 0.06, 0.75, 0.5, 0.35, GREEN),
  ]),
  'festival.snow': () => {
    const g = one('festival', [cone(0.8, 1.2, 0, 0.9, 0, 0x2f6b3a, 8), cone(0.6, 1.0, 0, 1.6, 0, 0x2f6b3a, 8), cone(0.4, 0.8, 0, 2.2, 0, 0x2f6b3a, 8), cyl(0.12, 0.14, 0.3, 0, 0.15, 0, DARK, 6),
      ball(0.4, 0.38, 0.4, 1.4, 0.38, 0.2, WHITE), ball(0.28, 0.26, 0.28, 1.4, 0.95, 0.2, WHITE), cone(0.05, 0.18, 1.4, 0.95, 0.5, 0xf28c38, 6, Math.PI / 2)]);
    return withGlow(g, [...Array.from({ length: 10 }, (_, i) => dot(0.06, 0.06, 0.06, Math.cos(i * 2.4) * (0.7 - i * 0.05), 0.6 + i * 0.18, Math.sin(i * 2.4) * (0.7 - i * 0.05), [RED, YELLOW, 0x8ec5f2][i % 3]!)), cone(0.12, 0.2, 0, 2.7, 0, YELLOW, 5)], 0xfff1a8, 0.8);
  },
  // ---------- Festival prizes (decorations) ----------
  'decor.flowerArch': () => one('flowerArch', [...[-1, 1].map(s => cyl(0.05, 0.05, 1.8, s * 0.85, 0.9, 0, WHITE, 6)), torus(0.85, 0.05, 0, 1.8, 0, WHITE), ...Array.from({ length: 12 }, (_, i) => { const a = (i / 11) * Math.PI; return ball(0.11, 0.09, 0.11, Math.cos(a) * 0.85, 1.8 + Math.sin(a) * 0.85 - 0.85 + 0.85, 0, [PINK, YELLOW, WHITE, 0xb892ff][i % 4]!); })]),
  'decor.paperLantern': () => withGlow(one('paperLantern', [cyl(0.03, 0.03, 1.4, 0, 0.7, 0, DARK, 5), box(0.3, 0.03, 0.03, 0.12, 1.4, 0, DARK)]), [ball(0.18, 0.24, 0.18, 0.25, 1.15, 0, RED)], 0xff8a5a, 0.8),
  'decor.jackLantern': () => withGlow(one('jackLantern', [ball(0.36, 0.3, 0.36, 0, 0.3, 0, 0xf28c38), cyl(0.04, 0.05, 0.12, 0, 0.62, 0, GREEN, 5)]), [box(0.08, 0.08, 0.02, -0.1, 0.36, 0.35, 0xffd166), box(0.08, 0.08, 0.02, 0.1, 0.36, 0.35, 0xffd166), box(0.18, 0.05, 0.02, 0, 0.22, 0.35, 0xffd166)], 0xffb347, 1),
  'decor.snowGlobe': () => {
    const g = one('snowGlobe', [cyl(0.32, 0.36, 0.2, 0, 0.1, 0, 0x8a5a34, 14), cone(0.12, 0.25, 0, 0.36, 0, 0x2f6b3a, 6), ball(0.08, 0.08, 0.08, 0.12, 0.28, 0.05, WHITE)]);
    g.add(meshOf(new THREE.SphereGeometry(0.3, 18, 12).translate(0, 0.42, 0), new THREE.MeshLambertMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.35, depthWrite: false }), 'glass', false));
    return g;
  },
  // ---------- The museum grows ----------
  'museum.banners': () => one('banners', [...[-2.2, 2.2].flatMap(x => [cyl(0.04, 0.04, 2.6, x, 1.3, 0, DARK, 5), box(0.5, 0.9, 0.03, x + 0.27, 2.0, 0, x < 0 ? 0x3e5c8a : 0xb83a4b)]), cyl(0.3, 0.25, 0.3, -1.4, 0.15, 0.2, 0xc0704a, 10), ball(0.32, 0.26, 0.32, -1.4, 0.45, 0.2, PINK), cyl(0.3, 0.25, 0.3, 1.4, 0.15, 0.2, 0xc0704a, 10), ball(0.32, 0.26, 0.32, 1.4, 0.45, 0.2, YELLOW)]),
  'museum.wing': () => one('wing', [box(2.6, 2.2, 3.0, 0, 1.1, 0, 0xe9dcc3), box(2.9, 0.2, 3.3, 0, 2.3, 0, 0xc9b79a), cone(1.9, 0.9, 0, 2.85, 0, 0x9c6b3e, 4, 0, Math.PI / 4), ...[-0.6, 0.6].map(z => box(0.06, 0.9, 0.7, 1.31, 1.3, z, 0x8ec5f2)), box(0.06, 1.0, 0.8, -1.31, 1.2, 0, 0x8ec5f2)]),
  'museum.dome': () => one('dome', [cyl(1.1, 1.2, 0.4, 0, 0.2, 0, 0xe9dcc3, 18), bake(new THREE.SphereGeometry(1.05, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), { y: 0.4 }, 0xb8d8e8), cyl(0.06, 0.06, 0.5, 0, 1.6, 0, GOLD, 6), dot(0.1, 0.1, 0.1, 0, 1.9, 0, GOLD)]),
  'museum.statue': () => {
    const bone = 0xf1e6cc;
    const p: Parts = [box(1.6, 0.3, 0.8, 0, 0.15, 0, STONE), ball(0.3, 0.22, 0.25, 0.6, 1.3, 0, bone), cyl(0.06, 0.06, 0.8, 0.35, 1.0, 0, bone, 6, 0, 0, 0.9)];
    for (let i = 0; i < 6; i++) p.push(torus(0.18 - i * 0.015, 0.03, -0.1 - i * 0.2, 0.9 - i * 0.04, 0, bone, 0, Math.PI / 2, 0));
    for (const [x, z] of [[0.1, 0.18], [0.1, -0.18], [-0.8, 0.18], [-0.8, -0.18]]) p.push(cyl(0.04, 0.05, 0.6, x!, 0.6, z!, bone, 5));
    p.push(cyl(0.03, 0.06, 0.9, -1.3, 0.8, 0, bone, 5, 0, 0, -1.0));
    return one('statue', p);
  },
};

/** A half ring (an arch) of a given radius, standing up. */
function bakeArc(radius: number, tube: number, color: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(radius, tube, 6, 28, Math.PI);
  const c = new THREE.Color(color);
  const count = g.attributes.position!.count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).map((_, i) => [c.r, c.g, c.b][i % 3]!), 3));
  return g.toNonIndexed();
}

function grassClump(light: number, dark: number): THREE.Object3D {
  const p: Parts = [];
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4, r = 0.15 + (i % 4) * 0.12;
    p.push(cone(0.06, 0.55 + (i % 3) * 0.18, Math.cos(a) * r, 0.3, Math.sin(a) * r, i % 2 ? light : dark, 4, Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25));
  }
  return one('tallGrass', p);
}

export function registerExplore(registry: AssetRegistry): void {
  for (const [name, make] of Object.entries(ASSETS)) registry.register(name, make);
  void materials;
}
