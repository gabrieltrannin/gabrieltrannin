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
import { buildTown } from './town';
import { VillagerAgents } from './villagerAgents';
import { GroundPainter } from './groundPainter';
import { buildIsland } from './island';
import { buildProps } from './props';
import { buildSea } from './sea';
import { heightAt } from './terrain';
import { buildVegetation } from './vegetation';
import { DecorLayer } from './decorLayer';
import { PLAYER_STALL } from '../data/rating';
import { TENTS } from '../data/village';
import { HOUSE_GROWTH } from '../data/house';
import type { HiddenItem } from '../core/types';
import type { FestivalId } from '../data/calendar';
import { MINE_CAVE, MINE_DOOR } from '../data/mine';

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
  /** The villagers walking around (stage 4). */
  villagers: VillagerAgents;
  /** Redraws what follows the game state (call after farm or world events). */
  syncState(state: Readonly<GameState>): void;
  /** Stage 5: decorations outside on the island. */
  decor: DecorLayer;
  /** The player's house grows outside too (side room, loft, cellar door). */
  setHomeLevel(level: number): void;
  /** Little mounds where the pet found something (only the ones it already sniffed out). */
  syncHidden(list: readonly HiddenItem[], revealed: ReadonlySet<number>): void;
  /** Stage 6: the market square dressed for a festival (or not). */
  setFestival(id: FestivalId | null): void;
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
  const town = buildTown(assets);
  const villagers = new VillagerAgents();
  const decor = new DecorLayer(assets, heightAt);
  root.add(buildIsland(painter.texture), sea.root, vegetation.root, farm.root, props.root, farmWorld.root, town.root, villagers.root, decor.root);

  // Stage 5: the player's market cart, the newcomers' tents, the house's new rooms, the pet's finds.
  const stall = assets.create('stall.player');
  stall.position.set(PLAYER_STALL.x, heightAt(PLAYER_STALL.x, PLAYER_STALL.z), PLAYER_STALL.z);
  stall.rotation.y = Math.PI;
  root.add(stall);
  const tents = new Map(TENTS.map(t => {
    const tent = assets.create('tent');
    tent.position.set(t.x, heightAt(t.x, t.z), t.z);
    tent.visible = false;
    root.add(tent);
    return [t.npc, tent] as const;
  }));
  const growth = HOUSE_GROWTH.map(g => {
    const o = assets.create(g.asset);
    o.position.set(HOUSE.x + g.dx, heightAt(HOUSE.x + g.dx, HOUSE.z + g.dz) + g.dy, HOUSE.z + g.dz);
    o.rotation.y = g.ry;
    o.visible = false;
    root.add(o);
    return { object: o, level: g.level };
  });
  const mounds = new Map<number, THREE.Object3D>();

  // Stage 6: the mine's cave in the west cliff, and the festival decorations of the square.
  const cave = assets.create('mine.cave');
  cave.position.set(MINE_CAVE[0], heightAt(MINE_DOOR[0], MINE_DOOR[1]), MINE_CAVE[1]);
  // The mouth faces south-west: toward the beach and toward the camera.
  cave.rotation.y = -Math.PI / 3;
  cave.scale.setScalar(1.15);
  root.add(cave);
  const FESTIVAL_SPOTS: readonly [number, number, number][] = [[6.2, 2.6, 0.6], [14.4, 2.6, -0.6], [6.8, 7.4, 0.3], [11.9, 7.4, -0.3]];
  const festivalDecor = new Map<FestivalId, THREE.Group>();
  for (const id of ['flowers', 'lanterns', 'harvest', 'snow'] as const) {
    const g = new THREE.Group();
    g.name = `festival.${id}`;
    for (const [x, z, ry] of FESTIVAL_SPOTS) {
      const o = assets.create(`festival.${id}`);
      o.position.set(x, heightAt(x, z), z);
      o.rotation.y = ry;
      g.add(o);
    }
    const stand = assets.create('festival.stand');
    stand.position.set(8.4, heightAt(8.4, 1.6), 1.6);
    g.add(stand);
    g.visible = false;
    root.add(g);
    festivalDecor.set(id, g);
  }

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
    town.setSeason(p);
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
    villagers,
    decor,
    setFestival(id) {
      for (const [key, g] of festivalDecor) g.visible = key === id;
    },
    setHomeLevel(level) {
      for (const g of growth) g.object.visible = level >= g.level;
    },
    syncHidden(list, revealed) {
      const keep = new Set<number>();
      for (const h of list) {
        if (!revealed.has(h.id)) continue;
        keep.add(h.id);
        if (mounds.has(h.id)) continue;
        const m = assets.create('dig.mound');
        m.position.set(h.x, heightAt(h.x, h.z), h.z);
        root.add(m);
        mounds.set(h.id, m);
      }
      for (const [id, m] of mounds) {
        if (keep.has(id)) continue;
        root.remove(m);
        mounds.delete(id);
      }
    },
    syncState(state) {
      farmWorld.sync(state);
      town.sync(state);
      decor.sync(state.decor);
      for (const [npc, tent] of tents) tent.visible = state.arrived.includes(npc as never);
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
      villagers.update(dt, elapsed);
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
