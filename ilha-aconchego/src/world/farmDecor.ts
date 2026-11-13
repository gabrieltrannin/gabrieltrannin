import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { CROP_ICONS, type FarmCropId } from '../data/crops';
import { BEDS, FENCE_GATE_POSTS, FENCE_LINES, GROUND_LANTERNS, LEVELS, LIGHT_POLE_HEIGHT, LIGHT_POLES, LIGHT_STRINGS } from '../data/map';
import { t } from '../i18n';
import { instantiate, type Placement } from '../render/instancing';
import { seededRandom } from '../render/textures';

export interface FarmDecor {
  root: THREE.Group;
  /** Shows on each bed's sign the crop growing there (null = nothing planted). */
  setSignCrops(crops: Record<string, FarmCropId | null>): void;
  /** Repaints the bed signs (after the web fonts load). */
  repaintSigns(): void;
}

const FLOOR = LEVELS.main.top;
const FENCE_SPACING = 0.36;
const STRING_SAG = 0.32;
const BULB_SPACING = 0.42;

/** Beds, log fence, crop signs, ground lanterns and the string lights over the paths. Crops come from the game state (farmPlots). */
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

  let shown: Record<string, FarmCropId | null> = {};
  const paintSigns = () => {
    BEDS.forEach((b, i) => {
      const crop = shown[b.id] ?? null;
      const paint = signs[i]!.userData.paint as ((label: string, icon: string) => void) | undefined;
      paint?.((crop ? t(`crop.${crop}`) : t('sign.empty')).toLocaleUpperCase('pt-BR'), crop ? CROP_ICONS[crop] : '🌱');
    });
  };
  paintSigns();

  return {
    root,
    setSignCrops(crops) {
      if (BEDS.every(b => (crops[b.id] ?? null) === (shown[b.id] ?? null))) return;
      shown = { ...crops };
      paintSigns();
    },
    repaintSigns: paintSigns,
  };
}
