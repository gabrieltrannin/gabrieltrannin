import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { FRUITS } from '../../data/defaults';
import { materials } from '../../render/materials';
import { seededRandom } from '../../render/textures';
import type { AssetRegistry } from '../registry';
import { bake, ball, cyl, dot, group, merge, meshOf, shade, twoSided, vcMesh } from './parts';

/**
 * Trees, bushes, grass, flowers and rocks. Leaves use the shared seasonal materials (a flat tint)
 * and carry their light and shadow in the vertex colors.
 * Mesh names drive seasonal visibility: "fruit", "only:winter", "only:warm" (spring and summer).
 */

const TRUNK = 0x8b5e3c;
const TRUNK_DARK = 0x6e4a2e;
const SNOW = 0xf4f8fb;

/** Blobs of a round crown: [x, y, z, radius]. A big core, a lower ring, an upper ring and a top. */
const CROWN_BLOBS: readonly (readonly [number, number, number, number])[] = (() => {
  const blobs: [number, number, number, number][] = [[0, 2.65, 0, 1.12]];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    blobs.push([Math.cos(a) * 0.86, 2.28 + (k % 2) * 0.12, Math.sin(a) * 0.86, 0.66 + (k % 3) * 0.05]);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.9;
    blobs.push([Math.cos(a) * 0.55, 3.08, Math.sin(a) * 0.55, 0.6]);
  }
  blobs.push([0.05, 3.48, 0.02, 0.52]);
  return blobs;
})();
const CROWN_CENTER = new THREE.Vector3(0, 2.7, 0);

let crown: THREE.BufferGeometry | null = null;
/** Fluffy round crown: overlapping blobs with soft light baked in. */
function crownGeometry(): THREE.BufferGeometry {
  if (crown) return crown;
  const g = merge(CROWN_BLOBS.map(([x, y, z, r]) => bake(new THREE.SphereGeometry(1, 13, 9), { x, y, z, sx: r, sy: r * 0.9, sz: r })));
  return (crown = shade(g, { y0: 1.7, y1: 3.95, dark: 0.55, light: 1.14, center: CROWN_CENTER }));
}

let trunkGeo: THREE.BufferGeometry | null = null;
/** Tapered trunk with a flared base, little roots and two branch stubs going into the crown. */
function trunkGeometry(): THREE.BufferGeometry {
  if (trunkGeo) return trunkGeo;
  const parts = [cyl(0.19, 0.27, 1.9, 0, 0.95, 0, TRUNK, 12), cyl(0.27, 0.42, 0.28, 0, 0.14, 0, TRUNK, 12)];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.5;
    parts.push(dot(0.12, 0.09, 0.32, Math.cos(a) * 0.32, 0.05, Math.sin(a) * 0.32, TRUNK_DARK, 0, -a + Math.PI / 2));
  }
  parts.push(cyl(0.07, 0.11, 0.7, 0.32, 1.95, 0.05, TRUNK, 8, 0, 0, -0.7), cyl(0.07, 0.11, 0.7, -0.28, 2.0, -0.1, TRUNK, 8, 0, 0, 0.75));
  return (trunkGeo = shade(merge(parts), { y0: 0, y1: 1.6, dark: 0.7, light: 1.05 }));
}

/** Fruit sits on the outside of the blobs that face the camera (+z), so it always shows. */
const FRUIT_SPOTS: THREE.Vector3[] = [
  [1, 0.1, 0.1], [2, -0.1, 0.25], [3, 0.1, 0.05], [7, 0.05, 0.3], [8, -0.1, 0.2], [0, 0.4, 0.2], [0, -0.45, -0.1],
].map(([index, dx, dy]) => {
  const [x, y, z, r] = CROWN_BLOBS[index ?? 0]!;
  const c = new THREE.Vector3(x, y, z);
  const dir = c.clone().sub(CROWN_CENTER).setY(0).normalize().add(new THREE.Vector3(dx ?? 0, dy ?? 0, 0.45)).normalize();
  return c.add(dir.multiplyScalar(r * 0.93));
});

