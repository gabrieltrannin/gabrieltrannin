import * as THREE from 'three';

/** Where one copy goes. `s` scales uniformly; `sx`, `sy`, `sz` multiply it per axis. */
export interface Placement {
  x: number;
  y: number;
  z: number;
  ry?: number;
  s?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();

export function placementMatrix(p: Placement, target = new THREE.Matrix4()): THREE.Matrix4 {
  const s = p.s ?? 1;
  return target.compose(_p.set(p.x, p.y, p.z), _q.setFromAxisAngle(UP, p.ry ?? 0), _s.set(s * (p.sx ?? 1), s * (p.sy ?? 1), s * (p.sz ?? 1)));
}

/**
 * Draws many copies of one asset with one draw call per mesh inside it (InstancedMesh).
 * Works the same for the procedural placeholders and for glTF models: each mesh of the template
 * keeps its name, material and position inside the asset.
 */
export function instantiate(template: THREE.Object3D, placements: readonly Placement[], name = template.name): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  if (placements.length === 0) return group;
  template.updateMatrixWorld(true);
  template.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length);
    placements.forEach((p, i) => im.setMatrixAt(i, placementMatrix(p, _m).multiply(mesh.matrixWorld)));
    im.instanceMatrix.needsUpdate = true;
    im.userData.local = mesh.matrixWorld.clone();
    im.castShadow = mesh.castShadow;
    im.receiveShadow = mesh.receiveShadow;
    im.name = mesh.name;
    im.computeBoundingSphere();
    group.add(im);
  });
  group.userData.placements = placements.map(p => ({ ...p }));
  return group;
}

const _hidden = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Moves one copy (for example, to wobble a tree that was shaken). `only` limits the change to meshes
 * with that name. Hidden copies stay hidden unless `only` targets them.
 */
export function setInstancePlacement(group: THREE.Group, index: number, placement: Placement, only?: string): void {
  for (const child of group.children) {
    const im = child as THREE.InstancedMesh;
    if (!im.isInstancedMesh || (only && im.name !== only) || im.userData.hidden?.[index]) continue;
    im.setMatrixAt(index, placementMatrix(placement, _m).multiply(im.userData.local as THREE.Matrix4));
    im.instanceMatrix.needsUpdate = true;
  }
}

/** Shows or hides one copy of the meshes named `name` (for example, the fruit of one tree). */
export function setInstanceVisible(group: THREE.Group, index: number, name: string, visible: boolean): void {
  const placement = (group.userData.placements as Placement[])[index];
  if (!placement) return;
  for (const child of group.children) {
    const im = child as THREE.InstancedMesh;
    if (!im.isInstancedMesh || im.name !== name) continue;
    const hidden = ((im.userData.hidden ??= {}) as Record<number, boolean>);
    hidden[index] = !visible;
    im.setMatrixAt(index, visible ? placementMatrix(placement, _m).multiply(im.userData.local as THREE.Matrix4) : _hidden);
    im.instanceMatrix.needsUpdate = true;
  }
}
