import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { box, cyl, group, meshOf, merge, vcMesh } from '../assets/procedural/parts';
import { floorShape, stairsOn, STAIRS_DEPTH, type FloorId } from '../data/house';
import { materials } from '../render/materials';
import type { PlacedDecor } from '../core/types';
import { DecorLayer } from './decorLayer';

/**
 * Stage 5: the inside of the house, its own little scene (docs/GAME_DESIGN.md, "O interior da casa é uma
 * cena própria"). One floor is shown at a time, cut open like a dollhouse: the back wall is tall, the side
 * walls are low and the front wall is left out so the camera sees in. Coordinates match the game state.
 */

const LOOK: Record<FloorId, { wall: number; trim: number; floor: [number, number]; base: number }> = {
  ground: { wall: 0xf3e6cf, trim: 0xd9b98f, floor: [0xc69058, 0xb98552], base: 0x9c6b3e },
  upper: { wall: 0xf6dfe3, trim: 0xe7b7c2, floor: [0xd4a373, 0xc99766], base: 0xa8743f },
  basement: { wall: 0xb8b2a6, trim: 0x9c968b, floor: [0x8e8a82, 0x9a968e], base: 0x6e6a62 },
};
const WALL_H = 2.8;
const SIDE_H = 1.0;

export class Interior {
  readonly scene = new THREE.Scene();
  readonly decor: DecorLayer;
  private room = new THREE.Group();
  private readonly sun: THREE.DirectionalLight;
  private readonly glow: THREE.PointLight;
  private readonly hemi: THREE.HemisphereLight;
  floor: FloorId = 'ground';
  level = -1;
  private shape = { w: 7, d: 6 };

  constructor(assets: AssetRegistry) {
    this.scene.name = 'interior';
    this.scene.background = new THREE.Color(0x2e2622);
    this.hemi = new THREE.HemisphereLight(0xfff4e0, 0x6b5340, 1.35);
    this.sun = new THREE.DirectionalLight(0xffe2b8, 1.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0008;
    this.glow = new THREE.PointLight(0xffc887, 0, 14, 1.6);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.glow, this.room);
    this.decor = new DecorLayer(assets, () => 0);
    this.scene.add(this.decor.root);
  }

  /** Rebuilds the room for a floor of a house of `level`. */
  build(level: number, floor: FloorId): void {
    if (level === this.level && floor === this.floor) return;
    this.level = level;
    this.floor = floor;
    const shape = floorShape(level, floor) ?? { w: 7, d: 6 };
    this.shape = shape;
    this.scene.remove(this.room);
    this.room.traverse(o => {
      if (o instanceof THREE.Mesh && o.geometry) o.geometry.dispose();
    });
    this.room = this.buildRoom(level, floor, shape.w, shape.d);
    this.scene.add(this.room);
    const cx = shape.w / 2, cz = shape.d / 2;
    this.sun.position.set(cx - 4, 9, cz + 6);
    this.sun.target.position.set(cx, 0, cz);
    const cam = this.sun.shadow.camera;
    cam.left = -9;
    cam.right = 9;
    cam.top = 9;
    cam.bottom = -9;
    cam.updateProjectionMatrix();
    this.glow.position.set(cx, 2.3, cz);
  }

  syncDecor(list: readonly PlacedDecor[]): void {
    this.decor.sync(list);
  }

  /** Where a character may stand: on the floor, away from the walls. */
  ground = (x: number, z: number): number | null => (x > 0.3 && z > 0.3 && x < this.shape.w - 0.3 && z < this.shape.d - 0.15 ? 0 : null);

  /** Darker outside means the lamps matter more. */
  setNight(night: number): void {
    this.sun.intensity = 1.4 - night * 0.9;
    this.hemi.intensity = 1.35 - night * 0.45;
    this.glow.intensity = 0.2 + night * 1.6;
  }

  get center(): { x: number; z: number; w: number; d: number } {
    return { x: this.shape.w / 2, z: this.shape.d / 2, w: this.shape.w, d: this.shape.d };
  }

