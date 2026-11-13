import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Appearance } from '../data/appearance';

/**
 * Builds the player's character from an Appearance: a big head (about two heads tall), a face painted
 * on a canvas texture (redrawn for every change), modular hair, ears, clothes and accessories.
 * Later, glTF parts made in Blender can replace these shapes piece by piece.
 */

export interface AvatarParts {
  body: THREE.Group;
  head: THREE.Group;
  arms: [THREE.Group, THREE.Group];
  legs: [THREE.Group, THREE.Group];
  /** Right hand, where held items attach. */
  hand: THREE.Group;
  faceTexture: THREE.CanvasTexture;
}

const TAU = Math.PI * 2;
const materialCache = new Map<string, THREE.MeshLambertMaterial>();
const mat = (color: string, doubleSide = false) => {
  const key = color + (doubleSide ? '2' : '');
  let m = materialCache.get(key);
  if (!m) materialCache.set(key, (m = new THREE.MeshLambertMaterial({ color, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide })));
  return m;
};
const geoCache = new Map<string, THREE.BufferGeometry>();
const geo = (key: string, make: () => THREE.BufferGeometry) => {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
};
const SPHERE = () => geo('sphere', () => new THREE.SphereGeometry(1, 22, 16));
const SPHERE_LOW = () => geo('sphereLow', () => new THREE.SphereGeometry(1, 12, 8));
const CYLINDER = () => geo('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 14));
const CONE = () => geo('cone', () => new THREE.ConeGeometry(1, 1, 12));
const BOX = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));
/** Front part of a sphere (120° wide) that carries the painted face. */
const FACE = () => geo('face', () => new THREE.SphereGeometry(1, 28, 18, Math.PI / 6, (Math.PI * 2) / 3, Math.PI * 0.28, Math.PI * 0.5));

function part(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, pos: [number, number, number], scale: [number, number, number], rot: [number, number, number] = [0, 0, 0]): THREE.Mesh {
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(...pos);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rot);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
const s3 = (v: number): [number, number, number] => [v, v, v];

const vcMaterials = new Map<THREE.Side, THREE.MeshLambertMaterial>();
const vcMaterial = (side: THREE.Side) => {
  let m = vcMaterials.get(side);
  if (!m) vcMaterials.set(side, (m = new THREE.MeshLambertMaterial({ vertexColors: true, side })));
  return m;
};
const KEEP_ATTRIBUTES = new Set(['position', 'normal', 'uv', 'color']);

/**
 * Merges the plain-colored shapes directly under `parent` into one mesh per material side, with the
 * colors in the vertices: a whole leg, arm, body or head costs one draw call instead of several.
 * Parts that move on their own (leg, arm and head pivots) stay separate groups.
 */
function mergeParts(parent: THREE.Object3D): void {
  const bySide = new Map<THREE.Side, THREE.BufferGeometry[]>();
  for (const child of [...parent.children]) {
    if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshLambertMaterial)) continue;
    const m = child.material;
    if (m.map || m.transparent || m.vertexColors) continue;
    child.updateMatrix();
    const g = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    g.applyMatrix4(child.matrix);
    const count = g.attributes.position!.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set([m.color.r, m.color.g, m.color.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    for (const name of Object.keys(g.attributes)) if (!KEEP_ATTRIBUTES.has(name)) g.deleteAttribute(name);
    g.clearGroups();
    const list = bySide.get(m.side) ?? [];
    list.push(g);
    bySide.set(m.side, list);
    parent.remove(child);
  }
  for (const [side, list] of bySide) {
    const merged = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, vcMaterial(side));
    mesh.castShadow = true;
    mesh.userData.ownGeometry = true;
    parent.add(mesh);
  }
}

