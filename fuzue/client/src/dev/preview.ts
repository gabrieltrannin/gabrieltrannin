import * as THREE from 'three';
import type { MinigameId } from '@fuzue/shared';
import { animateCritter, makeCritter } from '../engine/critter';
import type { Stage } from '../engine/Stage';
import { buildEnv } from '../views/minigames/envs';

/**
 * Só no modo de desenvolvimento: `__preview('hexa')` no console mostra a arena
 * de um minijogo com quatro bonecos parados, sem precisar de servidor.
 */
export function installPreview(stage: Stage): void {
  (window as unknown as { __preview: (id: MinigameId) => void }).__preview = (id) => {
    for (const el of document.querySelectorAll<HTMLElement>('main, section, .hud')) el.hidden = true;
    const scene = new THREE.Scene();
    const env = buildEnv(id, scene);
    const spots = id === 'corrida' ? [[-2, 2], [-0.7, 3], [0.7, 2.4], [2, 3.2]] : [[-1.6, 0.6], [-0.5, -0.4], [0.6, 0.5], [1.7, -0.3]];
    const critters = spots.map(([x, z], i) => {
      const c = makeCritter(i);
      c.root.position.set(x, id === 'hexa' ? 0 : 0, z);
      c.root.scale.setScalar(0.85);
      scene.add(c.root);
      return c;
    });
    const cam = stage.camera;
    stage.show({
      scene,
      update: (dt, t) => {
        env.update(dt, t, null);
        critters.forEach(c => animateCritter(c, t, { speed: 0, punching: false, stunned: false, falling: false }));
        if (id === 'corrida') {
          cam.position.set(0, 6.5, 11);
          cam.lookAt(0, 0, -4);
        } else {
          cam.position.set(0, env.size * 1.05 + 3, env.size * 1.25 + 3);
          cam.lookAt(0, 0, 0);
        }
      },
    });
  };
}
