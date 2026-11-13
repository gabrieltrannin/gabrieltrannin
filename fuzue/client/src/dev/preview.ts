import * as THREE from 'three';
import {
  BARDO, CERCO, LADEIRA, LAVA_COLUMNS, MACHADOS, TINTA, axeX, lavaLevel, slopeHeight, type MinigameId,
} from '@fuzue/shared';
import { animateCritter, makeCritter } from '../engine/critter';
import type { Stage } from '../engine/Stage';
import type { MapLike, NetEntity, NetMgPlayer, NetMinigame, NetState } from '../net/types';
import { createEntity } from '../views/minigames/entities';
import { buildEnv } from '../views/minigames/envs';

/**
 * Só no modo de desenvolvimento: `__preview('hexa')` no console mostra a arena
 * de um minijogo com bonecos e objetos de exemplo, sem precisar de servidor.
 */

type Ent = Omit<NetEntity, 'kind'> & { kind: string };
const e = (kind: string, x: number, y: number, z: number, a = 0, s = 0): Ent => ({ kind, x, y, z, a, s });

/** Objetos de exemplo de cada minijogo. */
const SAMPLES: Partial<Record<MinigameId, () => Ent[]>> = {
  chuva: () => [e('coin', 2, 3, 1, 0, 1), e('coin', -3, 1, 2, 0, 3), e('bomb', 1, 6, -2)],
  coroa: () => [e('crown', 1.5, 0.45, 1)],
  trono: () => [e('zone', 2, 0, -1, 5, 2.3)],
  potes: () => [e('pot', 3, 0, 1, 0, 0), e('pot', -2, 0, 3, 1, 1), e('pot', 1, 0, -3, 2, 2), e('pot', -4, 0, -1, 3, 0), e('pot', 5, 0, -3, 4, 0)],
  colheita: () => [e('pumpkin', 6, 0.35, 2, 0, 0), e('pumpkin', -6.5, 0.35, -1, 1, 1), e('pumpkin', 2, 0.35, 7, 2, 0)],
  moinho: () => [e('mill', 0, 0, 0, 0.8, 2)],
  flechas: () => [e('arrow', 1, 5, 2), e('arrow', -2, 2, 0), e('arrow', 3, 0, -2), e('arrow', -1, 8, -3)],
  javali: () => [e('boar', 0, 0, -4, 0.4, 1)],
  cerco: () => [e('boulder', 2, 6, 2)],
  bardo: () => [e('bard', 0, 0, -BARDO.n * BARDO.cell / 2 - 2.2, 2, 1)],
  tinta: () => [e('bucket', 2, 0, 2)],
  ladeira: () => [e('barrel', 1.5, (slopeHeight(-6) ?? 0) + LADEIRA.barrelR, -6), e('barrel', -2, (slopeHeight(-12) ?? 0) + LADEIRA.barrelR, -12)],
  machados: () => MACHADOS.axes.map((a, i) => e('axe', axeX(i, 1), 0, a.z, 0, a.speed)),
  pastoreio: () => [-3, -1, 1, 3, 5].map((x, i) => e('sheep', x, 0, (i % 2) * 2 - 1, i, 0)),
  estandarte: () => [e('flag', -8.6, 0, 0, 0, 0), e('flag', 8.6, 0, 0, 0, 1)],
};

function mapOf<T>(entries: [string, T][]): MapLike<T> {
  const m = new Map(entries);
  return { get: k => m.get(k), has: k => m.has(k), forEach: cb => m.forEach((v, k) => cb(v, k)), size: m.size };
}

/** Pisos de exemplo (alguns caindo, alguns pintados). */
function sampleTiles(id: MinigameId): number[] {
  if (id === 'cerco') return Array.from({ length: CERCO.n * CERCO.n }, (_, i) => (i % 13 === 0 ? 2 : i % 17 === 0 ? 1 : 0));
  if (id === 'bardo') return Array.from({ length: BARDO.n * BARDO.n }, (_, i) => (Math.floor(i / 2) + Math.floor(i / 16)) % 4);
  if (id === 'tinta') return Array.from({ length: TINTA.n * TINTA.n }, (_, i) => (i % 7 < 3 ? (i % 4) + 1 : 0));
  return [];
}

export function installPreview(stage: Stage): void {
  (window as unknown as { __preview: (id: MinigameId) => void }).__preview = (id) => {
    for (const el of document.querySelectorAll<HTMLElement>('main, section, .hud')) el.hidden = true;
    const scene = new THREE.Scene();
    const env = buildEnv(id, scene);
    const climb = id === 'lava';
    const spots = id === 'corrida' || id === 'ladeira' || id === 'machados'
      ? [[-1.2, 2], [-0.4, 3], [0.4, 2.4], [1.2, 3.2]]
      : climb ? LAVA_COLUMNS.slice(3, 7).map(c => [c.x, c.z]) : [[-1.6, 0.6], [-0.5, -0.4], [0.6, 0.5], [1.7, -0.3]];
    const critters = spots.map(([x, z], i) => {
      const c = makeCritter(i);
      c.root.position.set(x, climb ? LAVA_COLUMNS[3 + i].h : 0, z);
      c.root.scale.setScalar(0.85);
      scene.add(c.root);
      return c;
    });
    const ents = (SAMPLES[id]?.() ?? []).map(d => {
      const v = createEntity(d as NetEntity);
      scene.add(v.obj);
      if (v.shadow) { v.shadow.position.set(d.x, 0.03, d.z); scene.add(v.shadow); }
      return v;
    });
    const tiles = sampleTiles(id);
    const players = mapOf<NetMgPlayer>([0, 1, 2, 3].map(i => [`p${i}`, { team: i } as NetMgPlayer]));
    const fake = {
      tiles: Object.assign(tiles, { forEach: tiles.forEach.bind(tiles) }),
      radius: climb ? lavaLevel(25, 60) : 0,
      entities: mapOf(ents.map((v, i) => [`e${i}`, v.data])),
      players,
      teamScore: [0, 0],
    } as unknown as NetMinigame;
    const state = { players: mapOf([0, 1, 2, 3].map(i => [`p${i}`, { character: i }])), mg: fake } as unknown as NetState;
    const cam = stage.camera;
    stage.show({
      scene,
      update: (dt, t) => {
        env.update(dt, t, fake, state);
        critters.forEach(c => animateCritter(c, t, { speed: 0, punching: false, stunned: false, falling: false }));
        for (const v of ents) {
          if (!v.fixed) v.obj.position.copy(v.target);
          v.tick?.(v, dt, t);
        }
        if (id === 'corrida' || id === 'machados') {
          cam.position.set(0, 6.5, 11);
          cam.lookAt(0, 0, -4);
        } else if (id === 'ladeira') {
          cam.position.set(0, 9, 13);
          cam.lookAt(0, 2, -6);
        } else if (climb) {
          cam.position.set(0, 16, 15);
          cam.lookAt(0, 3, 0);
        } else {
          cam.position.set(0, env.size * 1.05 + 3, env.size * 1.25 + 3);
          cam.lookAt(0, 0, 0);
        }
      },
    });
  };
}
