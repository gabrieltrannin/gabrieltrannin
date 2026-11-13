import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import type { SeasonId } from '../data/calendar';
import { BUGS, inHours, isRainy, type BugDef } from '../data/fish';
import type { ItemId } from '../data/items';
import { BLOSSOM_TREES, FLOWER_PATCHES, HIVES, ORCHARD, POND, ROUND_TREES, TALL_GRASS } from '../data/map';
import type { WeatherId } from '../data/weather';
import { heightAt } from './terrain';

/** A bug flying or crawling somewhere on the island, waiting for the net. */
export interface Bug {
  id: number;
  item: ItemId;
  object: THREE.Object3D;
}

interface Live extends Bug {
  home: THREE.Vector3;
  flies: boolean;
  phase: number;
  life: number;
  target: THREE.Vector3;
}

const MAX_BUGS = 5;
const FLYERS = new Set<ItemId>(['bug.butterfly', 'bug.bee', 'bug.firefly']);

/**
 * Spawns the bugs that fit the season, the hour and the weather near the places they like
 * (flowers, tall grass, trees, the pond, the hives). Only visuals: catching one sends `bug.catch`.
 */
export class BugSystem {
  readonly root = new THREE.Group();
  private readonly live: Live[] = [];
  private nextId = 1;
  private spawnIn = 1;
  private seed = 1;

  constructor(private readonly assets: AssetRegistry) {
    this.root.name = 'bugs';
  }

  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  private spot(def: BugDef): THREE.Vector3 {
    const r = () => this.random();
    let x = 0, z = 0;
    if (def.near === 'flowers') {
      const p = FLOWER_PATCHES[Math.floor(r() * FLOWER_PATCHES.length)]!;
      x = p[0] + (r() - 0.5) * 1.2;
      z = p[1] + (r() - 0.5) * 1.2;
    } else if (def.near === 'grass') {
      x = TALL_GRASS.x0 + r() * (TALL_GRASS.x1 - TALL_GRASS.x0);
      z = TALL_GRASS.z0 + r() * (TALL_GRASS.z1 - TALL_GRASS.z0);
    } else if (def.near === 'trees') {
      const trees = [...ORCHARD, ...ROUND_TREES, ...BLOSSOM_TREES];
      const t = trees[Math.floor(r() * trees.length)]!;
      const a = r() * Math.PI * 2;
      x = t[0] + Math.cos(a) * 0.8;
      z = t[1] + Math.sin(a) * 0.8;
    } else if (def.near === 'water') {
      const a = r() * Math.PI * 2;
      x = POND.x + Math.cos(a) * (POND.rx + 0.5);
      z = POND.z + Math.sin(a) * (POND.rz + 0.5);
    } else {
      const h = HIVES[Math.floor(r() * HIVES.length)]!;
      x = h[0] + (r() - 0.5) * 2;
      z = h[1] + 0.8 + r();
    }
    return new THREE.Vector3(x, heightAt(x, z), z);
  }

  update(dt: number, elapsed: number, season: SeasonId, minute: number, weather: WeatherId): void {
    const rainy = isRainy(weather);
    const available = BUGS.filter(b => b.seasons.includes(season) && inHours(b.hours, minute) && (!b.weather || (b.weather === 'rain' ? rainy : !rainy)));
    // Bugs that are out of their time leave.
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i]!;
      b.life -= dt;
      if (b.life <= 0 || !available.some(a => a.item === b.item)) this.remove(b.id);
    }
    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && available.length && this.live.length < MAX_BUGS) {
      this.spawnIn = 4 + this.random() * 6;
      const def = available[Math.floor(this.random() * available.length)]!;
      const object = this.assets.create(def.item);
      const home = this.spot(def);
      object.position.copy(home);
      this.root.add(object);
      this.live.push({ id: this.nextId++, item: def.item, object, home, flies: FLYERS.has(def.item), phase: this.random() * 10, life: 60 + this.random() * 60, target: home.clone() });
    }
    for (const b of this.live) {
      const p = b.object.position;
      if (b.flies) {
        const t = elapsed * 0.6 + b.phase;
        p.set(b.home.x + Math.sin(t) * 0.9 + Math.sin(t * 2.3) * 0.25, b.home.y + 0.7 + Math.sin(t * 3.1) * 0.25, b.home.z + Math.cos(t * 0.8) * 0.7);
        b.object.rotation.y = t + Math.PI / 2;
        // Wings flap: squash the body along x.
        b.object.scale.x = b.item === 'bug.butterfly' ? 0.35 + Math.abs(Math.sin(elapsed * 14 + b.phase)) * 0.65 : 1;
      } else {
        const d = Math.hypot(b.target.x - p.x, b.target.z - p.z);
        if (d < 0.05) {
          const a = this.random() * Math.PI * 2;
          b.target.set(b.home.x + Math.cos(a) * 0.6, 0, b.home.z + Math.sin(a) * 0.6);
        } else {
          const speed = b.item === 'bug.snail' ? 0.05 : 0.18;
          p.x += ((b.target.x - p.x) / d) * Math.min(d, speed * dt);
          p.z += ((b.target.z - p.z) / d) * Math.min(d, speed * dt);
          b.object.rotation.y = Math.atan2(b.target.x - p.x, b.target.z - p.z);
        }
        const hop = b.item === 'bug.grasshopper' ? Math.max(0, Math.sin(elapsed * 3 + b.phase)) * 0.25 : 0;
        p.y = heightAt(p.x, p.z) + 0.02 + hop;
      }
    }
  }

  /** The bug closest to (x, z) within `reach`. */
  nearest(x: number, z: number, reach: number): Bug | null {
    let best: Live | null = null, bestD = reach;
    for (const b of this.live) {
      const d = Math.hypot(b.object.position.x - x, b.object.position.z - z);
      if (d <= bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  remove(id: number): void {
    const i = this.live.findIndex(b => b.id === id);
    if (i < 0) return;
    this.root.remove(this.live[i]!.object);
    this.live.splice(i, 1);
  }
}
