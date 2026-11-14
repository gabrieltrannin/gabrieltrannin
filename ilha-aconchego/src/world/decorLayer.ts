import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { decorAsset, isDecorItem } from '../data/decor';
import { decorCenter } from '../core/decor';
import type { PlacedDecor } from '../core/types';

/** Turns a placement's quarter turns into the object's rotation. */
export const decorRotation = (rot: number): number => -rot * (Math.PI / 2);

/**
 * Stage 5: the furniture and decorations of one space (the island outside, or a floor of the house),
 * kept in step with the game state. Objects are reused while their placement stays the same.
 */
export class DecorLayer {
  readonly root = new THREE.Group();
  private readonly objects = new Map<number, { object: THREE.Object3D; key: string }>();

  constructor(private readonly assets: AssetRegistry, private readonly height: (x: number, z: number) => number) {
    this.root.name = 'decor';
  }

  sync(list: readonly PlacedDecor[]): void {
    const seen = new Set<number>();
    for (const p of list) {
      if (!isDecorItem(p.item)) continue;
      seen.add(p.id);
      const key = `${p.item}|${p.x}|${p.z}|${p.rot}`;
      const existing = this.objects.get(p.id);
      if (existing?.key === key) continue;
      if (existing) this.root.remove(existing.object);
      const object = existing && existing.key.startsWith(`${p.item}|`) ? existing.object : this.assets.create(decorAsset(p.item));
      const [x, z] = decorCenter(p);
      object.position.set(x, this.height(x, z), z);
      object.rotation.y = decorRotation(p.rot);
      object.userData.decorId = p.id;
      object.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = o.name !== 'lamp';
          o.receiveShadow = true;
        }
      });
      this.root.add(object);
      this.objects.set(p.id, { object, key });
    }
    for (const [id, entry] of this.objects) {
      if (seen.has(id)) continue;
      this.root.remove(entry.object);
      this.objects.delete(id);
    }
  }

  /** The object of a placed decoration (for highlighting it in decoration mode). */
  objectOf(id: number): THREE.Object3D | null {
    return this.objects.get(id)?.object ?? null;
  }
}
