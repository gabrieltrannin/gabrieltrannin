import * as THREE from 'three';
import { LEVELS, SEA_LEVEL } from '../data/map';
import { ISLETS } from '../data/village';
import { rippleTexture, seaGradientTexture } from '../render/textures';
import { roundedRectShape } from './island';

export interface Sea {
  root: THREE.Group;
  /** Tint for the time of day and weather (white = untouched). */
  setTint(color: THREE.Color): void;
  update(elapsed: number, reducedMotion: boolean): void;
}

/** Turquoise near the island, deep blue far away, scrolling ripples and pulsing foam along the beach. */
export function buildSea(): Sea {
  const root = new THREE.Group();
  root.name = 'sea';
  const water = new THREE.MeshPhongMaterial({ map: seaGradientTexture(), shininess: 90, specular: 0x335566 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), water);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(0, SEA_LEVEL, 1.2);
  plane.receiveShadow = true;
  // Drawn first among solid objects so the rainbow can sit between the sea and the island.
  plane.renderOrder = -0.8;

  const ripples = rippleTexture();
  ripples.repeat.set(26, 26);
  const rippleLayer = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), new THREE.MeshBasicMaterial({ map: ripples, transparent: true, opacity: 0.32, depthWrite: false }));
  rippleLayer.rotation.x = -Math.PI / 2;
  rippleLayer.position.set(0, SEA_LEVEL + 0.02, 1.2);

  // Foam: a flattened tube just outside each beach outline (the island, the village islet, the wood).
  const foamMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
  const foams = [LEVELS.beach, ...ISLETS.map(i => i.beach)].map(beach => {
    const points = roundedRectShape(beach).getSpacedPoints(200);
    points.pop();
    const cx = (beach.x0 + beach.x1) / 2, cz = (beach.z0 + beach.z1) / 2;
    const curve = new THREE.CatmullRomCurve3(
      points.map(p => {
        const dx = p.x - cx, dz = -p.y - cz, d = Math.hypot(dx, dz) || 1;
        return new THREE.Vector3(p.x + (dx / d) * 0.25, SEA_LEVEL + 0.02, -p.y + (dz / d) * 0.25);
      }),
      true,
    );
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 0.26, 5, true), foamMaterial);
    mesh.scale.y = 0.25;
    return mesh;
  });
  const foam = new THREE.Group();
  foam.add(...foams);

  root.add(plane, rippleLayer, foam);
  return {
    root,
    setTint(color) {
      water.color.copy(color);
    },
    update(elapsed, reducedMotion) {
      if (!reducedMotion) ripples.offset.set(elapsed * 0.012, elapsed * 0.006);
      const pulse = Math.sin(elapsed * 1.4);
      foamMaterial.opacity = 0.5 + pulse * 0.2;
    },
  };
}
