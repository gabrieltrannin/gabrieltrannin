import * as THREE from 'three';
import { repaintStallSigns } from '../assets/procedural';
import type { AssetRegistry } from '../assets/registry';
import type { SeasonId } from '../data/calendar';
import type { FruitId } from '../data/defaults';
import { HOUSE, HOUSE_CHIMNEY } from '../data/map';
import { SEASON_PALETTES } from '../data/seasonPalettes';
import { materials } from '../render/materials';
import { buildFarmDecor } from './farmDecor';
import { GroundPainter } from './groundPainter';
import { buildIsland } from './island';
import { buildProps } from './props';
import { buildSea } from './sea';
import { heightAt } from './terrain';
import { buildVegetation } from './vegetation';
import { buildWalker, type Walker } from './walker';

export interface WorldOptions {
  season: SeasonId;
  nativeFruit: FruitId;
  maxAnisotropy: number;
}

export interface World {
  root: THREE.Group;
  sea: ReturnType<typeof buildSea>;
  walker: Walker;
  setSeason(season: SeasonId): void;
  /** Repaints signs once the web fonts are ready. */
  repaintSigns(): void;
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
  const walker = buildWalker(assets);
  root.add(buildIsland(painter.texture), sea.root, vegetation.root, farm.root, props.root, walker.object);

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
    farm.applySeason(season);
  };
  setSeason(opts.season);

  return {
    root,
    sea,
    walker,
    setSeason,
    repaintSigns() {
      farm.repaintSigns();
      repaintStallSigns();
    },
    update(dt, elapsed, reducedMotion) {
      sea.update(elapsed, reducedMotion);
      walker.update(dt, elapsed);
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
