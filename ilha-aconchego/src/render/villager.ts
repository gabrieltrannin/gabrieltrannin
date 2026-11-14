import * as THREE from 'three';
import type { VillagerDef } from '../data/villagers';
import { buildAvatar, type AvatarKit } from './avatar';

/**
 * Builds a villager in the same style as the player's character (big head, painted face, clothes),
 * with the features of their species: ears, snout, beak, tail or shell, plus a little extra
 * (apron, mail bag, glasses, scarf, beret, hard hat or bandana).
 */
export function buildVillager(def: VillagerDef): THREE.Group {
  const root = buildAvatar(def.look, kit => addSpecies(def, kit));
  root.name = `npc.${def.id}`;
  return root;
}

const s3 = (v: number): [number, number, number] => [v, v, v];

function addSpecies(def: VillagerDef, k: AvatarKit): void {
  const fur = k.mat(def.fur), muzzle = k.mat(def.muzzle), ink = k.mat('#2A1E1E'), pink = k.mat('#F7B6C8');
  const { head, body, part } = k;
  const snout = (w = 0.2, h = 0.13, color = muzzle) => {
    part(k.sphere(), color, head, [0, -0.13, 0.39], [w, h, 0.14]);
    part(k.sphereLow(), ink, head, [0, -0.07, 0.52], [0.055, 0.04, 0.035]);
  };
  const pointyEars = (inner = pink, h = 0.3, spread = 0.27) => {
    for (const s of [-1, 1]) {
      part(k.cone(), fur, head, [s * spread, 0.43, -0.02], [0.14, h, 0.11], [0, 0, -s * 0.35]);
      part(k.cone(), inner, head, [s * (spread - 0.005), 0.42, 0.03], [0.08, h * 0.6, 0.04], [0, 0, -s * 0.35]);
    }
  };
  const roundEars = (size = 0.1, y = 0.36, x = 0.33, color = fur) => {
    for (const s of [-1, 1]) part(k.sphere(), color, head, [s * x, y, -0.04], [size, size, size * 0.6]);
  };
  const tailChain = (points: [number, number, number, number][], color = fur) => {
    for (const [x, y, z, r] of points) part(k.sphere(), color, body, [x, y, z], s3(r));
  };

  switch (def.species) {
    case 'fox':
      pointyEars(muzzle, 0.32, 0.26);
      snout(0.18, 0.12);
      tailChain([[0, 0.5, -0.32, 0.13], [0.05, 0.62, -0.46, 0.15], [0.1, 0.78, -0.52, 0.13]]);
      part(k.sphere(), muzzle, body, [0.13, 0.9, -0.52], s3(0.09));
      break;
    case 'otter':
      roundEars(0.07, 0.3, 0.38);
      snout(0.24, 0.13);
      part(k.cone(), fur, body, [0, 0.38, -0.36], [0.1, 0.45, 0.1], [-1.9, 0, 0]);
      break;
    case 'owl':
      for (const s of [-1, 1]) part(k.cone(), fur, head, [s * 0.24, 0.47, -0.02], [0.07, 0.2, 0.06], [0, 0, -s * 0.45]);
      part(k.cone(), k.mat('#F2B33D'), head, [0, -0.1, 0.48], [0.07, 0.14, 0.06], [Math.PI / 2 + 0.4, 0, 0]);
      break;
    case 'badger':
      roundEars(0.07, 0.34, 0.33, k.mat('#3B393E'));
      part(k.sphere(), k.mat('#F4F1EA'), head, [0, 0.3, 0.2], [0.11, 0.2, 0.28], [-0.5, 0, 0]);
      snout(0.18, 0.12);
      break;
    case 'rabbit':
      for (const s of [-1, 1]) {
        part(k.sphere(), fur, head, [s * 0.16, 0.66, -0.04], [0.09, 0.32, 0.06], [0, 0, -s * 0.15]);
        part(k.sphere(), pink, head, [s * 0.16, 0.65, 0.01], [0.05, 0.24, 0.03], [0, 0, -s * 0.15]);
      }
      part(k.sphereLow(), pink, head, [0, -0.06, 0.48], [0.05, 0.035, 0.03]);
      part(k.sphereLow(), k.mat('#FFFFFF'), body, [0, 0.5, -0.26], s3(0.1));
      break;
    case 'bear':
      roundEars(0.12, 0.38, 0.32);
      snout(0.21, 0.14);
      part(k.sphereLow(), fur, body, [0, 0.48, -0.25], s3(0.08));
      break;
    case 'sheep':
      for (const s of [-1, 1]) part(k.sphere(), k.mat(def.muzzle), head, [s * 0.46, 0.08, 0], [0.13, 0.06, 0.08], [0, 0, -s * 0.4]);
      for (const [x, y, z] of [[0, 0.44, 0.05], [-0.18, 0.4, 0.15], [0.18, 0.4, 0.15], [0, 0.4, 0.25]] as const) part(k.sphere(), k.mat('#F7F3EA'), head, [x, y, z], s3(0.15));
      break;
    case 'dog':
      for (const s of [-1, 1]) part(k.sphere(), k.mat('#8A5A3C'), head, [s * 0.44, 0.05, 0.02], [0.08, 0.24, 0.12], [0, 0, -s * 0.25]);
      snout(0.2, 0.13);
      part(k.cone(), fur, body, [0, 0.62, -0.3], [0.06, 0.25, 0.06], [-0.6, 0, 0]);
      break;
    case 'frog':
      for (const s of [-1, 1]) part(k.sphere(), fur, head, [s * 0.2, 0.38, 0.18], s3(0.13));
      part(k.sphere(), muzzle, body, [0, 0.72, 0.18], [0.18, 0.2, 0.08]);
      break;
    case 'turtle':
      part(k.sphere(), k.mat('#6B8E4E'), body, [0, 0.72, -0.18], [0.36, 0.38, 0.26]);
      for (const [x, y] of [[0, 0.82], [-0.14, 0.65], [0.14, 0.65], [0, 0.5]] as const) part(k.sphereLow(), k.mat('#8DAE63'), body, [x, y, -0.4], [0.1, 0.08, 0.05]);
      break;
    case 'cat':
      pointyEars(pink, 0.28, 0.27);
      part(k.sphereLow(), pink, head, [0, -0.06, 0.48], [0.045, 0.035, 0.03]);
      tailChain([[0, 0.5, -0.25, 0.05], [0, 0.42, -0.42, 0.05], [0.05, 0.6, -0.56, 0.05], [0.08, 0.82, -0.56, 0.05]]);
      break;
    case 'squirrel':
      pointyEars(muzzle, 0.22, 0.24);
      for (const s of [-1, 1]) part(k.cone(), fur, head, [s * 0.25, 0.6, -0.02], [0.04, 0.12, 0.04]);
      snout(0.16, 0.11);
      tailChain([[0, 0.45, -0.32, 0.14], [0, 0.66, -0.46, 0.18], [0, 0.92, -0.44, 0.19], [0, 1.12, -0.32, 0.15]]);
      break;
  }

  switch (def.extra) {
    case 'apron':
      part(k.box(), k.mat('#F6EFDD'), body, [0, 0.62, 0.23], [0.34, 0.46, 0.03]);
      part(k.box(), k.mat('#F6EFDD'), body, [0, 0.9, 0.2], [0.2, 0.1, 0.03]);
      break;
    case 'mailbag':
      part(k.box(), k.mat('#8A5A3C'), body, [0.26, 0.55, 0.1], [0.08, 0.22, 0.28]);
      part(k.geo('strap', () => new THREE.TorusGeometry(0.28, 0.02, 6, 20)), k.mat('#6E4A2E'), body, [0.02, 0.78, 0.02], s3(1), [0.3, 0, 0.7]);
      break;
    case 'glasses':
      for (const s of [-1, 1]) part(k.geo('lens', () => new THREE.TorusGeometry(0.09, 0.015, 6, 18)), k.mat('#3A2A20'), head, [s * 0.14, 0.06, 0.45], s3(1));
      break;
    case 'scarf':
    case 'bandana':
      part(k.geo('scarf', () => new THREE.TorusGeometry(0.16, 0.06, 8, 18)), k.mat(def.extra === 'scarf' ? '#E5484D' : '#5B8DD9'), body, [0, 0.97, 0], s3(1), [Math.PI / 2, 0, 0]);
      break;
    case 'beret':
      part(k.cylinder(), k.mat('#B5394A'), head, [0.05, 0.45, -0.02], [0.32, 0.08, 0.32], [0.2, 0, -0.25]);
      break;
    case 'hardhat':
      part(k.geo('hardhat', () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), k.mat('#F2C14E'), head, [0, 0.2, 0], [0.5, 0.42, 0.5]);
      part(k.cylinder(), k.mat('#E0A93A'), head, [0, 0.21, 0.08], [0.56, 0.03, 0.56]);
      break;
  }
}
