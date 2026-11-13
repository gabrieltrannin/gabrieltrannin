import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { leafTexture } from '../../render/textures';
import type { AssetRegistry } from '../registry';

/**
 * Procedural placeholders made of simple shapes. Each one is registered under the name
 * a future glTF model will use. Stage 1 adds the rest of the art list from the design document.
 */

let shared: ReturnType<typeof createShared> | null = null;

function createShared() {
  const leaves = leafTexture();
  leaves.repeat.set(3, 2);
  const crownGeometry = mergeGeometries(
    [
      [0, 2.6, 0, 1.2],
      [0.85, 2.2, 0.25, 0.85],
      [-0.8, 2.25, -0.15, 0.9],
      [0.15, 3.35, 0.05, 0.8],
      [-0.25, 2.05, 0.7, 0.75],
      [0.35, 2.4, -0.7, 0.8],
    ].map(([x, y, z, r]) => {
      const g = new THREE.SphereGeometry(1, 16, 12);
      g.scale(r!, r! * 0.92, r!);
      g.translate(x!, y!, z!);
      return g;
    }),
  );
  return {
    crownGeometry,
    trunkGeometry: new THREE.CylinderGeometry(0.2, 0.3, 2, 10).translate(0, 1, 0),
    rootGeometry: new THREE.CylinderGeometry(0.3, 0.46, 0.3, 10).translate(0, 0.15, 0),
    fruitGeometry: new THREE.SphereGeometry(0.17, 12, 10),
    logGeometry: new THREE.CylinderGeometry(0.12, 0.13, 1, 10).translate(0, 0.5, 0),
    logTopGeometry: new THREE.CylinderGeometry(0.105, 0.105, 0.02, 10).translate(0, 1.0, 0),
    crown: new THREE.MeshLambertMaterial({ map: leaves, color: 0x6cbb52 }),
    bark: new THREE.MeshLambertMaterial({ color: 0x8b5e3c }),
    barkDark: new THREE.MeshLambertMaterial({ color: 0x7e5434 }),
    logTop: new THREE.MeshLambertMaterial({ color: 0xd9b48a }),
    peach: new THREE.MeshPhongMaterial({ color: 0xf7a07a, shininess: 60 }),
  };
}

function getShared() {
  return (shared ??= createShared());
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const FRUIT_POINTS = [
  [0.5, 0.1, 0.86],
  [-0.55, 0.25, 0.8],
  [0.1, -0.25, 0.97],
  [0.85, 0.35, 0.4],
  [-0.85, 0, 0.5],
  [0.25, 0.6, 0.76],
].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize().multiplyScalar(1.17).add(new THREE.Vector3(0, 2.6, 0)));

export function registerProceduralAssets(registry: AssetRegistry): void {
  registry.register('tree.peach', () => {
    const s = getShared();
    const group = new THREE.Group();
    group.add(mesh(s.trunkGeometry, s.bark), mesh(s.rootGeometry, s.barkDark), mesh(s.crownGeometry, s.crown));
    for (const p of FRUIT_POINTS) {
      const fruit = mesh(s.fruitGeometry, s.peach);
      fruit.position.copy(p);
      group.add(fruit);
    }
    return group;
  });

  registry.register('fence.log', () => {
    const s = getShared();
    const group = new THREE.Group();
    group.add(mesh(s.logGeometry, s.bark), mesh(s.logTopGeometry, s.logTop));
    group.scale.y = 0.6;
    return group;
  });
}
