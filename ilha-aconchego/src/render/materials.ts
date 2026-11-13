import * as THREE from 'three';
import { FRUITS, FRUIT_COLORS, type FruitId } from '../data/defaults';
import { awningTexture, brickTexture, hutWallTexture, leafTexture, thatchTexture, valanceTexture, woodPlankTexture } from './textures';

/**
 * Materials shared by many objects. Sharing them is what lets the season system recolor every
 * leaf with one change, and the time of day turn every lamp on at once.
 */
export interface SharedMaterials {
  /** Most props: colors live in the geometry (vertex colors), so one material draws them all. */
  vc: THREE.MeshLambertMaterial;
  leafRound: THREE.MeshLambertMaterial;
  leafBlossom: THREE.MeshLambertMaterial;
  leafPine: THREE.MeshLambertMaterial;
  leafBush: THREE.MeshLambertMaterial;
  hedge: THREE.MeshLambertMaterial;
  /** Rounded grass lip along the cliff tops. */
  lip: THREE.MeshLambertMaterial;
  /** White, tinted per instance (tall grass, flowers). */
  tinted: THREE.MeshLambertMaterial;
  flowerCenter: THREE.MeshLambertMaterial;
  stem: THREE.MeshLambertMaterial;
  fruit: Record<FruitId, THREE.MeshPhongMaterial>;
  /** Lit at night: house windows, string-light bulbs, globe lamps, ground lanterns. */
  window: THREE.MeshLambertMaterial;
  bulb: THREE.MeshLambertMaterial;
  globe: THREE.MeshLambertMaterial;
  lantern: THREE.MeshLambertMaterial;
  awning: THREE.MeshLambertMaterial;
  valance: THREE.MeshLambertMaterial;
  thatch: THREE.MeshLambertMaterial;
  hutWall: THREE.MeshLambertMaterial;
  brick: THREE.MeshLambertMaterial;
  deck: THREE.MeshLambertMaterial;
  snow: THREE.MeshLambertMaterial;
  water: THREE.MeshLambertMaterial;
}

let cache: SharedMaterials | null = null;

/** Created on first use (textures need a browser canvas). */
export function materials(): SharedMaterials {
  return (cache ??= create());
}

function create(): SharedMaterials {
  const leaves = leafTexture();
  leaves.repeat.set(3, 2);
  const hedgeLeaves = leaves.clone();
  hedgeLeaves.repeat.set(5, 1.2);
  hedgeLeaves.needsUpdate = true;
  const thatch = thatchTexture();
  thatch.repeat.set(4, 1);
  const hut = hutWallTexture();
  hut.repeat.set(5, 1);
  const brick = brickTexture();
  brick.repeat.set(3, 2);
  const deck = woodPlankTexture();
  deck.repeat.set(1, 6);

  const lambert = (params: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial(params);
  const lamp = (color: number, emissive: number) => lambert({ color, emissive, emissiveIntensity: 0 });
  const fruit = {} as Record<FruitId, THREE.MeshPhongMaterial>;
  for (const id of FRUITS) fruit[id] = new THREE.MeshPhongMaterial({ color: FRUIT_COLORS[id], shininess: 70 });

  return {
    vc: lambert({ vertexColors: true }),
    leafRound: lambert({ map: leaves, color: 0x6cbb52 }),
    leafBlossom: lambert({ map: leaves, color: 0xf6b3cb }),
    leafPine: lambert({ map: leaves, color: 0x3b8a5e }),
    leafBush: lambert({ map: leaves, color: 0x5bae4a }),
    hedge: lambert({ map: hedgeLeaves, color: 0x4e9a44 }),
    lip: lambert({ color: 0x7dc35b }),
    tinted: lambert({ color: 0xffffff }),
    flowerCenter: lambert({ color: 0xf2c14e }),
    stem: lambert({ color: 0x5c9e4a }),
    fruit,
    window: lamp(0xffe3a3, 0xffb64d),
    bulb: lamp(0xfff6de, 0xffc864),
    globe: lamp(0xf7f9ff, 0xffe9b0),
    lantern: lamp(0xffe6a8, 0xffb84d),
    awning: lambert({ map: awningTexture() }),
    valance: lambert({ map: valanceTexture(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    thatch: lambert({ map: thatch, side: THREE.DoubleSide }),
    hutWall: lambert({ map: hut, side: THREE.DoubleSide }),
    brick: lambert({ map: brick }),
    deck: lambert({ map: deck }),
    snow: lambert({ color: 0xf4f8fb, side: THREE.DoubleSide }),
    water: lambert({ color: 0x6ec6f0 }),
  };
}

/** The materials that glow at night, with how strongly each one glows when fully on. */
export function lampMaterials(): [THREE.MeshLambertMaterial, number][] {
  const m = materials();
  return [
    [m.window, 1.1],
    [m.bulb, 1.3],
    [m.globe, 1.15],
    [m.lantern, 1.05],
  ];
}