/** Paints eyes, mouth and blush on a 256x256 canvas mapped onto the front of the head. */
export function paintFace(ctx: CanvasRenderingContext2D, a: Appearance): void {
  ctx.clearRect(0, 0, 256, 256);
  const ink = '#2A1E1E';
  if (a.blush) {
    ctx.fillStyle = 'rgba(244,128,150,.55)';
    for (const cx of [72, 184]) {
      ctx.beginPath();
      ctx.ellipse(cx, 146, 17, 11, 0, 0, TAU);
      ctx.fill();
    }
  }
  const ey = 112;
  ctx.lineCap = 'round';
  for (const cx of [100, 156]) {
    const out = cx < 128 ? -1 : 1;
    const oval = (rx: number, ry: number, color: string, dy = 0) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, ey + dy, rx, ry, 0, 0, TAU);
      ctx.fill();
    };
    if (a.eyes === 'dot') oval(6, 9, ink);
    else if (a.eyes === 'round') {
      oval(11, 15, ink);
      oval(7, 9, a.eyeColor, 4);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx + 3, ey - 6, 3.5, 0, TAU);
      ctx.fill();
    } else if (a.eyes === 'sparkle') {
      oval(13, 18, ink);
      oval(10, 13, a.eyeColor, 3);
      oval(5, 7, ink, 4);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx + 4, ey - 6, 4.5, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - 4, ey + 8, 2.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + out * 10, ey - 13);
      ctx.lineTo(cx + out * 16, ey - 19);
      ctx.stroke();
    } else {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (a.eyes === 'sleepy') ctx.arc(cx, ey - 4, 10, 0.15 * Math.PI, 0.85 * Math.PI);
      else ctx.arc(cx, ey + 6, 10, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (a.mouth === 'smile') {
    ctx.arc(128, 148, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (a.mouth === 'laugh') {
    ctx.fillStyle = '#8E2B3A';
    ctx.moveTo(117, 148);
    ctx.quadraticCurveTo(128, 172, 139, 148);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#F28CA0';
    ctx.beginPath();
    ctx.ellipse(128, 159, 5, 3.5, 0, 0, TAU);
    ctx.fill();
  } else if (a.mouth === 'cat') {
    ctx.arc(121, 148, 7, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(135, 148, 7, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else {
    ctx.moveTo(121, 153);
    ctx.lineTo(135, 153);
    ctx.stroke();
  }
}

function addHair(a: Appearance, head: THREE.Group): void {
  const hair = mat(a.hairColor);
  part(geo('cap', () => new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI * 0.45)), hair, head, [0, 0, 0], [0.505, 0.49, 0.5], [-0.25, 0, 0]);
  const fringe = () => part(SPHERE(), hair, head, [0, 0.27, 0.33], [0.34, 0.12, 0.17], [0.65, 0, 0]);
  const sides = () => {
    for (const s of [-1, 1]) part(SPHERE(), hair, head, [s * 0.4, 0.02, 0.14], [0.1, 0.2, 0.13]);
  };
  switch (a.hairStyle) {
    case 'short':
      fringe();
      sides();
      break;
    case 'bun':
      fringe();
      sides();
      part(SPHERE(), hair, head, [0, 0.5, -0.1], [0.21, 0.2, 0.21]);
      part(geo('band', () => new THREE.TorusGeometry(0.13, 0.035, 8, 16)), mat('#F2C14E'), head, [0, 0.38, -0.08], s3(1), [1.35, 0, 0]);
      break;
    case 'ponytail':
      fringe();
      sides();
      part(SPHERE(), hair, head, [0, -0.12, -0.5], [0.15, 0.34, 0.15], [-0.35, 0, 0]);
      part(SPHERE_LOW(), mat('#E5484D'), head, [0, 0.14, -0.47], s3(0.07));
      break;
    case 'long':
      fringe();
      sides();
      part(geo('longBack', () => new THREE.CylinderGeometry(0.47, 0.52, 0.8, 20, 1, true, Math.PI * 0.5, Math.PI)), mat(a.hairColor, true), head, [0, -0.3, -0.02], s3(1));
      break;
    case 'bob':
      fringe();
      part(geo('bob', () => new THREE.SphereGeometry(1, 24, 10, (Math.PI * 5) / 6, (Math.PI * 4) / 3, Math.PI * 0.3, Math.PI * 0.42)), mat(a.hairColor, true), head, [0, 0, 0], [0.53, 0.5, 0.52]);
      break;
    case 'spiky':
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * TAU;
        part(CONE(), hair, head, [Math.cos(angle) * 0.22, 0.42, Math.sin(angle) * 0.22 - 0.05], [0.12, 0.32, 0.12], [Math.sin(angle) * 0.6, 0, -Math.cos(angle) * 0.6]);
      }
      fringe();
      break;
  }
}

function addEars(a: Appearance, head: THREE.Group, body: THREE.Group): void {
  const skin = mat(a.skin), hair = mat(a.hairColor), pink = mat('#F7B6C8');
  if (a.species === 'human') for (const s of [-1, 1]) part(SPHERE_LOW(), skin, head, [s * 0.47, 0, 0], [0.07, 0.1, 0.06]);
  if (a.species === 'elf') for (const s of [-1, 1]) part(CONE(), skin, head, [s * 0.5, 0.04, -0.02], [0.07, 0.3, 0.07], [0, 0, -s * 1.25]);
  if (a.species === 'cat') {
    for (const s of [-1, 1]) {
      part(CONE(), hair, head, [s * 0.27, 0.43, -0.02], [0.14, 0.3, 0.12], [0, 0, -s * 0.35]);
      part(CONE(), pink, head, [s * 0.265, 0.42, 0.035], [0.08, 0.18, 0.04], [0, 0, -s * 0.35]);
    }
    const tail = geo('tail', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.5, -0.2), new THREE.Vector3(0, 0.42, -0.45), new THREE.Vector3(0.05, 0.7, -0.62), new THREE.Vector3(0.1, 0.98, -0.55)]), 16, 0.05, 6, false));
    part(tail, hair, body, [0, 0, 0], s3(1));
  }
  if (a.species === 'bunny') {
    for (const s of [-1, 1]) {
      part(SPHERE(), hair, head, [s * 0.16, 0.64, -0.04], [0.09, 0.3, 0.06], [0, 0, -s * 0.18]);
      part(SPHERE(), pink, head, [s * 0.16, 0.63, 0.01], [0.05, 0.22, 0.03], [0, 0, -s * 0.18]);
    }
    part(SPHERE_LOW(), mat('#FFFFFF'), body, [0, 0.5, -0.26], s3(0.1));
  }
}

