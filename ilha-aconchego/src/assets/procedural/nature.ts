import * as THREE from 'three';
import { FRUITS } from '../../data/defaults';
import { materials } from '../../render/materials';
import type { AssetRegistry } from '../registry';
import { ball, bake, cone, cyl, group, merge, meshOf, vcMesh } from './parts';

/**
 * Trees, bushes, grass and flowers. Leaves use the shared seasonal materials.
 * Mesh names drive seasonal visibility: "fruit", "only:winter", "only:warm" (spring and summer).
 */

const TRUNK = 0x8b5e3c;
const TRUNK_DARK = 0x7e5434;
const SNOW = 0xf4f8fb;

let crown: THREE.BufferGeometry | null = null;
/** Fluffy round crown: several overlapping spheres with leaf texture coordinates. */
function crownGeometry(): THREE.BufferGeometry {
  return (crown ??= merge(
    [
      [0, 2.6, 0, 1.2],
      [0.85, 2.2, 0.25, 0.85],
      [-0.8, 2.25, -0.15, 0.9],
      [0.15, 3.35, 0.05, 0.8],
      [-0.25, 2.05, 0.7, 0.75],
      [0.35, 2.4, -0.7, 0.8],
    ].map(([x, y, z, r]) => bake(new THREE.SphereGeometry(1, 13, 9), { x, y, z, sx: r, sy: r! * 0.92, sz: r })),
  ));
}

const trunk = () => vcMesh([cyl(0.2, 0.3, 2.0, 0, 1.0, 0, TRUNK, 10), cyl(0.3, 0.46, 0.3, 0, 0.15, 0, TRUNK_DARK, 10)], 'trunk');

/** Fruit spots on the front half of the crown, so they face the camera. */
const FRUIT_SPOTS = [
  [0.5, 0.1, 0.86],
  [-0.55, 0.25, 0.8],
  [0.1, -0.25, 0.97],
  [0.85, 0.35, 0.4],
  [-0.85, 0, 0.5],
  [0.25, 0.6, 0.76],
].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize().multiplyScalar(1.17).add(new THREE.Vector3(0, 2.6, 0)));

let fruitGeo: THREE.BufferGeometry | null = null;
function fruitGeometry(): THREE.BufferGeometry {
  return (fruitGeo ??= merge(FRUIT_SPOTS.map(p => bake(new THREE.SphereGeometry(0.17, 9, 7), { x: p.x, y: p.y, z: p.z }))));
}

let pineGeo: THREE.BufferGeometry | null = null;
/** Pine tiers with a jagged lower edge, like layered branches. */
function pineGeometry(): THREE.BufferGeometry {
  if (pineGeo) return pineGeo;
  const tiers: [number, number, number][] = [[1.5, 1.5, 1.5], [1.18, 1.35, 2.4], [0.86, 1.2, 3.2], [0.52, 1.0, 3.9]];
  pineGeo = merge(
    tiers.map(([r, h, y]) => {
      const g = new THREE.ConeGeometry(r, h, 14, 2, true);
      const p = g.attributes.position!;
      for (let i = 0; i < p.count; i++) {
        if (Math.abs(p.getY(i) + h / 2) > 1e-3) continue;
        let a = Math.atan2(p.getZ(i), p.getX(i));
        if (a < 0) a += Math.PI * 2;
        const odd = Math.round(a / ((Math.PI * 2) / 14)) % 2 === 1;
        const k = odd ? 0.78 : 1.06;
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
        if (!odd) p.setY(i, p.getY(i) - 0.14);
      }
      g.computeVertexNormals();
      return bake(g, { y });
    }),
  );
  return pineGeo;
}

let bushGeo: THREE.BufferGeometry | null = null;
function bushGeometry(): THREE.BufferGeometry {
  return (bushGeo ??= merge(
    [
      [0, 0.45, 0, 0.6],
      [0.45, 0.35, 0.15, 0.45],
      [-0.42, 0.38, -0.05, 0.48],
      [0.05, 0.4, 0.45, 0.4],
    ].map(([x, y, z, r]) => bake(new THREE.SphereGeometry(1, 14, 10), { x, y, z, sx: r, sy: r! * 0.85, sz: r })),
  ));
}

let tuftGeo: THREE.BufferGeometry | null = null;
/** One clump of tall grass: seven thin blades leaning outward. */
export function tuftGeometry(): THREE.BufferGeometry {
  if (tuftGeo) return tuftGeo;
  const blades: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.3, h = 0.6 + (k % 3) * 0.14;
    blades.push(bake(new THREE.ConeGeometry(0.09, h, 3), { x: Math.cos(a) * 0.08, y: h / 2, z: Math.sin(a) * 0.08, sz: 0.35, rx: Math.sin(a) * 0.38, ry: -a, rz: -Math.cos(a) * 0.38 }));
  }
  return (tuftGeo = merge(blades));
}

