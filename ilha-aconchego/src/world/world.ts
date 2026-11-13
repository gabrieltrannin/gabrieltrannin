import * as THREE from 'three';
import { repaintStallSigns } from '../assets/procedural';
import type { AssetRegistry } from '../assets/registry';
import type { SeasonId } from '../data/calendar';
import type { FruitId } from '../data/defaults';
import { HOUSE, HOUSE_CHIMNEY } from '../data/map';
import { SEASON_PALETTES } from '../data/seasonPalettes';
import { materials } from '../render/materials';
import { BEDS, FARM_TILES } from '../data/map';
import type { FarmCropId } from '../data/crops';
import type { GameState } from '../core/types';
import { buildFarmDecor } from './farmDecor';
import { buildFarmWorld, type FarmWorld } from './farmWorld';
import { GroundPainter } from './groundPainter';
import { buildIsland } from './island';
import { buildProps } from './props';
import { buildSea } from './sea';
import { heightAt } from './terrain';
import { buildVegetation } from './vegetation';

export interface WorldOptions {
  season: SeasonId;
  nativeFruit: FruitId;
  maxAnisotropy: number;
}

export interface World {
  root: THREE.Group;
  sea: ReturnType<typeof buildSea>;
  setSeason(season: SeasonId): void;
  setOrchardFruit(index: number, visible: boolean): void;
  shakeOrchardTree(index: number): void;
  /** Repaints signs once the web fonts are ready. */
  repaintSigns(): void;
  /** Farm, animals, machines, rocks and the rest that follow the game state. */
  farm: FarmWorld;
  /** Redraws what follows the game state (call after farm or world events). */
  syncState(state: Readonly<GameState>): void;
  update(dt: number, elapsed: number, reducedMotion: boolean): void;
}

/** Builds the whole starting island from the map data and the asset registry. */
export function buildWorld(assets: AssetRegistry, opts: WorldOptions): World {
  const root = new THREE.Group();
  root.name = 'world';
  const painter = new GroundPainter(opts.maxAnisotropy);
  const sea = buildSea();
  const vegetation = buildVegetation(assets, opts.nativeFruit);
  const farm = buildFarmDecor(assets);
  const props = buildProps(assets);
  const farmWorld = buildFarmWorld(assets);
  root.add(buildIsland(painter.texture), sea.root, vegetation.root, farm.root, props.root, farmWorld.root);

  // Season visibility by mesh name, so glTF models can follow the same rule.
  const onlyIn: Record<string, THREE.Object3D[]> = { 'only:winter': [], 'only:autumn': [], 'only:warm': [], fruit: [] };
  root.traverse(o => onlyIn[o.name]?.push(o));

  // Chimney smoke.
  const chimney = new THREE.Vector3(HOUSE.x + HOUSE_CHIMNEY.x, heightAt(HOUSE.x, HOUSE.z) + HOUSE_CHIMNEY.y, HOUSE.z + HOUSE_CHIMNEY.z);
  const puffGeometry = new THREE.SphereGeometry(1, 10, 8);
  const puffs = Array.from({ length: 5 }, (_, i) => {
    const mesh = new THREE.Mesh(puffGeometry, new THREE.MeshLambertMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.8, depthWrite: false }));
    root.add(mesh);
    return { mesh, offset: i / 5 };
  });

  const boatBase = props.boat?.position.y ?? 0;

  const setSeason = (season: SeasonId) => {
    const p = SEASON_PALETTES[season];
    painter.paint(p);
    const m = materials();
    m.lip.color.setHex(p.lip);
    m.leafRound.color.setHex(p.leaf);
    m.leafBlossom.color.setHex(season === 'spring' ? p.blossom : p.leaf);
    m.leafPine.color.setHex(p.pine);
    m.leafBush.color.setHex(p.bush);
    m.hedge.color.setHex(p.hedge);
    for (const o of onlyIn['only:winter']!) o.visible = season === 'winter';
    for (const o of onlyIn['only:autumn']!) o.visible = season === 'autumn';
    for (const o of onlyIn['only:warm']!) o.visible = season === 'spring' || season === 'summer';
    for (const o of onlyIn.fruit!) o.visible = p.fruitOnTrees;
    vegetation.applySeason(p);
  };
  setSeason(opts.season);

  return {
    root,
    sea,
    setSeason,
    setOrchardFruit: vegetation.setOrchardFruit,
    shakeOrchardTree: vegetation.shakeOrchardTree,
    repaintSigns() {
      farm.repaintSigns();
      repaintStallSigns();
    },
    farm: farmWorld,
    syncState(state) {
      farmWorld.sync(state);
      vegetation.setGrassCut(new Set(Object.keys(state.grass).map(Number)));
      // Each sign shows the crop planted most in its bed.
      const signs: Record<string, FarmCropId | null> = {};
      for (const bed of BEDS) {
        const counts = new Map<FarmCropId, number>();
        for (const t of FARM_TILES) {
          const crop = t.bed === bed.id ? state.plots[t.id]?.crop : null;
          if (crop) counts.set(crop, (counts.get(crop) ?? 0) + 1);
        }
        signs[bed.id] = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      }
      farm.setSignCrops(signs);
    },
    update(dt, elapsed, reducedMotion) {
      sea.update(elapsed, reducedMotion);
      vegetation.update(dt);
      farmWorld.update(dt, elapsed, reducedMotion);
      if (!reducedMotion) for (const b of props.blades) b.rotation.z = elapsed * 0.8;
      if (props.boat) {
        props.boat.position.y = boatBase + Math.sin(elapsed * 1.3) * 0.06;
        props.boat.rotation.z = Math.sin(elapsed * 1.1) * 0.03;
      }
      for (const p of puffs) {
        const f = (elapsed * 0.18 + p.offset) % 1;
        p.mesh.position.set(chimney.x + f * 0.8, chimney.y + f * 3, chimney.z + Math.sin(f * 6 + p.offset * 9) * 0.2);
        p.mesh.scale.setScalar(0.2 + f * 0.45);
        (p.mesh.material as THREE.MeshLambertMaterial).opacity = 0.7 * (1 - f);
      }
    },
  };
}
