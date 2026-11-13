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

/** Cylinder of height h centered at (x, y, z); rt/rb are top and bottom radii. */
export const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, seg = 12, rx = 0, ry = 0, rz = 0) =>
  bake(cached(`cyl${rt}|${rb}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg)), { x, y, z, sy: h, rx, ry, rz }, color);

export const cone = (r: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, seg = 10, rx = 0, ry = 0, rz = 0) =>
  bake(cached(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg)), { x, y, z, sx: r, sy: h, sz: r, rx, ry, rz }, color);

export const torus = (radius: number, tube: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rx = 0, ry = 0, rz = 0) =>
  bake(cached(`torus${radius}|${tube}`, () => new THREE.TorusGeometry(radius, tube, 8, 22)), { x, y, z, rx, ry, rz }, color);

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
