/**
 * Space each asset takes on the ground, for collision. Circles for round things, boxes (width along x,
 * depth along z, before rotation) for the rest. A glTF model replacing an asset keeps this footprint.
 */
export type Footprint = { r: number } | { w: number; d: number; dz?: number };

export const FOOTPRINTS: Record<string, Footprint> = {
  'house.hut': { r: 2.25 },
  mailbox: { r: 0.3 },
  barrel: { r: 0.38 },
  sack: { r: 0.32 },
  'pump.water': { r: 0.42 },
  wheelbarrow: { w: 1.6, d: 0.7 },
  scarecrow: { r: 0.3 },
  bench: { w: 1.65, d: 0.5 },
  'crate.orange': { w: 0.65, d: 0.5 },
  'crate.apple': { w: 0.65, d: 0.5 },
  'table.cafe': { r: 1.2 },
  'plant.potted': { r: 0.42 },
  silo: { r: 1.2 },
  windmill: { r: 0.75 },
  beehive: { w: 0.8, d: 0.7 },
  snowman: { r: 0.6 },
  'pumpkin.deco': { r: 0.45 },
  // Stall: counter in front, shelves behind; the origin is near the front of the counter.
  'stall.bread': { w: 2.64, d: 1.98, dz: -0.15 },
  'stall.honey': { w: 2.64, d: 1.98, dz: -0.15 },
  'stall.flowers': { w: 2.64, d: 1.98, dz: -0.15 },
  'lamp.globe': { r: 0.2 },
  'lantern.ground': { r: 0.18 },
  'light.pole': { r: 0.08 },
  'sign.crop': { w: 0.96, d: 0.16 },
  'fence.log': { r: 0.15 },
  /** Per unit of scale. */
  'tree.round': { r: 0.42 },
  'tree.fruit': { r: 0.42 },
  'tree.pine': { r: 0.5 },
  'tree.palm': { r: 0.35 },
  'bush.flower': { r: 0.72 },
  rock: { r: 0.9 },
};