export function registerNature(registry: AssetRegistry): void {
  const m = () => materials();

  registry.register('tree.round', () => group('tree.round', trunk(), meshOf(crownGeometry(), m().leafRound, 'crown')));
  registry.register('tree.blossom', () => group('tree.blossom', trunk(), meshOf(crownGeometry(), m().leafBlossom, 'crown')));
  for (const fruit of FRUITS) {
    registry.register(`tree.${fruit}`, () =>
      group(`tree.${fruit}`, trunk(), meshOf(crownGeometry(), m().leafRound, 'crown'), meshOf(fruitGeometry(), m().fruit[fruit], 'fruit')),
    );
  }

  registry.register('tree.pine', () => {
    const parts = [cyl(0.2, 0.28, 1.1, 0, 0.55, 0, TRUNK, 10)];
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + 0.4;
      parts.push(ball(0.13, 0.1, 0.3, Math.cos(a) * 0.25, 0.06, Math.sin(a) * 0.25, TRUNK_DARK, 0, -a));
    }
    return group(
      'tree.pine',
      vcMesh(parts, 'trunk'),
      meshOf(pineGeometry(), m().leafPine, 'crown'),
      vcMesh([cone(0.5, 0.5, 0, 4.25, 0, SNOW, 14), cone(0.95, 0.25, 0, 3.05, 0, SNOW, 14), cone(1.25, 0.22, 0, 2.2, 0, SNOW, 14)], 'only:winter', false),
    );
  });

  // Leans toward +x; rotate the placement to lean another way.
  registry.register('tree.palm', () => {
    const parts: THREE.BufferGeometry[] = [];
    let x = 0, y = 0;
    for (let i = 0; i < 7; i++) {
      parts.push(cyl(0.16, 0.2, 0.55, x, y + 0.27, 0, i % 2 ? 0xb89a6e : 0xa88a5e, 10, 0, 0, -0.6 * 0.6));
      x += 0.17 * (i / 7 + 0.4);
      y += 0.5;
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      parts.push(ball(1.25, 0.07, 0.32, x + Math.cos(a) * 0.95, y + 0.05, Math.sin(a) * 0.95, k % 2 ? 0x4fa544 : 0x5db85a, 0, -a, -0.35));
    }
    parts.push(ball(0.16, 0.16, 0.16, x + 0.15, y - 0.15, 0.12, 0x7a5432), ball(0.16, 0.16, 0.16, x - 0.12, y - 0.18, 0.1, 0x6b4a2c), ball(0.15, 0.15, 0.15, x, y - 0.16, -0.15, 0x7a5432));
    return group('tree.palm', vcMesh(parts, 'palm'));
  });

  registry.register('bush.flower', () => {
    const dots: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 7; k++) {
      const a = k * 1.9, h = 0.3 + (k % 3) * 0.17;
      dots.push(ball(0.075, 0.075, 0.075, Math.cos(a) * 0.55, h + 0.1, Math.sin(a) * 0.5 + 0.1, 0xffffff));
    }
    return group('bush.flower', meshOf(bushGeometry(), m().leafBush, 'crown'), vcMesh(dots, 'only:warm', false));
  });

  // Tall grass clump; the world tints each copy (instance colors) by season.
  registry.register('grass.tuft', () => group('grass.tuft', meshOf(tuftGeometry(), m().tinted, 'tuft')));

  // One flower: tinted petals, yellow center and a stem.
  registry.register('flower', () => {
    const petals = new THREE.SphereGeometry(0.13, 5, 2);
    petals.scale(1, 0.45, 1);
    petals.translate(0, 0.36, 0);
    const center = new THREE.SphereGeometry(0.045, 6, 4).translate(0, 0.385, 0);
    const stem = new THREE.CylinderGeometry(0.018, 0.018, 0.34, 4).translate(0, 0.17, 0);
    return group('flower', meshOf(petals, m().tinted, 'petals', false), meshOf(center, m().flowerCenter, 'center', false), meshOf(stem, m().stem, 'stem', false));
  });

  registry.register('rock', () => group('rock', vcMesh([bake(new THREE.IcosahedronGeometry(1, 1), { sx: 1, sy: 0.6, sz: 0.9 }, 0xa9a49b)], 'rock')));
}
