import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { WALK_LOOP } from '../data/map';
import { heightAt } from './terrain';

export interface Walker {
  object: THREE.Object3D;
  update(dt: number, elapsed: number): void;
}

const SPEED = 1.45;

/** Placeholder figure walking a loop along the paths, so the follow camera has something to follow. */
export function buildWalker(assets: AssetRegistry): Walker {
  const object = assets.create('debug.walker');
  const curve = new THREE.CatmullRomCurve3(WALK_LOOP.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.5);
  const length = curve.getLength();
  let t = 0.02;
  const place = (elapsed: number) => {
    const p = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    object.position.set(p.x, heightAt(p.x, p.z) + Math.abs(Math.sin(elapsed * 9)) * 0.06, p.z);
    object.rotation.y = Math.atan2(tangent.x, tangent.z);
  };
  place(0);
  return {
    object,
    update(dt, elapsed) {
      t = (t + (dt * SPEED) / length) % 1;
      place(elapsed);
    },
  };
}
