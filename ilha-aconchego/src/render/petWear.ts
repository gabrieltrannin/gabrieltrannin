import * as THREE from 'three';
import { ball, cyl, dot, group, torus, vcMesh } from '../assets/procedural/parts';
import type { ItemId } from '../data/items';

/** Stage 5: the pet's accessories, added to the bunny model (it is about 0.8 tall, facing +z). */
const WEAR: Partial<Record<ItemId, () => THREE.BufferGeometry[]>> = {
  'pet.bow': () => [ball(0.09, 0.06, 0.04, 0.12, 0.66, 0.12, 0xe8708f, 0, 0, 0.5), ball(0.09, 0.06, 0.04, 0.27, 0.6, 0.12, 0xe8708f, 0, 0, 0.5), dot(0.04, 0.04, 0.04, 0.2, 0.63, 0.14, 0xc0392b)],
  'pet.scarf': () => [torus(0.31, 0.055, 0, 0.18, 0, 0xf2c14e, Math.PI / 2), ball(0.07, 0.14, 0.04, 0.12, 0.08, 0.31, 0xf2c14e, 0.2, 0, 0.2), ball(0.072, 0.03, 0.042, 0.125, 0.04, 0.32, 0xe5484d, 0.2, 0, 0.2)],
  'pet.flowerCrown': () => [
    torus(0.16, 0.025, 0, 0.62, 0.02, 0x5e9c42, Math.PI / 2),
    ...[0xf7b6c8, 0xffe680, 0xffffff, 0xb892ff, 0xf7b6c8, 0xffe680].map((c, i) => dot(0.05, 0.035, 0.05, Math.cos((i / 6) * Math.PI * 2) * 0.16, 0.64, 0.02 + Math.sin((i / 6) * Math.PI * 2) * 0.16, c)),
  ],
  'pet.bell': () => [torus(0.3, 0.03, 0, 0.2, 0, 0xe5484d, Math.PI / 2), ball(0.06, 0.06, 0.06, 0, 0.13, 0.31, 0xe2b33c), cyl(0.01, 0.01, 0.03, 0, 0.08, 0.33, 0x6b4f3f, 4)],
};

/** Puts an accessory on the pet (or takes it off with null). */
export function dressPet(pet: THREE.Object3D, item: ItemId | null): void {
  const old = pet.getObjectByName('petwear');
  if (old) pet.remove(old);
  const make = item ? WEAR[item] : undefined;
  if (make) pet.add(group('petwear', vcMesh(make(), 'petwear')));
}
