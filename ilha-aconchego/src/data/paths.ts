import type { XZ } from './map';
import { HOUSE_SPOTS, houseDoor } from './village';

/**
 * Walking network for the villagers: points along the paths and the edges between them.
 * A villager walks from where they are to the nearest point, along the network, then to their place.
 */
export const PATH_NODES: Record<string, XZ> = {
  // Main island.
  houseDoor: [-12.4, -0.6], pathW: [-12.4, 7.5], penPath: [-8.5, 7.5], penGate: [-8.5, 11.1], farmS: [-3.0, 7.5],
  farmC: [-3.0, 0.5], farmN: [-3.0, -5.0], northPath: [4.5, -5.0], rampBottom: [6.75, -3.5], rampTop: [6.75, -7.0],
  upperW: [-6.8, -7.4], upperE: [9.6, -8.6], hives: [4.3, -8.8], behindStalls: [10.3, -3.3], behindStallsE: [14.9, -3.0], stallsGapE: [15.1, -0.6], bridgeW: [15.8, -2.8],
  mailbox: [-9.8, -0.4], pathE: [5.6, 7.5], plazaW: [6.8, 6.8], plazaC: [10.3, 4.6], plazaN: [10.3, 1.2], plazaNE: [13.4, 1.2],
  plazaNW: [7.2, 1.2], plazaS: [10.0, 8.6], pondW: [11.0, 10.4], stairsTop: [10.0, 12.6], stairsBottom: [10.0, 15.3],
  pierEnd: [10.0, 21.0], beachW: [4.0, 15.6], beachFar: [-4.0, 15.9], lawn: [0.6, 9.8],
  // Village.
  bridgeE: [25.8, -2.8], vStreetN: [26.6, -2.8], vPlaza: [29.2, -2.8], vEast: [33.5, -2.8], vMuseumPath: [33.5, 0.9], vMuseum: [38.0, 0.9],
  vRow1W: [26.6, -6.2], vRow1a: [28.6, -6.2], vRow1b: [32.6, -6.2], vRow1c: [34.5, -6.2], vRow1d: [36.6, -6.2], vRow1e: [40.6, -6.2],
  vMid: [26.6, 3.6], vSeeds: [30.4, 3.6], vRow2W: [26.6, 8.0], vRow2a: [28.6, 8.0], vRow2b: [32.6, 8.0], vRow2c: [36.6, 8.0], vRow2d: [40.6, 8.0],
  vRow3W: [26.6, 12.3], vRow3a: [28.6, 12.3], vRow3b: [32.6, 12.3], vRow3c: [36.6, 12.3], vRow3d: [40.6, 12.3],
  vOldBridge: [34.5, -11.6],
  // The wood (across the old bridge).
  woodS: [34.5, -19.2], woodC: [34.5, -23.0], woodW: [30.8, -24.0], woodE: [38.8, -25.2],
};

export const PATH_EDGES: readonly (readonly [string, string])[] = [
  ['houseDoor', 'pathW'], ['houseDoor', 'mailbox'], ['pathW', 'penPath'], ['penPath', 'penGate'], ['penPath', 'farmS'], ['farmS', 'farmC'],
  ['farmC', 'farmN'], ['farmN', 'northPath'], ['northPath', 'rampBottom'], ['rampBottom', 'rampTop'], ['rampTop', 'upperW'], ['rampTop', 'hives'],
  ['hives', 'upperE'], ['rampBottom', 'behindStalls'], ['behindStalls', 'behindStallsE'], ['behindStallsE', 'bridgeW'], ['behindStallsE', 'stallsGapE'], ['stallsGapE', 'plazaNE'], ['farmS', 'pathE'], ['farmS', 'lawn'], ['pathE', 'plazaW'],
  ['plazaW', 'plazaC'], ['plazaC', 'plazaN'], ['plazaN', 'plazaNW'], ['plazaN', 'plazaNE'], ['plazaC', 'plazaS'], ['plazaS', 'pondW'],
  ['plazaS', 'stairsTop'], ['stairsTop', 'stairsBottom'], ['stairsBottom', 'pierEnd'], ['stairsBottom', 'beachW'], ['beachW', 'beachFar'],
  ['bridgeW', 'bridgeE'], ['bridgeE', 'vStreetN'], ['vStreetN', 'vPlaza'], ['vPlaza', 'vEast'], ['vEast', 'vMuseumPath'], ['vMuseumPath', 'vMuseum'],
  ['vStreetN', 'vRow1W'], ['vRow1W', 'vRow1a'], ['vRow1a', 'vRow1b'], ['vRow1b', 'vRow1c'], ['vRow1c', 'vRow1d'], ['vRow1d', 'vRow1e'],
  ['vStreetN', 'vMid'], ['vMid', 'vSeeds'], ['vMid', 'vRow2W'], ['vRow2W', 'vRow2a'], ['vRow2a', 'vRow2b'], ['vRow2b', 'vRow2c'], ['vRow2c', 'vRow2d'],
  ['vRow2W', 'vRow3W'], ['vRow3W', 'vRow3a'], ['vRow3a', 'vRow3b'], ['vRow3b', 'vRow3c'], ['vRow3c', 'vRow3d'],
  ['vRow1c', 'vOldBridge'], ['vOldBridge', 'woodS'], ['woodS', 'woodC'], ['woodC', 'woodW'], ['woodC', 'woodE'],
];

/** Each house door connects to the street in front of it. */
for (const h of HOUSE_SPOTS) {
  const id = `door.${h.npc}`;
  PATH_NODES[id] = houseDoor(h);
  const street = Object.entries(PATH_NODES)
    .filter(([key]) => key.startsWith('vRow'))
    .sort((a, b) => Math.hypot(a[1][0] - h.x, a[1][1] - houseDoor(h)[1]) - Math.hypot(b[1][0] - h.x, b[1][1] - houseDoor(h)[1]))[0]!;
  (PATH_EDGES as (readonly [string, string])[]).push([id, street[0]]);
}

/** Edges that only exist once the old bridge is fixed. */
export const BRIDGE_EDGE: readonly [string, string] = ['vOldBridge', 'woodS'];
