import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { materials } from '../../render/materials';

/**
 * Small toolkit to build placeholder props out of simple shapes. Each helper returns a geometry
 * already moved into place and painted with a vertex color; `vcMesh` merges them into one mesh
 * that draws in a single call with the shared vertex-color material.
 */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const KEEP = new Set(['position', 'normal', 'uv', 'color']);

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitSphere = new THREE.SphereGeometry(1, 14, 10);
const geoCache = new Map<string, THREE.BufferGeometry>();
const cached = (key: string, make: () => THREE.BufferGeometry) => {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
};

export interface Xf {
  x?: number;
  y?: number;
  z?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  rx?: number;
  ry?: number;
  rz?: number;
}

/** Copies a geometry, applies the transform and paints it one flat color. */
export function bake(geometry: THREE.BufferGeometry, t: Xf, color: THREE.ColorRepresentation = 0xffffff): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const sx = t.sx ?? 1;
  g.applyMatrix4(_m.compose(_p.set(t.x ?? 0, t.y ?? 0, t.z ?? 0), _q.setFromEuler(_e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0)), _s.set(sx, t.sy ?? sx, t.sz ?? sx)));
  const count = g.attributes.position!.count;
  _c.set(color);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([_c.r, _c.g, _c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  for (const name of Object.keys(g.attributes)) if (!KEEP.has(name)) g.deleteAttribute(name);
  g.clearGroups();
  return g;
}

export const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rx = 0, ry = 0, rz = 0) =>
  bake(unitBox, { x, y, z, sx, sy, sz, rx, ry, rz }, color);

export const ball = (sx: number, sy: number, sz: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rx = 0, ry = 0, rz = 0) =>
  bake(unitSphere, { x, y, z, sx, sy, sz, rx, ry, rz }, color);

const smallSphere = new THREE.SphereGeometry(1, 8, 6);
/** Like `ball`, with fewer faces: for small details (roots, flower dots, buttons). */
export const dot = (sx: number, sy: number, sz: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rx = 0, ry = 0, rz = 0) =>
  bake(smallSphere, { x, y, z, sx, sy, sz, rx, ry, rz }, color);

/** Cylinder of height h centered at (x, y, z); rt/rb are top and bottom radii. */
export const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, seg = 12, rx = 0, ry = 0, rz = 0) =>
  bake(cached(`cyl${rt}|${rb}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg)), { x, y, z, sy: h, rx, ry, rz }, color);

export const cone = (r: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, seg = 10, rx = 0, ry = 0, rz = 0) =>
  bake(cached(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg)), { x, y, z, sx: r, sy: h, sz: r, rx, ry, rz }, color);

export const torus = (radius: number, tube: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rx = 0, ry = 0, rz = 0) =>
  bake(cached(`torus${radius}|${tube}`, () => new THREE.TorusGeometry(radius, tube, 8, 22)), { x, y, z, rx, ry, rz }, color);

export interface ShadeOptions {
  /** Heights where the shading is darkest (y0) and lightest (y1). */
  y0: number;
  y1: number;
  /** Multipliers at the bottom and the top. */
  dark?: number;
  light?: number;
  /** Faces turned toward this point (inside a crown) get darker. */
  center?: THREE.Vector3;
}

const _n = new THREE.Vector3();
const _d = new THREE.Vector3();
/**
 * Bakes soft light into the vertex colors (multiplying the colors already there): darker low down,
 * underneath and on faces turned inward; lighter near the top. Leaves keep a flat seasonal tint in
 * the material and get their volume from this.
 */
export function shade(g: THREE.BufferGeometry, o: ShadeOptions): THREE.BufferGeometry {
  const pos = g.attributes.position!, nor = g.attributes.normal!;
  if (!g.attributes.color) {
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3));
  }
  const col = g.attributes.color!;
  const dark = o.dark ?? 0.6, light = o.light ?? 1.1;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - o.y0) / (o.y1 - o.y0), 0, 1);
    _n.fromBufferAttribute(nor, i);
    let k = dark + (light - dark) * t * t * (3 - 2 * t);
    k *= 0.86 + 0.2 * Math.max(0, _n.y) + 0.14 * Math.min(0, _n.y);
    if (o.center) {
      _d.fromBufferAttribute(pos, i).sub(o.center).normalize();
      k *= 0.72 + 0.28 * THREE.MathUtils.clamp(_n.dot(_d) * 0.5 + 0.5, 0, 1);
    }
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  col.needsUpdate = true;
  return g;
}

/** Adds the back faces (flipped copies) so thin shapes like palm fronds show from both sides. */
export function twoSided(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const back = g.index ? g.toNonIndexed() : g.clone();
  const front = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(back.attributes)) {
    const a = back.attributes[name]!;
    for (let i = 0; i < a.count; i += 3) {
      for (let c = 0; c < a.itemSize; c++) {
        const v1 = a.getComponent(i + 1, c);
        a.setComponent(i + 1, c, a.getComponent(i + 2, c));
        a.setComponent(i + 2, c, v1);
      }
    }
  }
  const n = back.attributes.normal!;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return merge([front, back]);
}

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('Could not merge geometries (attribute mismatch)');
  g.computeBoundingSphere();
  return g;
}

export function meshOf(geometry: THREE.BufferGeometry, material: THREE.Material, name = '', castShadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.castShadow = castShadow;
  m.receiveShadow = true;
  return m;
}

/** Merges vertex-colored parts into one mesh drawn with the shared vertex-color material. */
export function vcMesh(parts: THREE.BufferGeometry[], name = '', castShadow = true): THREE.Mesh {
  return meshOf(merge(parts), materials().vc, name, castShadow);
}

export function group(name: string, ...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  if (children.length) g.add(...children);
  return g;
}

/** Sphere squashed into a pumpkin with ribs. */
export const pumpkinGeometry = (() => {
  let g: THREE.BufferGeometry | null = null;
  return () => {
    if (g) return g;
    g = new THREE.SphereGeometry(1, 20, 12);
    const p = g.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), k = 1 - 0.08 * Math.abs(Math.sin(Math.atan2(z, x) * 5));
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
    g.computeVertexNormals();
    return g;
  };
})();