function addAccessory(a: Appearance, head: THREE.Group): void {
  const red = mat('#E5484D'), straw = mat('#E6C77A');
  switch (a.accessory) {
    case 'strawHat':
      part(geo('brim', () => new THREE.CylinderGeometry(0.66, 0.66, 0.04, 28)), straw, head, [0, 0.36, -0.02], s3(1), [-0.15, 0, 0]);
      part(geo('crown', () => new THREE.CylinderGeometry(0.3, 0.34, 0.26, 24)), straw, head, [0, 0.5, -0.05], s3(1), [-0.15, 0, 0]);
      part(geo('hatBand', () => new THREE.CylinderGeometry(0.345, 0.345, 0.07, 24, 1, true)), red, head, [0, 0.41, -0.03], s3(1), [-0.15, 0, 0]);
      break;
    case 'beanie':
      part(geo('beanie', () => new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI * 0.5)), mat('#E8708F'), head, [0, 0.06, -0.02], [0.53, 0.52, 0.53], [-0.2, 0, 0]);
      part(geo('beanieBand', () => new THREE.TorusGeometry(0.5, 0.06, 8, 28)), mat('#F4F1EA'), head, [0, 0.1, -0.01], s3(1), [Math.PI / 2 - 0.2, 0, 0]);
      part(SPHERE_LOW(), mat('#F4F1EA'), head, [0, 0.6, -0.12], s3(0.11));
      break;
    case 'bow':
      part(SPHERE(), red, head, [0.17, 0.43, 0.15], [0.12, 0.08, 0.05], [0, 0, 0.5]);
      part(SPHERE(), red, head, [0.36, 0.33, 0.15], [0.12, 0.08, 0.05], [0, 0, 0.5]);
      part(SPHERE_LOW(), mat('#C0392B'), head, [0.265, 0.38, 0.17], s3(0.05));
      break;
    case 'flowerCrown': {
      part(geo('wreath', () => new THREE.TorusGeometry(0.44, 0.03, 6, 28)), mat('#5E9C42'), head, [0, 0.3, -0.04], s3(1), [Math.PI / 2 - 0.25, 0, 0]);
      const petal = geo('petal', () => new THREE.SphereGeometry(1, 5, 2));
      ['#F7B6C8', '#FFE680', '#FFFFFF', '#B892FF', '#F7B6C8', '#FFE680', '#FFFFFF'].forEach((c, i) => {
        const angle = Math.PI * (0.08 + i * 0.14);
        part(petal, mat(c), head, [Math.cos(angle) * 0.44, 0.32 + Math.sin(angle) * 0.1, Math.sin(angle) * 0.42 - 0.04], [0.09, 0.04, 0.09], [0.3, 0, 0]);
      });
      break;
    }
    case 'sprout':
      part(CYLINDER(), mat('#5C9E4A'), head, [0, 0.58, 0], [0.02, 0.2, 0.02]);
      for (const s of [-1, 1]) part(SPHERE_LOW(), mat('#7CCB5E'), head, [s * 0.1, 0.7, 0], [0.13, 0.04, 0.07], [0, 0, s * 0.45]);
      break;
    case 'none':
      break;
  }
}

