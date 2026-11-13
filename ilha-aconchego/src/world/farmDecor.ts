import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import type { SeasonId } from '../data/calendar';
import { BED_CROPS_BY_SEASON, CROP_ICONS } from '../data/crops';
import { BED_COLUMNS, BED_ROWS, BEDS, FENCE_GATE_POSTS, FENCE_LINES, GROUND_LANTERNS, LEVELS, LIGHT_POLE_HEIGHT, LIGHT_POLES, LIGHT_STRINGS } from '../data/map';
import { t } from '../i18n';
import { instantiate, type Placement } from '../render/instancing';
import { seededRandom } from '../render/textures';

export interface FarmDecor {
  root: THREE.Group;
  applySeason(season: SeasonId): void;
  /** Repaints the bed signs (after the web fonts load). */
  repaintSigns(): void;
}

const FLOOR = LEVELS.main.top;
const FENCE_SPACING = 0.36;
const STRING_SAG = 0.32;
const BULB_SPACING = 0.42;

/** Beds, log fence, crop signs, seasonal crops, ground lanterns and the string lights over the paths. */
export function buildFarmDecor(assets: AssetRegistry): FarmDecor {
  const root = new THREE.Group();
  root.name = 'farm';
  const rnd = seededRandom(17);

  root.add(instantiate(assets.create('bed.frame'), BEDS.map(b => ({ x: (b.x0 + b.x1) / 2, y: FLOOR, z: (b.z0 + b.z1) / 2 }))));

  // Fence: one log every 36 cm with a little height and tilt variation; taller posts at the gates.
  const posts: Placement[] = [];
  for (const [[ax, az], [bx, bz]] of FENCE_LINES) {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / FENCE_SPACING));
    for (let k = 0; k <= n; k++) posts.push({ x: ax + ((bx - ax) * k) / n, y: FLOOR, z: az + ((bz - az) * k) / n, sy: 0.85 + rnd() * 0.25, ry: rnd() * 3 });
  }
  for (const [x, z] of FENCE_GATE_POSTS) posts.push({ x, y: FLOOR, z, s: 1.15, sy: 1.45 });
  root.add(instantiate(assets.create('fence.log'), posts));

  root.add(instantiate(assets.create('lantern.ground'), GROUND_LANTERNS.map(([x, z]) => ({ x, y: FLOOR, z }))));

  // String lights: poles, sagging wires and a bulb every 42 cm.
  root.add(instantiate(assets.create('light.pole'), LIGHT_POLES.map(([x, z]) => ({ x, y: FLOOR, z }))));
  const wire: THREE.Vector3[] = [];
  const bulbs: Placement[] = [];
  for (const [a, b] of LIGHT_STRINGS) {
    const [ax, az] = LIGHT_POLES[a]!, [bx, bz] = LIGHT_POLES[b]!;
    const n = Math.max(3, Math.round(Math.hypot(bx - ax, bz - az) / BULB_SPACING));
    let prev: THREE.Vector3 | null = null;
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const p = new THREE.Vector3(ax + (bx - ax) * f, FLOOR + LIGHT_POLE_HEIGHT - 0.05 - STRING_SAG * 4 * f * (1 - f), az + (bz - az) * f);
      if (prev) wire.push(prev, p);
      if (k > 0 && k < n) bulbs.push({ x: p.x, y: p.y - 0.07, z: p.z });
      prev = p;
    }
  }
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x3a2e26 })));
  root.add(instantiate(assets.create('light.bulb'), bulbs));

  // Crop signs.
  const signs = BEDS.map(b => {
    const sign = assets.create('sign.crop');
    sign.position.set(b.sign[0], FLOOR, b.sign[1]);
    root.add(sign);
    return sign;
  });

  // Crops, rebuilt when the season changes.
  let crops = new THREE.Group();
  root.add(crops);
  let current: SeasonId = 'spring';

  const paintSigns = () => {
    BEDS.forEach((b, i) => {
      const crop = BED_CROPS_BY_SEASON[current][b.id];
      const paint = signs[i]!.userData.paint as ((label: string, icon: string) => void) | undefined;
      paint?.(t(`crop.${crop}`).toLocaleUpperCase('pt-BR'), CROP_ICONS[crop]);
    });
  };

  return {
    root,
    applySeason(season) {
      current = season;
      root.remove(crops);
      crops = new THREE.Group();
      crops.name = 'crops';
      const cropRnd = seededRandom(55);
      for (const b of BEDS) {
        const w = b.x1 - b.x0, d = b.z1 - b.z0, spots: Placement[] = [];
        for (let i = 0; i < BED_COLUMNS; i++) {
          for (let j = 0; j < BED_ROWS; j++) {
            spots.push({ x: b.x0 + ((i + 0.5) * w) / BED_COLUMNS, y: FLOOR + 0.03, z: b.z0 + ((j + 0.5) * d) / BED_ROWS, s: 0.95 + cropRnd() * 0.15, ry: cropRnd() * Math.PI * 2 });
          }
        }
        crops.add(instantiate(assets.create(`crop.${BED_CROPS_BY_SEASON[season][b.id]}`), spots));
      }
      root.add(crops);
      paintSigns();
    },
    repaintSigns: paintSigns,
  };
}
