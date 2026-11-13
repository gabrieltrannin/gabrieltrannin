import * as THREE from 'three';
import { CROPS, FARM_CROPS, type CropId, type FarmCropId } from '../../data/crops';
import { LIGHT_POLE_HEIGHT } from '../../data/map';
import { materials } from '../../render/materials';
import { paintSign } from '../../render/textures';
import type { AssetRegistry } from '../registry';
import { ball, box, cone, cyl, group, meshOf, pumpkinGeometry, torus, bake, vcMesh } from './parts';

const WOOD = 0x9c6b3c;
const WOOD_LIGHT = 0xd9b48a;
const DARK_WOOD = 0x4e3626;
const IRON = 0x3a3a40;
const GREEN = 0x4e9b47;
const GREEN_LIGHT = 0x5dae4a;
const SNOW = 0xf4f8fb;

/** Size of one farm bed (all four beds are the same size). */
export const BED_SIZE = { width: 4.2, depth: 3.2 } as const;

/** Leaves arranged in a ring (lettuce, cabbage, kale). */
const leafRing = (turn: number, n: number, r: number, y: number, size: number, color: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + turn;
    return ball(size, 0.03, size * 0.55, Math.cos(a) * r, y, Math.sin(a) * r, color, 0, -a, 0.25);
  });

function wheat(ripe: boolean): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4, r = 0.06 + (k % 3) * 0.06, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const tz = Math.cos(a) * 0.12, tx = -Math.sin(a) * 0.12;
    parts.push(cyl(0.012, 0.012, 0.72, x, 0.36, z, ripe ? 0xd9b44a : 0x8dbf5a, 4, tz, 0, tx));
    parts.push(ball(0.035, 0.11, 0.035, x + Math.sin(a) * 0.05, 0.76, z + Math.cos(a) * 0.05, ripe ? 0xe8c65a : 0x9ccb66, tz, 0, tx));
  }
  return parts;
}

/** Decorative crop of each kind, sitting on its soil mound. Stage 3 adds growth stages. */
const CROP_PARTS: Record<CropId, () => THREE.BufferGeometry[]> = {
  strawberry: () => [
    ball(0.2, 0.13, 0.2, -0.08, 0.12, 0, GREEN), ball(0.17, 0.12, 0.17, 0.1, 0.12, 0.06, GREEN_LIGHT), ball(0.16, 0.11, 0.16, 0, 0.15, -0.1, GREEN),
    ball(0.065, 0.08, 0.065, 0.15, 0.1, 0.16, 0xe8384f), ball(0.065, 0.08, 0.065, -0.17, 0.09, 0.1, 0xe8384f), ball(0.06, 0.075, 0.06, 0.02, 0.1, 0.22, 0xe8384f),
    ball(0.05, 0.02, 0.05, -0.02, 0.27, 0.02, 0xffffff),
  ],
  lettuce: () => [ball(0.2, 0.17, 0.2, 0, 0.17, 0, 0xb5de8a), ...leafRing(0, 5, 0.17, 0.1, 0.2, 0x6fb85a)],
  sprout: () => [cyl(0.016, 0.016, 0.2, 0, 0.1, 0, 0x5c9e4a, 5), ball(0.1, 0.025, 0.055, 0.08, 0.21, 0, 0x7ccb5e, 0, 0, 0.4), ball(0.1, 0.025, 0.055, -0.08, 0.21, 0, 0x7ccb5e, 0, 0, -0.4)],
  carrot: () => [
    cone(0.1, 0.26, 0, 0.02, 0, 0xf08a2b, 8, Math.PI),
    cone(0.035, 0.45, 0.04, 0.34, 0, GREEN_LIGHT, 5, 0, 0, -0.25),
    cone(0.035, 0.48, -0.04, 0.35, 0.02, GREEN, 5, 0, 0, 0.25),
    cone(0.035, 0.42, 0, 0.32, -0.05, GREEN_LIGHT, 5, -0.25),
  ],
  tomato: () => [
    cyl(0.02, 0.02, 1.0, 0.2, 0.5, -0.12, 0xc9a273, 5),
    ball(0.25, 0.27, 0.23, 0, 0.4, 0, GREEN), ball(0.21, 0.23, 0.21, 0.05, 0.68, 0.02, GREEN_LIGHT), ball(0.18, 0.18, 0.18, -0.1, 0.86, 0, GREEN),
    ball(0.09, 0.09, 0.09, 0.18, 0.35, 0.16, 0xe5483b), ball(0.09, 0.09, 0.09, -0.18, 0.5, 0.15, 0xe5483b), ball(0.085, 0.085, 0.085, 0.13, 0.66, 0.19, 0xe5483b),
    ball(0.08, 0.08, 0.08, -0.05, 0.82, 0.17, 0xe5483b), ball(0.08, 0.08, 0.08, 0.21, 0.83, 0.05, 0xef6a45),
  ],
  wheatGreen: () => wheat(false),
  wheat: () => wheat(true),
  corn: () => [
    cyl(0.035, 0.045, 1.5, 0, 0.75, 0, 0x6fae4a, 6),
    ball(0.34, 0.025, 0.07, 0.2, 0.6, 0, GREEN_LIGHT, 0, 0, -0.5), ball(0.34, 0.025, 0.07, -0.2, 0.9, 0.05, GREEN_LIGHT, 0, 0, 0.5), ball(0.3, 0.025, 0.07, 0.15, 1.15, -0.05, 0x6fae4a, 0, 0, -0.6),
    ball(0.065, 0.18, 0.065, 0.08, 0.95, 0.07, 0xf2c94c), ball(0.07, 0.12, 0.07, 0.08, 0.86, 0.07, 0x8dbf5a), cone(0.05, 0.22, 0, 1.6, 0, 0xd9b44a, 5),
  ],
  pumpkin: () => [bake(pumpkinGeometry(), { y: 0.22, sx: 0.34, sy: 0.25, sz: 0.34 }, 0xf08a2b), cyl(0.035, 0.03, 0.12, 0, 0.5, 0, 0x6b4b2a, 6), ball(0.26, 0.03, 0.18, 0.3, 0.05, 0.12, 0x5e9c42, 0, 0.4), ball(0.24, 0.03, 0.16, -0.28, 0.05, -0.12, 0x5e9c42, 0, -0.5)],
  cabbage: () => [ball(0.22, 0.19, 0.22, 0, 0.19, 0, 0x9fcb7a), ...leafRing(0.3, 6, 0.19, 0.1, 0.22, 0x5e9c42)],
  kale: () => [ball(0.2, 0.17, 0.2, 0, 0.17, 0, 0x8a6bb8), ...leafRing(0.3, 6, 0.18, 0.1, 0.21, 0x6b4f96)],
  resting: () => [ball(0.42, 0.14, 0.4, 0, 0.04, 0, SNOW)],
};