let fruitGeo: THREE.BufferGeometry | null = null;
function fruitGeometry(): THREE.BufferGeometry {
  if (fruitGeo) return fruitGeo;
  const parts: THREE.BufferGeometry[] = [];
  for (const p of FRUIT_SPOTS) parts.push(bake(new THREE.SphereGeometry(0.17, 12, 9), { x: p.x, y: p.y, z: p.z, sy: 0.95 }));
  return (fruitGeo = merge(parts));
}

/**
 * One pine tier: a convex cone whose rim has soft drooping lobes and tucks underneath.
 * Without the tuck and with `sMin`/`sMax`, it gives the band of snow that sits on a tier.
 */
function pineTier(radius: number, height: number, baseY: number, lobes: number, phase: number, sMax = 1, tuck = true, sMin = 0): THREE.BufferGeometry {
  const segs = 32;
  const rows: { r: number; y: number; s: number }[] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const s = sMin + (i / steps) * (sMax - sMin);
    rows.push({ r: radius * Math.pow(s, 0.85), y: height * (1 - s) - 0.12 * s * s, s });
  }
  if (tuck) {
    rows.push({ r: radius * 0.96, y: -0.2, s: 1 }, { r: radius * 0.72, y: -0.26, s: 1 }, { r: radius * 0.3, y: -0.2, s: 0.4 });
  }
  const positions: number[] = [], uvs: number[] = [];
  rows.forEach((row, i) => {
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const wave = Math.cos(a * lobes + phase);
      const k = 1 + 0.13 * wave * row.s;
      const droop = 0.12 * row.s * row.s * (wave * 0.5 + 0.5);
      positions.push(Math.cos(a) * row.r * k, baseY + row.y - droop, Math.sin(a) * row.r * k);
      uvs.push((j / segs) * 4, i / rows.length);
    }
  });
  const index: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j, b = a + segs + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  // Smooth the seam where the ring closes.
  const n = g.attributes.normal!;
  for (let i = 0; i < rows.length; i++) {
    const a = i * (segs + 1), b = a + segs;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l);
    n.setXYZ(b, x / l, y / l, z / l);
  }
  return bake(g, {});
}

const PINE_TIERS: readonly [number, number, number][] = [[1.55, 1.45, 1.15], [1.25, 1.3, 2.0], [0.95, 1.15, 2.78], [0.62, 1.0, 3.48]];

let pineGeo: THREE.BufferGeometry | null = null;
function pineGeometry(): THREE.BufferGeometry {
  if (pineGeo) return pineGeo;
  // Each tier gets its own light: bright near its tip, dark at its rim, so the layers read from above.
  const tiers = PINE_TIERS.map(([r, h, y], i) => shade(pineTier(r, h, y, 6 + i, i * 1.3), { y0: y - 0.3, y1: y + h, dark: 0.55, light: 1.4 }));
  return (pineGeo = shade(merge(tiers), { y0: 1.0, y1: 4.5, dark: 0.85, light: 1.08 }));
}

let pineSnowGeo: THREE.BufferGeometry | null = null;
function pineSnowGeometry(): THREE.BufferGeometry {
  if (pineSnowGeo) return pineSnowGeo;
  // Snow on the part of each tier that shows: the whole tip of the top tier, the outer band of the others.
  const caps = PINE_TIERS.map(([r, h, y], i) => pineTier(r * 1.03, h, y + 0.05, 6 + i, i * 1.3, i === 3 ? 0.75 : 0.88, false, i === 3 ? 0 : 0.45));
  const g = merge(caps);
  const c = g.attributes.color!;
  const white = new THREE.Color(SNOW);
  for (let i = 0; i < c.count; i++) c.setXYZ(i, white.r, white.g, white.b);
  return (pineSnowGeo = shade(g, { y0: 1.0, y1: 4.5, dark: 0.88, light: 1.02 }));
}

