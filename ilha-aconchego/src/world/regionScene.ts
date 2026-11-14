import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { regionGround } from '../core/explore';
import type { GameState, PuzzleState } from '../core/types';
import { REGIONS, type RegionDef, type RegionId, type Shape } from '../data/regions';
import type { Collider } from './collision';
import { CreatureLayer } from './creatures';

const WALL_ASSET: Record<RegionId, [string, string]> = {
  beach: ['wall.rock', 'wall.rock'],
  forest: ['wall.bramble', 'wall.bramble'],
  volcano: ['wall.crater', 'wall.steam'],
  clouds: ['region.cloudPuff', 'region.cloudPuff'],
};
const GRASS_ASSET: Record<RegionId, string> = { beach: 'region.tallGrass', forest: 'region.tallGrass', volcano: 'region.ashGrass', clouds: 'region.cloudGrass' };
const BLOCK_ASSET: Record<RegionId, string> = { beach: 'puzzle.blockSand', forest: 'puzzle.blockSand', volcano: 'puzzle.blockBasalt', clouds: 'puzzle.blockSand' };
const PLATE_ASSET: Record<RegionId, string> = { beach: 'puzzle.plateShell', forest: 'puzzle.plateShell', volcano: 'puzzle.plateVent', clouds: 'puzzle.plateShell' };
const SWITCH_SCALE = [0.7, 0.9, 1.15];

/** The land of a region: flat tops at height 0 with a side going down, from its shapes. */
function landMesh(s: Shape, look: RegionDef['look']): THREE.Mesh {
  const depth = 0.8;
  let geo: THREE.BufferGeometry;
  if (s.kind === 'circle') {
    geo = new THREE.CylinderGeometry(s.r, s.r * 0.86, depth, 40).translate(s.x, -depth / 2, s.z);
  } else {
    const shape = new THREE.Shape();
    const { x0, z0, x1, z1 } = s;
    const r = Math.min(s.r, (x1 - x0) / 2, (z1 - z0) / 2);
    shape.moveTo(x0 + r, z0);
    shape.lineTo(x1 - r, z0);
    shape.quadraticCurveTo(x1, z0, x1, z0 + r);
    shape.lineTo(x1, z1 - r);
    shape.quadraticCurveTo(x1, z1, x1 - r, z1);
    shape.lineTo(x0 + r, z1);
    shape.quadraticCurveTo(x0, z1, x0, z1 - r);
    shape.lineTo(x0, z0 + r);
    shape.quadraticCurveTo(x0, z0, x0 + r, z0);
    geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
    // The shape is drawn in x/y; turn it so y becomes z and the extrusion goes down.
    geo.rotateX(Math.PI / 2);
  }
  const mats = [new THREE.MeshLambertMaterial({ color: look.ground }), new THREE.MeshLambertMaterial({ color: look.side })];
  const mesh = new THREE.Mesh(geo, s.kind === 'circle' ? [mats[1]!, mats[0]!, mats[1]!] : [mats[0]!, mats[1]!]);
  mesh.receiveShadow = true;
  return mesh;
}

export interface RegionView {
  scene: THREE.Scene;
  creatures: CreatureLayer;
  ground(x: number, z: number): number | null;
  colliders(state: Readonly<GameState>): Collider[];
  sync(state: Readonly<GameState>, chests: readonly string[]): void;
  update(dt: number, elapsed: number): void;
}

/**
 * Stage 6: builds one region as its own scene: sky and fog, the sea (or lava, or open sky), the land,
 * scenery, walls and the puzzle's gate, things to pick up, tall grass, rocks, wind pads, the boat at
 * the pier and the cute creatures. `sync` keeps it in step with the game state.
 */