/** Builds a new character. Call `disposeAvatar` when replacing it. */
export function buildAvatar(a: Appearance): THREE.Group {
  const root = new THREE.Group();
  root.name = 'avatar';
  const body = new THREE.Group();
  root.add(body);
  const skin = mat(a.skin), top = mat(a.topColor), bottom = mat(a.bottomColor), shoe = mat(a.shoes);

  const legs = [-1, 1].map(s => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.11, 0.42, 0);
    body.add(pivot);
    part(CYLINDER(), a.outfit === 'dress' ? skin : bottom, pivot, [0, -0.17, 0], [0.075, 0.34, 0.075]);
    part(SPHERE(), shoe, pivot, [0, -0.36, 0.04], [0.12, 0.085, 0.17]);
    return pivot;
  }) as [THREE.Group, THREE.Group];

  if (a.outfit !== 'dress') part(geo('hip', () => new THREE.CylinderGeometry(0.22, 0.24, 0.16, 16)), bottom, body, [0, 0.47, 0], s3(1));
  part(geo('torso', () => new THREE.CylinderGeometry(0.2, 0.24, 0.42, 16)), top, body, [0, 0.72, 0], s3(1));
  if (a.outfit === 'dress') {
    part(geo('skirt', () => new THREE.CylinderGeometry(0.22, 0.42, 0.5, 18)), top, body, [0, 0.6, 0], s3(1));
    part(geo('hem', () => new THREE.TorusGeometry(0.42, 0.03, 6, 24)), mat('#FFFFFF'), body, [0, 0.36, 0], s3(1), [Math.PI / 2, 0, 0]);
  }
  if (a.outfit === 'overalls') {
    part(BOX(), bottom, body, [0, 0.76, 0.2], [0.26, 0.22, 0.06]);
    for (const s of [-1, 1]) {
      part(BOX(), bottom, body, [s * 0.12, 0.92, 0], [0.05, 0.035, 0.45]);
      part(SPHERE_LOW(), mat('#F2C14E'), body, [s * 0.09, 0.84, 0.235], [0.025, 0.025, 0.02]);
    }
  }
  if (a.outfit === 'hoodie') {
    part(geo('hood', () => new THREE.TorusGeometry(0.19, 0.075, 8, 18)), top, body, [0, 0.98, -0.11], s3(1), [1.25, 0, 0]);
    part(BOX(), mat('#FFFFFF'), body, [0, 0.62, 0.225], [0.2, 0.1, 0.02]);
  }
  part(CYLINDER(), skin, body, [0, 0.96, 0], [0.09, 0.1, 0.09]);

  const arms = [-1, 1].map(s => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.25, 0.88, 0);
    pivot.rotation.z = s * 0.16;
    body.add(pivot);
    part(CYLINDER(), top, pivot, [0, -0.1, 0], [0.075, 0.2, 0.075]);
    part(CYLINDER(), a.outfit === 'hoodie' ? top : skin, pivot, [0, -0.27, 0], [0.062, 0.2, 0.062]);
    part(SPHERE_LOW(), skin, pivot, [0, -0.4, 0], s3(0.075));
    return pivot;
  }) as [THREE.Group, THREE.Group];
  const hand = new THREE.Group();
  hand.position.set(0, -0.42, 0.06);
  arms[1].add(hand);

  const head = new THREE.Group();
  head.position.set(0, 1.33, 0);
  body.add(head);
  part(SPHERE(), skin, head, [0, 0, 0], [0.48, 0.46, 0.47]);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  paintFace(canvas.getContext('2d')!, a);
  const faceTexture = new THREE.CanvasTexture(canvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(FACE(), new THREE.MeshLambertMaterial({ map: faceTexture, transparent: true, depthWrite: false }));
  face.scale.set(0.487, 0.467, 0.477);
  face.renderOrder = 2;
  head.add(face);

  addHair(a, head);
  addEars(a, head, body);
  addAccessory(a, head);

  // Fewer draw calls: merge every group's plain shapes (the groups themselves keep animating).
  const groups: THREE.Object3D[] = [];
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh)) groups.push(o);
  });
  for (const g of groups) mergeParts(g);

  root.userData.parts = { body, head, arms, legs, hand, faceTexture } satisfies AvatarParts;
  return root;
}