  private buildRoom(level: number, floor: FloorId, w: number, d: number): THREE.Group {
    const look = LOOK[floor];
    const g = group('room');
    const p: THREE.BufferGeometry[] = [];
    // Floor boards (or stone tiles in the cellar).
    const plank = floor === 'basement' ? 1 : 0.5;
    for (let i = 0; i * plank < w; i++) {
      const pw = Math.min(plank, w - i * plank);
      p.push(box(pw - 0.02, 0.2, d, i * plank + pw / 2, -0.1, d / 2, look.floor[i % 2]!));
    }
    // Walls: the tall back wall with a lower band and baseboard; low side walls.
    p.push(box(w + 0.4, WALL_H, 0.2, w / 2, WALL_H / 2, -0.1, look.wall));
    p.push(box(w, 0.9, 0.04, w / 2, 0.45, 0.02, look.trim), box(w, 0.08, 0.06, w / 2, 0.93, 0.03, look.base), box(w, 0.12, 0.06, w / 2, 0.06, 0.03, look.base));
    for (const x of [-0.1, w + 0.1]) {
      p.push(box(0.2, SIDE_H, d + 0.2, x, SIDE_H / 2, d / 2 - 0.1, look.wall), box(0.24, 0.06, d + 0.24, x, SIDE_H, d / 2 - 0.1, look.base));
    }
    // Windows on the back wall (the glass glows at night, like every window on the island).
    const glass: THREE.BufferGeometry[] = [];
    if (floor !== 'basement') {
      const count = w > 8 ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const x = (w * (i + 1)) / (count + 1);
        p.push(box(1.1, 1.0, 0.08, x, 1.75, 0.02, look.base), box(0.06, 0.86, 0.1, x, 1.75, 0.05, look.base), box(0.96, 0.06, 0.1, x, 1.75, 0.05, look.base), box(1.3, 0.08, 0.2, x, 1.22, 0.08, look.base));
        glass.push(box(0.96, 0.86, 0.04, x, 1.75, 0.04, 0xffffff));
      }
    } else {
      for (let x = 1; x < w; x += 2.5) p.push(box(0.2, WALL_H, 0.16, x, WALL_H / 2, 0.06, 0x8a857c));
    }
    // A beam marks where the side room joins.
    if (floor === 'ground' && w > 7) p.push(box(0.24, WALL_H, 0.3, 7, WALL_H / 2, 0.05, look.base), box(0.3, 0.06, 0.4, 7, 0.03, 0.2, look.base));
    // The front door: mat and threshold.
    if (floor === 'ground') {
      // Doormat, and an open door in the (missing) front wall.
      p.push(box(0.9, 0.03, 0.5, 3.5, 0.015, d - 0.32, 0xe8708f), box(1.3, 0.06, 0.24, 3.5, 0.03, d + 0.05, look.base));
      p.push(box(0.12, 0.5, 0.14, 2.85, 0.25, d + 0.05, look.base), box(0.12, 0.5, 0.14, 4.15, 0.25, d + 0.05, look.base));
      p.push(box(0.08, 0.5, 0.9, 2.9, 0.27, d + 0.5, 0x8a5a34, 0, -0.5, 0));
    }
    // Stairs: steps up toward the back wall, or an opening going down.
    for (const s of stairsOn(level, floor)) {
      const up = s.to === 'upper' || (s.to === 'ground' && floor === 'basement');
      if (up) {
        const steps = 6;
        for (let i = 0; i < steps; i++) {
          const depth = STAIRS_DEPTH / steps;
          const h = ((i + 1) / steps) * 2.2;
          p.push(box(1.9, h, depth, s.x + 1, h / 2, s.z + STAIRS_DEPTH - (i + 0.5) * depth, i % 2 ? look.floor[0]! : look.floor[1]!));
        }
        p.push(box(0.08, 1.0, STAIRS_DEPTH, s.x + 0.02, 1.6, s.z + STAIRS_DEPTH / 2, look.base, 0.6));
      } else {
        p.push(box(1.9, 0.02, STAIRS_DEPTH, s.x + 1, 0.005, s.z + STAIRS_DEPTH / 2, 0x1d1714));
        for (let i = 0; i < 3; i++) p.push(box(1.8, 0.04, 0.4, s.x + 1, -0.15 - i * 0.3, s.z + STAIRS_DEPTH - 0.3 - i * 0.5, look.floor[i % 2]!));
        p.push(box(0.06, 0.8, STAIRS_DEPTH, s.x + 0.05, 0.4, s.z + STAIRS_DEPTH / 2, look.base), box(0.06, 0.8, STAIRS_DEPTH, s.x + 1.95, 0.4, s.z + STAIRS_DEPTH / 2, look.base));
        p.push(cyl(0.05, 0.05, 0.9, s.x + 0.05, 0.45, s.z + STAIRS_DEPTH, look.base, 6), cyl(0.05, 0.05, 0.9, s.x + 1.95, 0.45, s.z + STAIRS_DEPTH, look.base, 6));
      }
    }
    const body = vcMesh(p, 'room');
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    if (glass.length) {
      const win = meshOf(merge(glass), materials().window, 'window', false);
      g.add(win);
    }
    return g;
  }
}