let bushGeo: THREE.BufferGeometry | null = null;
function bushGeometry(): THREE.BufferGeometry {
  if (bushGeo) return bushGeo;
  const blobs = [
    [0, 0.48, 0, 0.58], [0.45, 0.36, 0.12, 0.43], [-0.44, 0.38, -0.04, 0.46], [0.06, 0.38, 0.44, 0.4],
    [-0.12, 0.36, -0.42, 0.4], [0.18, 0.78, 0.05, 0.36], [-0.3, 0.32, 0.36, 0.32],
  ];
  const g = merge(blobs.map(([x, y, z, r]) => bake(new THREE.SphereGeometry(1, 12, 8), { x, y, z, sx: r, sy: r! * 0.86, sz: r })));
  return (bushGeo = shade(g, { y0: 0, y1: 1.05, dark: 0.55, light: 1.14, center: new THREE.Vector3(0, 0.45, 0) }));
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

/**
 * One palm frond pointing along +x: it rises, then arches down; the edges fold down in a V and are
 * cut into leaflets. Dark along the middle rib, lighter at the edges.
 */
function frond(length: number, width: number): THREE.BufferGeometry {
  const n = 18;
  const positions: number[] = [], colors: number[] = [];
  const rib = new THREE.Color(0x3d8a3a), edge = new THREE.Color(0x74c55e), tip = new THREE.Color(0x8fd36d);
  const point = (t: number, side: -1 | 0 | 1) => {
    const x = length * t;
    const y = length * (0.42 * t - 0.78 * t * t);
    const cut = Math.floor(t * n) % 2 === 0 ? 1 : 0.62;
    const w = side === 0 ? 0 : width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.7) * cut;
    return [x, y - Math.abs(side) * w * 0.38, side * w];
  };
  const color = (t: number, side: number) => {
    const c = (side === 0 ? rib : edge).clone().lerp(tip, t * 0.5);
    return [c.r, c.g, c.b];
  };
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    for (const side of [-1, 1] as const) {
      const quad = [point(t0, 0), point(t0, side), point(t1, side), point(t1, 0)];
      const cols = [color(t0, 0), color(t0, side), color(t1, side), color(t1, 0)];
      const order = side === 1 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const k of order) {
        positions.push(...quad[k]!);
        colors.push(...cols[k]!);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  g.computeVertexNormals();
  return twoSided(g);
}

/** Lumpy pebble shape: an icosphere pushed in and out a little, with smooth normals. */
function rockGeometry(seed: number, sx: number, sy: number, sz: number, color: number, x = 0, z = 0): THREE.BufferGeometry {
  const rnd = seededRandom(seed);
  const bumps = Array.from({ length: 5 }, () => new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize());
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 2).deleteAttribute('normal').deleteAttribute('uv'));
  const p = g.attributes.position!;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let k = 1;
    for (const b of bumps) k += 0.09 * Math.max(0, v.dot(b)) ** 3;
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return bake(g, { x, y: sy * 0.18, z, sx, sy, sz }, color);
}

