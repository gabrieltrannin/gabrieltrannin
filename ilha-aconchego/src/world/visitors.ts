import * as THREE from 'three';
import { VISITOR_SPECIES, VISITOR_SPOTS } from '../data/rating';
import { villager, type VillagerDef } from '../data/villagers';
import { animateAvatar } from '../render/avatar';
import { buildVillager } from '../render/villager';
import { heightAt } from './terrain';

const COLORS = ['#C46A2E', '#A6A1B2', '#8A5A3C', '#F4F1EA', '#E6C46A', '#7A7A82', '#D9B99B', '#6B4F3F'];
const OUTFITS = ['tshirt', 'hoodie', 'overalls', 'dress'] as const;
const TOPS = ['#F27BA5', '#5B8DD9', '#F2C14E', '#3FA7A0', '#E5484D', '#B892FF'];

interface Visitor {
  object: THREE.Group;
  home: [number, number];
  goal: [number, number];
  wait: number;
  phase: number;
}

/** A small seeded generator, so the same day shows the same visitors. */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Stage 5: friendly tourists who come to see the island (more stars, more visitors). They stroll
 * around a few pretty spots and say hello; they are only decoration and life, not saved.
 */
export class Visitors {
  readonly root = new THREE.Group();
  private list: Visitor[] = [];
  private key = '';

  constructor() {
    this.root.name = 'visitors';
  }

  /** Shows `count` visitors for the day `day` (rebuilt only when either changes). */
  sync(count: number, day: number): void {
    const key = `${count}|${day}`;
    if (key === this.key) return;
    this.key = key;
    for (const v of this.list) this.root.remove(v.object);
    this.list = [];
    const random = seeded(day * 7919 + 13);
    const base = villager('lumi');
    for (let i = 0; i < count; i++) {
      const fur = COLORS[Math.floor(random() * COLORS.length)]!;
      const def: VillagerDef = {
        ...base,
        species: VISITOR_SPECIES[Math.floor(random() * VISITOR_SPECIES.length)]!,
        fur,
        muzzle: '#F4F1EA',
        extra: random() < 0.5 ? 'glasses' : 'scarf',
        look: { ...base.look, skin: fur, hairColor: fur, outfit: OUTFITS[Math.floor(random() * OUTFITS.length)]!, topColor: TOPS[Math.floor(random() * TOPS.length)]!, accessory: random() < 0.4 ? 'strawHat' : 'none' },
      };
      const object = buildVillager(def);
      object.name = `visitor.${i}`;
      const spot = VISITOR_SPOTS[(i * 3 + Math.floor(random() * 2)) % VISITOR_SPOTS.length]!;
      const home: [number, number] = [spot[0], spot[1]];
      object.position.set(home[0], heightAt(home[0], home[1]), home[1]);
      this.root.add(object);
      this.list.push({ object, home, goal: [...home], wait: random() * 3, phase: random() * 6 });
    }
  }

  /** Position of the visitor nearest to a point, within `reach`. */
  nearest(x: number, z: number, reach: number): { index: number; at: THREE.Vector3 } | null {
    let best: { index: number; at: THREE.Vector3 } | null = null;
    let bestD = reach;
    this.list.forEach((v, index) => {
      const d = Math.hypot(v.object.position.x - x, v.object.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = { index, at: v.object.position };
      }
    });
    return best;
  }

  update(dt: number, elapsed: number): void {
    for (const v of this.list) {
      const o = v.object;
      const dx = v.goal[0] - o.position.x, dz = v.goal[1] - o.position.z, d = Math.hypot(dx, dz);
      let move = 0;
      if (d > 0.05) {
        const step = Math.min(d, dt * 0.9);
        o.position.x += (dx / d) * step;
        o.position.z += (dz / d) * step;
        o.position.y = heightAt(o.position.x, o.position.z);
        o.rotation.y = Math.atan2(dx, dz);
        v.phase += dt * 7;
        move = 1;
      } else {
        v.wait -= dt;
        if (v.wait <= 0) {
          // A new spot to look at, close to where they like to be.
          const a = Math.sin(elapsed * 1.3 + v.phase) * Math.PI, r = 0.6 + Math.abs(Math.cos(elapsed + v.phase)) * 1.0;
          v.goal = [v.home[0] + Math.cos(a) * r, v.home[1] + Math.sin(a) * r];
          v.wait = 3 + Math.abs(Math.sin(v.phase * 3)) * 4;
        }
      }
      animateAvatar(o, v.phase, move, 0, elapsed);
    }
  }
}
