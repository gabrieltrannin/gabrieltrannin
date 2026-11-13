import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { GLOBE_LAMPS, HEDGES, PROPS, SEA_LEVEL, STALLS } from '../data/map';
import { instantiate } from '../render/instancing';
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
  root.add(
    instantiate(
      assets.create('hedge.block'),
      HEDGES.map(([x0, z0, x1, z1]) => ({ x: (x0 + x1) / 2, y: heightAt((x0 + x1) / 2, (z0 + z1) / 2), z: (z0 + z1) / 2, sx: x1 - x0, sz: z1 - z0 })),
    ),
  );

  const blades: THREE.Object3D[] = [];
  root.traverse(o => {
    if (o.name === 'blades') blades.push(o);
  });
  return { root, blades, boat };
}
