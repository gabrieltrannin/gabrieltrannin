import { describe, expect, it } from 'vitest';
import { CROPS } from '../../data/crops';
import { PROPS, STALLS } from '../../data/map';
import { AssetRegistry } from '../registry';
import { REQUIRED_ELEMENTS, registerProceduralAssets } from './index';

const registry = new AssetRegistry();
registerProceduralAssets(registry);

describe('procedural assets', () => {
  it('registers every element the design document requires', () => {
    const missing = Object.entries(REQUIRED_ELEMENTS).flatMap(([element, names]) => names.filter(n => !registry.has(n)).map(n => `${element}: ${n}`));
    expect(missing).toEqual([]);
  });

  it('has an asset for every prop, stall and crop the map uses', () => {
    const used = [...PROPS.map(p => p.asset), ...STALLS.map(s => s.asset), ...CROPS.map(c => `crop.${c}`), 'lamp.globe', 'hedge.block', 'lantern.ground', 'light.pole', 'light.bulb', 'flower', 'grass.tuft', 'rock', 'pet.bunny'];
    expect(used.filter(n => !registry.has(n))).toEqual([]);
  });
});
