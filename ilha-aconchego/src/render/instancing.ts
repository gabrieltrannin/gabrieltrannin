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
    im.castShadow = mesh.castShadow;
    im.receiveShadow = mesh.receiveShadow;
    im.name = mesh.name;
    im.computeBoundingSphere();
    group.add(im);
  });
  return group;
}