export function registerNature(registry: AssetRegistry): void {
  const m = () => materials();
  const trunk = () => meshOf(trunkGeometry(), m().vc, 'trunk');

  registry.register('tree.round', () => group('tree.round', trunk(), meshOf(crownGeometry(), m().leafRound, 'crown')));
  registry.register('tree.blossom', () => group('tree.blossom', trunk(), meshOf(crownGeometry(), m().leafBlossom, 'crown')));
  for (const fruit of FRUITS) {
    registry.register(`tree.${fruit}`, () =>
      group(`tree.${fruit}`, trunk(), meshOf(crownGeometry(), m().leafRound, 'crown'), meshOf(fruitGeometry(), m().fruit[fruit], 'fruit')),
    );
  }

  registry.register('tree.pine', () => {
    const parts = [cyl(0.17, 0.26, 1.3, 0, 0.65, 0, TRUNK, 10)];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.4;
      parts.push(dot(0.12, 0.09, 0.32, Math.cos(a) * 0.27, 0.05, Math.sin(a) * 0.27, TRUNK_DARK, 0, -a + Math.PI / 2));
    }
    return group(
      'tree.pine',
      vcMesh(parts, 'trunk'),
      meshOf(pineGeometry(), m().leafPine, 'crown'),
      meshOf(pineSnowGeometry(), m().vc, 'only:winter', false),
    );
  });

  // Leans toward +x; rotate the placement to lean another way.
  registry.register('tree.palm', () => {
    const parts: THREE.BufferGeometry[] = [];
    let x = 0, y = 0;
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const lean = 0.08 + i * 0.045;
      const r = 0.2 - i * 0.008;
      parts.push(cyl(r * 0.88, r, 0.5, x, y + 0.25, 0, i % 2 ? 0xb3936a : 0x9f7f57, 10, 0, 0, -lean));
      parts.push(cyl(r * 1.06, r * 1.06, 0.07, x + Math.sin(lean) * 0.22, y + 0.46, 0, 0x8a6c48, 10, 0, 0, -lean));
      x += Math.sin(lean) * 0.5;
      y += Math.cos(lean) * 0.5;
    }
    parts.push(ball(0.24, 0.2, 0.24, x, y + 0.02, 0, 0x6f8f3a));
    for (const [dx, dy, dz] of [[0.14, -0.14, 0.1], [-0.1, -0.17, 0.12], [0.02, -0.16, -0.15]]) parts.push(dot(0.15, 0.15, 0.15, x + dx!, y + dy!, dz!, 0x7a5432));
    const fronds = 9;
    for (let k = 0; k < fronds; k++) {
      const a = (k / fronds) * Math.PI * 2 + 0.2;
      const len = 1.75 + (k % 3) * 0.2;
      const g = frond(len, 0.34);
      g.rotateZ(0.12 + (k % 2) * 0.12);
      g.rotateY(-a);
      g.translate(x, y + 0.05, 0);
      parts.push(g);
    }
    return group('tree.palm', vcMesh(parts, 'palm'));
  });

  registry.register('bush.flower', () => {
    const dots: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 9; k++) {
      const a = k * 1.9, h = 0.32 + (k % 3) * 0.2;
      const r = 0.58 - (k % 3) * 0.12;
      dots.push(dot(0.075, 0.06, 0.075, Math.cos(a) * r, h + 0.1, Math.sin(a) * r * 0.9 + 0.08, 0xffffff), dot(0.03, 0.03, 0.03, Math.cos(a) * r, h + 0.15, Math.sin(a) * r * 0.9 + 0.08, 0xffd166));
    }
    return group('bush.flower', meshOf(bushGeometry(), m().leafBush, 'crown'), vcMesh(dots, 'only:warm', false));
  });

  // Tall grass clump; the world tints each copy (instance colors) by season.
  registry.register('grass.tuft', () => group('grass.tuft', meshOf(tuftGeometry(), m().tinted, 'tuft')));

  // One flower: a five-petal rosette (tinted per copy, cupped a little), a yellow center and a stem.
  registry.register('flower', () => {
    const ring = 30, positions = [0, 0.37, 0];
    for (let i = 0; i <= ring; i++) {
      const a = (i / ring) * Math.PI * 2;
      const r = 0.13 * (0.62 + 0.38 * Math.abs(Math.cos((a * 5) / 2)));
      positions.push(Math.cos(a) * r, 0.37 + r * 0.35, Math.sin(a) * r);
    }
    const index: number[] = [];
    for (let i = 1; i <= ring; i++) index.push(0, i + 1, i);
    const petals = new THREE.BufferGeometry();
    petals.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    petals.setIndex(index);
    petals.computeVertexNormals();
    const center = new THREE.SphereGeometry(0.045, 6, 4).scale(1, 0.7, 1).translate(0, 0.395, 0);
    const stem = new THREE.CylinderGeometry(0.016, 0.02, 0.36, 4).translate(0, 0.18, 0);
    return group('flower', meshOf(petals, m().tinted, 'petals', false), meshOf(center, m().flowerCenter, 'center', false), meshOf(stem, m().stem, 'stem', false));
  });

  registry.register('rock', () => {
    const big = shade(rockGeometry(7, 1, 0.62, 0.88, 0xaaa59b), { y0: -0.1, y1: 0.75, dark: 0.72, light: 1.12 });
    const pebble = shade(rockGeometry(13, 0.3, 0.2, 0.26, 0xb9b3a7, 0.95, 0.55), { y0: 0, y1: 0.3, dark: 0.75, light: 1.1 });
    const moss = shade(rockGeometry(21, 0.55, 0.12, 0.45, 0x8fbf63, -0.15, -0.05).translate(0, 0.42, 0), { y0: 0.4, y1: 0.6, dark: 0.85, light: 1.1 });
    return group('rock', vcMesh([big, pebble], 'rock'), vcMesh([moss], 'only:warm', false));
  });
}
