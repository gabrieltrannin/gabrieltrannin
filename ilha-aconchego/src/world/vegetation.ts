import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import type { FruitId } from '../data/defaults';
import { BLOSSOM_TREES, BUSHES, FLOWER_COLORS, FLOWER_PATCHES, grassPatchOf, ORCHARD, PALMS, PINES, ROCKS, ROUND_TREES, TALL_GRASS, UPPER_FLOWER_ROW } from '../data/map';
import type { SeasonPalette } from '../data/seasonPalettes';
import { instantiate, setInstancePlacement, setInstanceVisible, type Placement } from '../render/instancing';
import { seededRandom } from '../render/textures';
import { heightAt } from './terrain';

export interface Vegetation {
  root: THREE.Group;
  applySeason(palette: SeasonPalette): void;
  /** Shows or hides the fruit of one orchard tree (shaken trees are bare until the next day). */
  setOrchardFruit(index: number, visible: boolean): void;
  /** Makes one orchard tree wobble for a moment. */
  shakeOrchardTree(index: number): void;
  /** Hides the tall grass of the patches that were cut. */
  setGrassCut(cut: ReadonlySet<number>): void;
  update(dt: number): void;
}

const at = (x: number, z: number, extra: Partial<Placement> = {}): Placement => ({ x, y: heightAt(x, z), z, ...extra });

/** Trees, bushes, rocks, flowers and tall grass, each kind drawn with instancing. */
export function buildVegetation(assets: AssetRegistry, nativeFruit: FruitId): Vegetation {
  const root = new THREE.Group();
  root.name = 'vegetation';
  const rnd = seededRandom(29);

  const orchardPlacements = ORCHARD.map(([x, z, s]) => at(x, z, { s }));
  const orchard = instantiate(assets.create(`tree.${nativeFruit}`), orchardPlacements);
  const shaking = new Map<number, number>();
  root.add(
    orchard,
    instantiate(assets.create('tree.round'), ROUND_TREES.map(([x, z, s]) => at(x, z, { s, ry: rnd() * 6 }))),
    instantiate(assets.create('tree.blossom'), BLOSSOM_TREES.map(([x, z, s]) => at(x, z, { s, ry: rnd() * 6 }))),
    instantiate(assets.create('tree.pine'), PINES.map(([x, z, s]) => at(x, z, { s, ry: rnd() * 6 }))),
    // Palms lean along +x; the rotation points the lean.
    instantiate(assets.create('tree.palm'), PALMS.map(([x, z, s, lean]) => at(x, z, { s, ry: -lean }))),
    instantiate(assets.create('bush.flower'), BUSHES.map(([x, z]) => at(x, z, { ry: rnd() * 6 }))),
    instantiate(assets.create('rock'), ROCKS.map(([x, z, s]) => at(x, z, { s, ry: x }))),
  );

  // Flowers: the ones that survive into autumn come first, so a season can show the first N.
  const flowers: { x: number; z: number; color: string; autumn: boolean }[] = [];
  for (const [cx, cz, count, radius, colors] of FLOWER_PATCHES) {
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * radius;
      const palette = colors ?? FLOWER_COLORS;
      flowers.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, color: palette[Math.floor(rnd() * palette.length)]!, autumn: rnd() < 0.4 });
    }
  }
  for (let x = UPPER_FLOWER_ROW.x0; x < UPPER_FLOWER_ROW.x1; x += UPPER_FLOWER_ROW.step) {
    flowers.push({ x: x + (rnd() - 0.5) * 0.2, z: UPPER_FLOWER_ROW.z + (rnd() - 0.5) * 0.25, color: rnd() < 0.7 ? '#FFFFFF' : '#FFE680', autumn: rnd() < 0.4 });
  }
  flowers.sort((a, b) => Number(b.autumn) - Number(a.autumn));
  const autumnCount = flowers.filter(f => f.autumn).length;
  const flowerGroup = instantiate(assets.create('flower'), flowers.map(f => at(f.x, f.z, { ry: rnd() * 3 })));
  const flowerMeshes = flowerGroup.children as THREE.InstancedMesh[];
  const petals = flowerMeshes.find(m => m.name === 'petals');
  const color = new THREE.Color();
  flowers.forEach((f, i) => petals?.setColorAt(i, color.set(f.color)));
  root.add(flowerGroup);

  // Tall grass: a field of clumps, tinted per clump.
  const tuftSpots: Placement[] = [];
  for (let x = TALL_GRASS.x0; x <= TALL_GRASS.x1; x += TALL_GRASS.spacing) {
    for (let z = TALL_GRASS.z0; z <= TALL_GRASS.z1; z += TALL_GRASS.spacing) {
      tuftSpots.push(at(x + (rnd() - 0.5) * 0.2, z + (rnd() - 0.5) * 0.2, { sy: 0.9 + rnd() * 0.4, ry: rnd() * 6 }));
    }
  }
  const tuftGroup = instantiate(assets.create('grass.tuft'), tuftSpots);
  const tufts = tuftGroup.children as THREE.InstancedMesh[];
  root.add(tuftGroup);

  return {
    root,
    setOrchardFruit(index, visible) {
      setInstanceVisible(orchard, index, 'fruit', visible);
    },
    shakeOrchardTree(index) {
      shaking.set(index, 0.7);
    },
    setGrassCut(cut) {
      tuftSpots.forEach((spot, i) => {
        const visible = !cut.has(grassPatchOf(spot.x, spot.z));
        for (const m of tufts) if (m.name) setInstanceVisible(tuftGroup, i, m.name, visible);
      });
    },
    update(dt) {
      for (const [index, left] of shaking) {
        const t = Math.max(0, left - dt);
        const base = orchardPlacements[index]!;
        setInstancePlacement(orchard, index, { ...base, ry: Math.sin(t * 40) * 0.08 * (t / 0.7) });
        if (t <= 0) shaking.delete(index);
        else shaking.set(index, t);
      }
    },
    applySeason(p) {
      const shown = p.flowers >= 1 ? flowers.length : p.flowers > 0 ? autumnCount : 0;
      for (const m of flowerMeshes) {
        m.count = shown;
        m.visible = shown > 0;
      }
      const tint = seededRandom(77);
      for (const m of tufts) {
        for (let i = 0; i < tuftSpots.length; i++) m.setColorAt(i, color.setHex(p.tallGrass[Math.floor(tint() * p.tallGrass.length)]!));
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    },
  };
}