export function registerFarm(registry: AssetRegistry): void {
  // Short log post; the fence is many of these in a row with slightly different heights.
  registry.register('fence.log', () => {
    const g = group('fence.log', vcMesh([cyl(0.12, 0.13, 1, 0, 0.5, 0, WOOD, 10), cyl(0.105, 0.105, 0.02, 0, 1.0, 0, WOOD_LIGHT, 10)], 'post'));
    g.scale.y = 0.6;
    return g;
  });

  // Raised bed: the wooden frame. Tilled soil is drawn per tile from the game state. Origin at the bed center.
  registry.register('bed.frame', () => {
    const { width: w, depth: d } = BED_SIZE;
    const parts = [
      box(w + 0.24, 0.22, 0.12, 0, 0.11, -d / 2 - 0.06, WOOD), box(w + 0.24, 0.22, 0.12, 0, 0.11, d / 2 + 0.06, WOOD),
      box(0.12, 0.22, d, -w / 2 - 0.06, 0.11, 0, WOOD), box(0.12, 0.22, d, w / 2 + 0.06, 0.11, 0, WOOD),
    ];
    return group('bed.frame', vcMesh(parts, 'frame'));
  });

  // Wooden sign with the crop drawing. The face mesh is named "sign_face"; call userData.paint(label, icon).
  registry.register('sign.crop', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 150;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const face = meshOf(new THREE.PlaneGeometry(1.04, 0.6), new THREE.MeshLambertMaterial({ map: texture }), 'sign_face', false);
    face.position.set(0, 0.75, 0.045);
    const g = group('sign.crop', vcMesh([box(1.12, 0.68, 0.08, 0, 0.75, 0, DARK_WOOD), cyl(0.05, 0.05, 0.9, -0.4, 0.45, -0.03, 0x6b4b2a, 6), cyl(0.05, 0.05, 0.9, 0.4, 0.45, -0.03, 0x6b4b2a, 6)], 'board'), face);
    g.userData.paint = (label: string, icon: string) => {
      paintSign(canvas, label, icon, 'crop');
      texture.needsUpdate = true;
    };
    return g;
  });

  registry.register('light.pole', () => group('light.pole', vcMesh([cyl(0.055, 0.07, LIGHT_POLE_HEIGHT, 0, LIGHT_POLE_HEIGHT / 2, 0, 0x5e4330, 8), ball(0.08, 0.08, 0.08, 0, LIGHT_POLE_HEIGHT, 0, 0x5e4330)], 'pole')));
  registry.register('light.bulb', () => group('light.bulb', meshOf(new THREE.SphereGeometry(0.065, 8, 6), materials().bulb, 'lamp', false)));

  registry.register('lantern.ground', () => {
    const frame = vcMesh([box(0.26, 0.08, 0.26, 0, 0.04, 0, IRON), box(0.06, 0.3, 0.06, -0.1, 0.23, -0.1, IRON), box(0.06, 0.3, 0.06, 0.1, 0.23, 0.1, IRON), cone(0.22, 0.16, 0, 0.46, 0, IRON, 4, 0, Math.PI / 4)], 'frame');
    const glass = meshOf(new THREE.BoxGeometry(0.2, 0.28, 0.2), materials().lantern, 'lamp', false);
    glass.position.y = 0.23;
    return group('lantern.ground', frame, glass);
  });

  registry.register('scarecrow', () =>
    group(
      'scarecrow',
      vcMesh([
        cyl(0.05, 0.05, 1.9, 0, 0.95, 0, 0x8a6a4a, 6), box(1.2, 0.06, 0.06, 0, 1.35, 0, 0x8a6a4a), box(0.55, 0.6, 0.3, 0, 1.25, 0, 0x4d7fb8),
        ball(0.24, 0.24, 0.24, 0, 1.8, 0, 0xe8d7b0), cyl(0.5, 0.5, 0.04, 0, 1.96, 0, 0xe6c77a, 18), cyl(0.22, 0.26, 0.22, 0, 2.08, 0, 0xe6c77a, 14),
        ball(0.05, 0.05, 0.05, -0.08, 1.82, 0.23, 0x2a1e1e), ball(0.05, 0.05, 0.05, 0.08, 1.82, 0.23, 0x2a1e1e),
        ball(0.12, 0.1, 0.1, -0.6, 1.35, 0, 0xe6c77a), ball(0.12, 0.1, 0.1, 0.6, 1.35, 0, 0xe6c77a),
      ], 'scarecrow'),
    ),
  );

  registry.register('wheelbarrow', () =>
    group(
      'wheelbarrow',
      vcMesh([
        box(0.8, 0.3, 0.55, 0, 0.45, 0, 0x6e8f5a), box(0.7, 0.06, 0.45, 0, 0.6, 0, 0x8b5e3c), cyl(0.2, 0.2, 0.07, -0.55, 0.22, 0, IRON, 14, Math.PI / 2),
        box(0.7, 0.05, 0.05, 0.6, 0.45, -0.2, 0x8b5e3c, 0, 0, 0.25), box(0.7, 0.05, 0.05, 0.6, 0.45, 0.2, 0x8b5e3c, 0, 0, 0.25),
        box(0.05, 0.3, 0.05, 0.25, 0.2, -0.2, 0x8b5e3c), box(0.05, 0.3, 0.05, 0.25, 0.2, 0.2, 0x8b5e3c),
        ball(0.18, 0.14, 0.18, -0.15, 0.72, -0.05, 0xf08a2b), ball(0.15, 0.12, 0.15, 0.15, 0.7, 0.05, 0xe5483b),
      ], 'wheelbarrow'),
    ),
  );

  registry.register('pump.water', () =>
    group(
      'pump.water',
      vcMesh([
        cyl(0.22, 0.26, 0.8, 0, 0.4, 0, 0x3e6b4e, 12), cyl(0.08, 0.08, 0.5, 0.3, 0.65, 0, 0x3e6b4e, 8, 0, 0, Math.PI / 2),
        box(0.5, 0.06, 0.06, -0.2, 0.9, 0, 0x3e6b4e, 0, 0, -0.4), cyl(0.3, 0.3, 0.2, 0.4, 0.1, 0, 0x8a6a4a, 14),
      ], 'pump'),
    ),
  );

  registry.register('snowman', () =>
    group(
      'snowman',
      vcMesh([
        ball(0.55, 0.55, 0.55, 0, 0.5, 0, SNOW), ball(0.4, 0.4, 0.4, 0, 1.22, 0, SNOW), ball(0.3, 0.3, 0.3, 0, 1.8, 0, SNOW),
        cone(0.06, 0.3, 0, 1.8, 0.38, 0xf08a2b, 6, Math.PI / 2), torus(0.3, 0.07, 0, 1.53, 0, 0xd9537d, Math.PI / 2),
        ball(0.04, 0.04, 0.04, -0.1, 1.88, 0.26, 0x2a1e1e), ball(0.04, 0.04, 0.04, 0.1, 1.88, 0.26, 0x2a1e1e),
        cyl(0.03, 0.03, 0.7, -0.5, 1.3, 0, 0x6b4b2a, 5, 0, 0, 1.0), cyl(0.03, 0.03, 0.7, 0.5, 1.3, 0, 0x6b4b2a, 5, 0, 0, -1.0),
      ], 'only:winter'),
    ),
  );

  registry.register('pumpkin.deco', () =>
    group('pumpkin.deco', vcMesh([bake(pumpkinGeometry(), { y: 0.22, sx: 0.32, sy: 0.24, sz: 0.32 }, 0xf08a2b), cyl(0.035, 0.03, 0.12, 0, 0.48, 0, 0x6b4b2a, 6), bake(pumpkinGeometry(), { x: 0.45, y: 0.17, z: 0.3, sx: 0.24, sy: 0.18, sz: 0.24 }, 0xf5a64a)], 'only:autumn')),
  );

  for (const crop of CROPS) registry.register(`crop.${crop}`, () => group(`crop.${crop}`, vcMesh(CROP_PARTS[crop](), 'crop')));

  // Growth stages: a seed mound, then a young plant (leaves without fruit), then the ripe crop.
  registry.register('crop.seed', () =>
    group('crop.seed', vcMesh([ball(0.2, 0.06, 0.2, 0, 0.03, 0, 0x5a3a22), ball(0.035, 0.025, 0.03, -0.06, 0.08, 0.02, 0xe8d6a8), ball(0.035, 0.025, 0.03, 0.05, 0.08, -0.04, 0xe8d6a8), ball(0.03, 0.02, 0.03, 0.02, 0.08, 0.07, 0xe8d6a8)], 'crop')),
  );
  for (const crop of FARM_CROPS) {
    registry.register(`crop.${crop}.young`, () => group(`crop.${crop}.young`, vcMesh(YOUNG_PARTS[crop](), 'crop')));
  }

  // Tilled soil of one farm tile, with furrows. Each copy is tinted darker when watered.
  registry.register('soil.tilled', () => {
    // Dark ploughed earth: a low mound with three rounded furrows and a few clods.
    const parts = [ball(0.46, 0.07, 0.46, 0, 0.02, 0, 0x5a3820)];
    for (const x of [-0.25, 0, 0.25]) parts.push(cyl(0.075, 0.075, 0.74, x, 0.075, 0, 0x6e4628, 8, Math.PI / 2));
    for (const [x, z] of [[-0.12, 0.3], [0.15, -0.28], [0.32, 0.12]] as const) parts.push(ball(0.04, 0.03, 0.04, x, 0.11, z, 0x7d5232));
    return group('soil.tilled', vcMesh(parts, 'soil', false));
  });

  // Copper sprinkler on a stone base.
  registry.register('farm.sprinkler', () =>
    group('farm.sprinkler', vcMesh([
      cyl(0.26, 0.3, 0.12, 0, 0.06, 0, 0xa8a49a, 10), cyl(0.05, 0.05, 0.4, 0, 0.3, 0, 0xc0773f, 8),
      ball(0.13, 0.08, 0.13, 0, 0.52, 0, 0xd28a4a), ...[0, 1, 2, 3].map(k => cyl(0.02, 0.02, 0.18, Math.cos(k * 1.57) * 0.12, 0.53, Math.sin(k * 1.57) * 0.12, 0x8a5a2e, 5, 0, -k * 1.57, Math.PI / 2)),
    ], 'sprinkler')),
  );
}

/** Young plant of each crop: the leaves of the ripe one, without the fruit. */
const YOUNG_PARTS: Record<FarmCropId, () => THREE.BufferGeometry[]> = {
  strawberry: () => CROP_PARTS.strawberry().slice(0, 3),
  lettuce: () => CROP_PARTS.lettuce(),
  carrot: () => CROP_PARTS.carrot().slice(1),
  wheat: () => CROP_PARTS.wheatGreen(),
  tomato: () => CROP_PARTS.tomato().slice(0, 4),
  corn: () => CROP_PARTS.corn().slice(0, 4),
  pumpkin: () => [...CROP_PARTS.pumpkin().slice(2), ball(0.12, 0.1, 0.12, 0.02, 0.1, 0, 0x8dbf5a)],
  cabbage: () => CROP_PARTS.cabbage(),
  kale: () => CROP_PARTS.kale(),
};
