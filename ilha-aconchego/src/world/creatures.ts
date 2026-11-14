import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import type { CreatureKind } from '../data/regions';
import type { GroundFn } from './collision';

interface Creature {
  id: string;
  kind: CreatureKind;
  object: THREE.Object3D;
  home: THREE.Vector2;
  goal: THREE.Vector2;
  wait: number;
  hop: number;
  hits: number;
  cooldown: number;
  squish: number;
  calm: boolean;
}

/** How close a creature notices you, and how close it bumps into you. */
const NOTICE = 4.2;
const BUMP = 0.75;
const SPEED = 1.3;

/**
 * Stage 6: the cute creatures of the regions and mines (docs/GAME_DESIGN.md, "Combate leve contra criaturas
 * fofas"). They hop around their spot, come closer when you are near and bump into you now and then.
 * Three bubbles from the wand calm one down (the game state then hides it until tomorrow).
 */
export class CreatureLayer {
  readonly root = new THREE.Group();
  private list: Creature[] = [];
  private ground: GroundFn = () => 0;

  constructor(private readonly assets: AssetRegistry) {
    this.root.name = 'creatures';
  }

  setSpawns(spawns: readonly { id: string; kind: CreatureKind; at: readonly [number, number] }[], ground: GroundFn): void {
    for (const c of this.list) this.root.remove(c.object);
    this.ground = ground;
    this.list = spawns.map((s, i) => {
      const object = this.assets.create(`creature.${s.kind}`);
      object.position.set(s.at[0], ground(s.at[0], s.at[1]) ?? 0, s.at[1]);
      this.root.add(object);
      return { id: s.id, kind: s.kind, object, home: new THREE.Vector2(s.at[0], s.at[1]), goal: new THREE.Vector2(s.at[0], s.at[1]), wait: i * 0.7, hop: i, hits: 0, cooldown: 1.5, squish: 0, calm: false };
    });
  }

  /** Hides calmed creatures; in peaceful mode they all stay away. */
  sync(calmed: readonly string[], peaceful: boolean): void {
    for (const c of this.list) {
      c.calm = peaceful || calmed.includes(c.id);
      c.object.visible = !c.calm;
    }
  }

  /** The active creature nearest to a point, within `reach`. */
  nearest(x: number, z: number, reach: number): { id: string; at: THREE.Vector3 } | null {
    let best: Creature | null = null;
    let bestD = reach;
    for (const c of this.list) {
      if (c.calm) continue;
      const d = Math.hypot(c.object.position.x - x, c.object.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best ? { id: best.id, at: best.object.position } : null;
  }

  /** One bubble hits a creature. Returns how many it has taken. */
  hit(id: string): number {
    const c = this.list.find(x => x.id === id);
    if (!c) return 0;
    c.hits += 1;
    c.squish = 0.5;
    c.cooldown = Math.max(c.cooldown, 1.2);
    return c.hits;
  }

  /** Moves the creatures; returns the id of one that bumped into the player this frame, if any. */
  update(dt: number, player: { x: number; z: number }): string | null {
    let bumped: string | null = null;
    for (const c of this.list) {
      if (c.calm) continue;
      const o = c.object;
      c.cooldown = Math.max(0, c.cooldown - dt);
      c.squish = Math.max(0, c.squish - dt);
      const toPlayer = Math.hypot(player.x - o.position.x, player.z - o.position.z);
      const fromHome = Math.hypot(player.x - c.home.x, player.z - c.home.y);
      if (toPlayer < NOTICE && fromHome < NOTICE + 2.5) c.goal.set(player.x, player.z);
      else if ((c.wait -= dt) <= 0) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 2.2;
        c.goal.set(c.home.x + Math.cos(a) * r, c.home.y + Math.sin(a) * r);
        c.wait = 2 + Math.random() * 3;
      }
      const dx = c.goal.x - o.position.x, dz = c.goal.y - o.position.z, d = Math.hypot(dx, dz);
      if (d > 0.3 && c.cooldown < 0.9) {
        const step = Math.min(d, SPEED * dt);
        const nx = o.position.x + (dx / d) * step, nz = o.position.z + (dz / d) * step;
        if (this.ground(nx, nz) !== null) {
          o.position.x = nx;
          o.position.z = nz;
        }
        o.rotation.y = Math.atan2(dx, dz);
        c.hop += dt * 8;
      }
      const g = this.ground(o.position.x, o.position.z) ?? 0;
      o.position.y = g + Math.abs(Math.sin(c.hop)) * 0.18;
      const squash = c.squish > 0 ? 1 - Math.sin(c.squish * 12) * 0.25 : 1 + Math.sin(c.hop * 2) * 0.04;
      o.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      if (toPlayer < BUMP && c.cooldown <= 0 && !bumped) {
        bumped = c.id;
        c.cooldown = 1.8;
        // Bounce back a little after the bump.
        o.position.x -= (dx / Math.max(d, 0.01)) * 0.6;
        o.position.z -= (dz / Math.max(d, 0.01)) * 0.6;
      }
    }
    return bumped;
  }
}
