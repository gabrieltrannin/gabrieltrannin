import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { GLOBE_LAMPS, HEDGES, PROPS, SEA_LEVEL, STALLS } from '../data/map';
import { instantiate, type Placement } from '../render/instancing';
import { heightAt } from './terrain';

export interface Props {
  root: THREE.Group;
  /** Windmill blades, turned every frame. */
  blades: THREE.Object3D[];
  boat: THREE.Object3D | null;
}

/** Buildings, market stalls, lamps, hedges and the single props listed in the map data. */
export function buildProps(assets: AssetRegistry): Props {
  const root = new THREE.Group();
  root.name = 'props';
  let boat: THREE.Object3D | null = null;

  for (const p of PROPS) {
    const object = assets.create(p.asset);
    const [x, z] = p.at;
    object.position.set(x, p.asset === 'boat' ? SEA_LEVEL : heightAt(x, z), z);
    object.rotation.y = p.ry ?? 0;
    object.scale.multiplyScalar(p.scale ?? 1);
    if (p.asset === 'boat') boat = object;
    root.add(object);
  }

  for (const s of STALLS) {
    const stall = assets.create(s.asset);
    stall.position.set(s.at[0], heightAt(s.at[0], s.at[1]), s.at[1]);
    root.add(stall);
  }

  root.add(instantiate(assets.create('lamp.globe'), GLOBE_LAMPS.map(([x, z]) => ({ x, y: heightAt(x, z), z }))));
  // Hedges: copies of a 1 x 1 block lined up along each hedge, slightly overlapping.
  const hedgeBlocks: Placement[] = [];
  for (const [x0, z0, x1, z1] of HEDGES) {
    const alongX = x1 - x0 >= z1 - z0;
    const length = alongX ? x1 - x0 : z1 - z0, width = alongX ? z1 - z0 : x1 - x0;
    const count = Math.max(1, Math.round(length));
    const step = length / count;
    for (let i = 0; i < count; i++) {
      const x = alongX ? x0 + step * (i + 0.5) : (x0 + x1) / 2;
      const z = alongX ? (z0 + z1) / 2 : z0 + step * (i + 0.5);
      hedgeBlocks.push({ x, y: heightAt(x, z), z, sx: alongX ? step * 1.08 : width, sz: alongX ? width : step * 1.08 });
    }
  }
  root.add(instantiate(assets.create('hedge.block'), hedgeBlocks));

  const blades: THREE.Object3D[] = [];
  root.traverse(o => {
    if (o.name === 'blades') blades.push(o);
  });
  return { root, blades, boat };
}
