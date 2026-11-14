/**
 * Parts of the world the camera and the minimap frame on their own: the main island, the village
 * islet and the wood. The "whole island" view and the shadows follow the part the player is in.
 */
export interface Area {
  id: 'main' | 'village' | 'wood';
  x: number;
  z: number;
  width: number;
  depth: number;
}

export const AREAS: readonly Area[] = [
  { id: 'main', x: 0, z: 3.5, width: 41, depth: 38 },
  { id: 'village', x: 34.8, z: 0.6, width: 25, depth: 31 },
  { id: 'wood', x: 35, z: -23.5, width: 19, depth: 16 },
];

export function areaAt(x: number, z: number): Area {
  if (x > 20.5) return z < -15.5 ? AREAS[2]! : AREAS[1]!;
  return AREAS[0]!;
}
