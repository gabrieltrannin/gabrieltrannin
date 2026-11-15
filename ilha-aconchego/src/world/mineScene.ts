import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { mineFloor, mineGround, type MineFloor } from '../core/explore';
import type { GameState } from '../core/types';
import { isElevatorFloor, MINE_D, MINE_START, MINE_W } from '../data/mine';
import { instantiate } from '../render/instancing';
import type { Collider } from './collision';
import { CreatureLayer } from './creatures';

export interface MineView {
  scene: THREE.Scene;
  floor: MineFloor;
  creatures: CreatureLayer;
  ground(x: number, z: number): number | null;
  colliders(state: Readonly<GameState>): Collider[];
  sync(state: Readonly<GameState>, chests: readonly string[]): void;
  /** A warm light that follows the player. */
  lantern: THREE.PointLight;
}

/** Floors get darker and cooler as you go down. */
function floorColors(floor: number): { ground: number; fog: number } {
  if (floor < 10) return { ground: 0x9a8070, fog: 0x2b211c };
  if (floor < 20) return { ground: 0x7b7d8e, fog: 0x1f2130 };
  return { ground: 0x75698c, fog: 0x1e1828 };
}

/**
 * Stage 6: one floor of the mine as its own scene: rock walls (drawn together), rocks to break, the
 * ladder down once its rock is broken, the rope back up and, every 5 floors, the elevator.
 */
export function buildMineFloor(assets: AssetRegistry, seed: number, floor: number, day: number): MineView {
  const f = mineFloor(seed, floor, day);
  const colors = floorColors(floor);
  const scene = new THREE.Scene();
  scene.name = `mine.${floor}`;
  scene.background = new THREE.Color(colors.fog);
  scene.fog = new THREE.Fog(colors.fog, 14, 40);
  scene.add(new THREE.HemisphereLight(0xffe8d0, 0x3a2e24, 1.35));
  const key = new THREE.DirectionalLight(0xffd9b0, 0.95);
  key.position.set(4, 14, 14);
  key.target.position.set(MINE_W / 2, 0, MINE_D / 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
  scene.add(key, key.target);
  const lantern = new THREE.PointLight(0xffc98a, 2.2, 8, 1.3);
  scene.add(lantern);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MINE_W, MINE_D).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: colors.ground }));
  ground.position.set(MINE_W / 2, 0, MINE_D / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  // The wall nearest the camera is drawn low (like the front of a doll house), so it hides nothing.
  const walls: { x: number; y: number; z: number; ry: number }[] = [];
  const front: { x: number; y: number; z: number; ry: number }[] = [];
  for (let z = 0; z < MINE_D; z++) for (let x = 0; x < MINE_W; x++) if (f.walls[z * MINE_W + x]) (z === MINE_D - 1 ? front : walls).push({ x: x + 0.5, y: 0, z: z + 0.5, ry: ((x * 7 + z * 3) % 4) * (Math.PI / 2) });
  scene.add(instantiate(assets.create('mine.wall'), walls), instantiate(assets.create('mine.wallLow'), front));

  const place = (asset: string, x: number, z: number, ry = 0) => {
    const o = assets.create(asset);
    o.position.set(x, 0, z);
    o.rotation.y = ry;
    o.traverse(m => {
      if (m instanceof THREE.Mesh) m.castShadow = m.name !== 'glow';
    });
    scene.add(o);
    return o;
  };
  const rocks = f.rocks.map((r, i) => place(r.crystal ? 'mine.crystalRock' : 'mine.rock', r.x + 0.5, r.z + 0.5, i));
  const ladderRock = f.rocks[f.ladder];
  const ladder = ladderRock ? place('mine.ladder', ladderRock.x + 0.5, ladderRock.z + 0.5) : null;
  if (ladder) ladder.visible = false;
  place('mine.rope', MINE_START[0] - 1.2, MINE_START[1] + 0.7);
  if (isElevatorFloor(floor)) place('mine.elevator', MINE_START[0] + 1.1, MINE_START[1] + 0.9);
  for (const [x, z] of [[1.2, 1.2], [MINE_W - 1.3, 1.2], [MINE_W - 1.3, MINE_D - 1.3], [6, 1.2]] as const) place('mine.torch', x, z);
  const treasure = f.treasure ? place('mine.treasure', f.treasure[0] + 0.5, f.treasure[1] + 0.5) : null;

  const creatures = new CreatureLayer(assets);
  creatures.setSpawns(f.creatures.map((c, i) => ({ id: `mine:${floor}:${i}`, kind: 'dust' as const, at: [c[0] + 0.5, c[1] + 0.5] as const })), (x, z) => mineGround(f, x, z));
  scene.add(creatures.root);

  const broken = (state: Readonly<GameState>) => state.explore.mine[String(floor)] ?? [];
  return {
    scene,
    floor: f,
    creatures,
    lantern,
    ground: (x, z) => mineGround(f, x, z),
    colliders(state) {
      const done = broken(state);
      const list: Collider[] = f.rocks.flatMap((r, i) => (done.includes(i) ? [] : [{ kind: 'circle', x: r.x + 0.5, z: r.z + 0.5, r: 0.42 } as Collider]));
      list.push({ kind: 'circle', x: MINE_START[0] - 1.2, z: MINE_START[1] + 0.7, r: 0.3 });
      if (isElevatorFloor(floor)) list.push({ kind: 'box', x0: MINE_START[0] + 0.5, z0: MINE_START[1] + 0.3, x1: MINE_START[0] + 1.7, z1: MINE_START[1] + 1.5 });
      if (f.treasure) list.push({ kind: 'circle', x: f.treasure[0] + 0.5, z: f.treasure[1] + 0.5, r: 0.45 });
      return list;
    },
    sync(state, chests) {
      const done = broken(state);
      rocks.forEach((r, i) => (r.visible = !done.includes(i)));
      if (ladder) ladder.visible = done.includes(f.ladder);
      if (treasure) treasure.visible = !chests.includes('mine');
      creatures.sync(state.explore.calmed, state.options.peaceful);
    },
  };
}