export function avatarParts(avatar: THREE.Object3D): AvatarParts {
  return avatar.userData.parts as AvatarParts;
}

/**
 * Poses the character. `phase` advances with the steps; `move` is 0 (standing) to 1 (walking);
 * `run` 0 to 1 swings harder. When standing, a slow breathing bob plays instead.
 */
export function animateAvatar(avatar: THREE.Object3D, phase: number, move: number, run: number, time: number): void {
  const p = avatarParts(avatar);
  const swing = Math.sin(phase) * move * (0.6 + run * 0.35);
  p.legs[0].rotation.x = swing;
  p.legs[1].rotation.x = -swing;
  p.arms[0].rotation.x = -swing * 1.1;
  p.arms[1].rotation.x = swing * 1.1;
  const breathe = (1 - move) * Math.sin(time * 2.2) * 0.012;
  p.body.position.y = Math.abs(Math.cos(phase)) * 0.06 * move + breathe;
  p.body.rotation.x = run * move * 0.12;
  p.head.rotation.z = (1 - move) * Math.sin(time * 0.9) * 0.04;
}

/** Frees the per-character face texture and material (shared shapes and colors stay cached). */
export function disposeAvatar(avatar: THREE.Object3D): void {
  const p = avatar.userData.parts as AvatarParts | undefined;
  if (!p) return;
  p.faceTexture.dispose();
  avatar.traverse(o => {
    if (o.userData.ownGeometry) (o as THREE.Mesh).geometry.dispose();
  });
  p.head.traverse(o => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && (m as THREE.MeshLambertMaterial).map === p.faceTexture) m.dispose();
  });
}