export function buildRegion(assets: AssetRegistry, id: RegionId): RegionView {
  const def = REGIONS[id];
  const look = def.look;
  const scene = new THREE.Scene();
  scene.name = `region.${id}`;
  scene.background = new THREE.Color(look.sky);
  scene.fog = new THREE.Fog(look.fog, 28, 75);
  const hemi = new THREE.HemisphereLight(look.light, look.side, 1.35);
  const sun = new THREE.DirectionalLight(look.light, 1.6);
  sun.position.set(6, 22, 26);
  sun.target.position.set(16, 0, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun, sun.target);

  // Sea, lava or the sky below the clouds.
  const below = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: look.water, emissive: look.lava ? look.water : 0x000000, emissiveIntensity: look.lava ? 0.55 : 0, transparent: id === 'clouds', opacity: id === 'clouds' ? 0.6 : 1 }),
  );
  below.position.set(16, id === 'clouds' ? -6 : -0.45, 12);
  scene.add(below);

  for (const s of def.land) scene.add(landMesh(s, look));

  const place = (asset: string, x: number, z: number, ry = 0, scale = 1) => {
    const o = assets.create(asset);
    o.position.set(x, 0, z);
    o.rotation.y = ry;
    o.scale.setScalar(scale);
    o.traverse(m => {
      if (m instanceof THREE.Mesh) {
        m.castShadow = m.name !== 'glow';
        m.receiveShadow = true;
      }
    });
    scene.add(o);
    return o;
  };
  for (const p of def.props) place(p.asset, p.at[0], p.at[1], p.ry ?? 0, p.scale ?? 1);
  // The pier and the boat home.
  place('region.pier', def.boat[0], 21.1);
  const boat = place('boat', def.boat[0] - 1.1, def.boat[1] + 0.2, Math.PI / 2);
  const boatY = id === 'clouds' ? -0.1 : -0.25;
  boat.position.y = boatY;

  // Walls along their segments; the gate part disappears when the puzzle is solved.
  const gates: THREE.Object3D[] = [];
  const [wallAsset, gateAsset] = WALL_ASSET[id];
  for (const w of def.walls) {
    const len = Math.max(w.x1 - w.x0, w.z1 - w.z0);
    const n = Math.max(1, Math.round(len / 0.75));
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const along = w.x1 - w.x0 > w.z1 - w.z0;
      const x = along ? w.x0 + (w.x1 - w.x0) * f : (w.x0 + w.x1) / 2;
      const z = along ? (w.z0 + w.z1) / 2 : w.z0 + (w.z1 - w.z0) * f;
      const o = place(w.gate ? gateAsset : wallAsset, x, z, i * 1.7, 0.95 + (i % 3) * 0.08);
      if (w.gate) gates.push(o);
    }
  }

  // Things to pick up, tall grass, rocks, the puzzle.
  const forage = def.forage.map(f => place(id === 'forest' && f.loot[0]![0] === 'fruit.blackberry' ? 'region.berryBush' : `forage.${id}`, f.at[0], f.at[1]));
  const grass = def.grass.map(([x, z], i) => place(GRASS_ASSET[id], x, z, i));
  const nodes = def.nodes.map((n, i) => place('region.oreRock', n.at[0], n.at[1], i * 2));
  const puzzle = def.puzzle;
  const blocks = puzzle.kind === 'push' ? puzzle.blocks.map(() => place(BLOCK_ASSET[id], 0, 0)) : [];
  if (puzzle.kind === 'push') for (const [x, z] of puzzle.plates) place(PLATE_ASSET[id], x + 0.5, z + 0.5);
  const switches = puzzle.kind === 'switches' ? puzzle.switches.map(([x, z], i) => place('puzzle.switch', x, z, 0, SWITCH_SCALE[puzzle.sizes[i]!] ?? 1)) : [];
  const bells = puzzle.kind === 'bells' ? puzzle.bells.map(([x, z]) => place('puzzle.bell', x, z)) : [];
  const chest = place('puzzle.chest', puzzle.chest[0], puzzle.chest[1]);
  const chestOpen = place('puzzle.chestOpen', puzzle.chest[0], puzzle.chest[1]);
  chestOpen.visible = false;

  // Wind currents: pads at both ends and a trail of little puffs that drifts along.
  const lanes = def.winds.map(w => {
    place('region.windPad', w.a[0], w.a[1]);
    place('region.windPad', w.b[0], w.b[1]);
    const puffs = Array.from({ length: 6 }, () => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
      scene.add(m);
      return m;
    });
    return { w, puffs };
  });

  const creatures = new CreatureLayer(assets);
  creatures.setSpawns(def.creatures.map((c, i) => ({ id: `${id}:${i}`, kind: c.kind, at: c.at })), (x, z) => regionGround(id, x, z));
  scene.add(creatures.root);

  let puzzleState: PuzzleState | null = null;

  return {
    scene,
    creatures,
    ground: (x, z) => regionGround(id, x, z),
    colliders(state) {
      const solved = state.explore.puzzles[id]?.solved ?? false;
      const list: Collider[] = [];
      for (const p of def.props) if (p.r) list.push({ kind: 'circle', x: p.at[0], z: p.at[1], r: p.r });
      for (const w of def.walls) if (!w.gate || !solved) list.push({ kind: 'box', x0: w.x0, z0: w.z0, x1: w.x1, z1: w.z1 });
      def.nodes.forEach((n, i) => {
        if (!state.explore.taken.includes(`node:${id}:${i}`)) list.push({ kind: 'circle', x: n.at[0], z: n.at[1], r: 0.55 });
      });
      for (const [x, z] of state.explore.puzzles[id]?.blocks ?? (puzzle.kind === 'push' ? puzzle.blocks : [])) list.push({ kind: 'box', x0: x + 0.06, z0: z + 0.06, x1: x + 0.94, z1: z + 0.94 });
      for (const [x, z] of puzzle.kind === 'switches' ? puzzle.switches : puzzle.kind === 'bells' ? puzzle.bells : []) list.push({ kind: 'circle', x, z, r: 0.3 });
      list.push({ kind: 'circle', x: puzzle.chest[0], z: puzzle.chest[1], r: 0.4 });
      return list;
    },
    sync(state, chests) {
      def.forage.forEach((_, i) => (forage[i]!.visible = !state.explore.taken.includes(`forage:${id}:${i}`)));
      def.grass.forEach((_, i) => grass[i]!.scale.set(1, state.explore.taken.includes(`grass:${id}:${i}`) ? 0.45 : 1, 1));
      def.nodes.forEach((_, i) => (nodes[i]!.visible = !state.explore.taken.includes(`node:${id}:${i}`)));
      puzzleState = state.explore.puzzles[id] ?? null;
      const solved = puzzleState?.solved ?? false;
      for (const g of gates) g.visible = !solved;
      if (puzzle.kind === 'push') {
        const cells = puzzleState?.blocks ?? puzzle.blocks;
        blocks.forEach((b, i) => b.position.set(cells[i]![0] + 0.5, 0, cells[i]![1] + 0.5));
      }
      switches.forEach((s, i) => (s.scale.y = (SWITCH_SCALE[puzzle.kind === 'switches' ? puzzle.sizes[i]! : 1] ?? 1) * (puzzleState?.pressed.includes(i) || solved ? 0.6 : 1)));
      const opened = chests.includes(id);
      chest.visible = !opened;
      chestOpen.visible = opened;
      creatures.sync(state.explore.calmed, state.options.peaceful);
    },
    update(dt, elapsed) {
      boat.position.y = boatY + Math.sin(elapsed * 1.3) * 0.05;
      boat.rotation.z = Math.sin(elapsed * 1.1) * 0.03;
      if (look.lava) (below.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.5 + Math.sin(elapsed * 1.5) * 0.12;
      bells.forEach((b, i) => (b.rotation.z = puzzleState?.pressed.includes(i) ? Math.sin(elapsed * 6) * 0.05 : 0));
      const solved = puzzleState?.solved ?? false;
      for (const { w, puffs } of lanes) {
        const on = !w.needs || solved;
        puffs.forEach((m, i) => {
          m.visible = on;
          if (!on) return;
          const f = (elapsed * 0.35 + i / puffs.length) % 1;
          m.position.set(w.a[0] + (w.b[0] - w.a[0]) * f, 0.6 + Math.sin(f * Math.PI) * 1.4, w.a[1] + (w.b[1] - w.a[1]) * f);
        });
      }
      void dt;
    },
  };
}
