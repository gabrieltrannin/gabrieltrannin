import { CERCO, gridCenter, gridIndexAt, gridWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Pisos: 0 inteiro, 1 na mira de uma pedra, 2 destruído. */
const OK = 0;
const AIMED = 1;
const GONE = 2;

interface Boulder { key: string; tile: number; x: number; z: number; y: number; vy: number }

const FALL_TIME = 1.3;
const START_Y = 18;

/** Cerco ao Castelo: as pedras das catapultas destroem o pátio. */
export class Cerco extends Minigame {
  readonly id = 'cerco' as const;
  private tiles: number[] = new Array(CERCO.n * CERCO.n).fill(OK);
  private readonly w = gridWorld(CERCO, this.tiles, t => t < GONE);
  private boulders = new Map<string, Boulder>();
  private nextShot = 1.5;
  private changed = new Set<number>();

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number): Spawn {
    const spots = [[-3, -3], [3, -3], [-3, 3], [3, 3]];
    const [x, z] = spots[i % 4];
    return { x, z, face: Math.atan2(-x, -z) };
  }

  protected setup(): void {
    for (const v of this.tiles) this.mg.tiles.push(v);
  }

  private set(i: number, v: number): void {
    this.tiles[i] = v;
    this.changed.add(i);
  }

  private fire(): void {
    const intact = this.tiles.map((v, i) => (v === OK ? i : -1)).filter(i => i >= 0);
    if (!intact.length) return;
    let tile = intact[Math.floor(Math.random() * intact.length)];
    // muitas vezes mira onde alguém está
    const alive = this.alive();
    if (alive.length && Math.random() < 0.55) {
      const v = alive[Math.floor(Math.random() * alive.length)].body;
      const i = gridIndexAt(CERCO, v.x + v.vx * 0.6, v.z + v.vz * 0.6);
      if (i >= 0 && this.tiles[i] === OK) tile = i;
    }
    const c = gridCenter(CERCO, tile);
    this.set(tile, AIMED);
    const key = this.addEntity('boulder', c.x, START_Y, c.z, Math.random() * 6);
    this.boulders.set(key, { key, tile, x: c.x, z: c.z, y: START_Y, vy: -START_Y / FALL_TIME + 25 * FALL_TIME / 2 });
  }

  protected update(dt: number): void {
    const k = this.t / this.duration;
    if (this.t >= this.nextShot) {
      this.fire();
      if (k > 0.5 && Math.random() < 0.5) this.fire();
      this.nextShot += 1.25 - 0.55 * k;
    }
    for (const bo of [...this.boulders.values()]) {
      bo.vy -= 25 * dt;
      bo.y += bo.vy * dt;
      if (bo.y <= 0.6) this.impact(bo);
      else this.setEntity(bo.key, { y: bo.y });
    }
    for (const rt of this.alive()) if (rt.body.y < CERCO.killY) this.eliminate(rt);
  }

  private impact(bo: Boulder): void {
    this.boulders.delete(bo.key);
    this.removeEntity(bo.key);
    this.set(bo.tile, GONE);
    this.fx({ kind: 'smash', x: bo.x, y: 0.3, z: bo.z });
    for (const rt of this.alive()) {
      const dx = rt.body.x - bo.x;
      const dz = rt.body.z - bo.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.9 && rt.body.y < 1.5) this.knock(rt, dx / (d || 1), dz / (d || 1), 5, 4, 0.4);
    }
  }

  protected mirrorExtra(): void {
    for (const i of this.changed) this.mg.tiles[i] = this.tiles[i];
    this.changed.clear();
  }

  protected checkOver(): boolean {
    return this.alive().length <= 1;
  }

  ranking(): string[][] {
    return this.eliminationRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const ai = rt.ai;
    ai.retarget -= dt;
    const here = gridIndexAt(CERCO, b.x, b.z);
    const unsafe = here < 0 || this.tiles[here] !== OK;
    const goalTile = ai.goal ? gridIndexAt(CERCO, ai.goal.x, ai.goal.z) : -1;
    if (!ai.goal || goalTile < 0 || this.tiles[goalTile] !== OK || ai.retarget <= 0 || (unsafe && Math.random() < 0.3)) {
      // piso inteiro, com vizinhos inteiros, perto
      let best = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < this.tiles.length; i++) {
        if (this.tiles[i] !== OK) continue;
        const c = gridCenter(CERCO, i);
        const d = Math.hypot(c.x - b.x, c.z - b.z);
        let neighbors = 0;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = gridIndexAt(CERCO, c.x + ox * CERCO.cell, c.z + oz * CERCO.cell);
          if (j >= 0 && this.tiles[j] === OK) neighbors++;
        }
        const score = neighbors * 1.2 - d * 0.5 + Math.random() * (this.level === 0 ? 3 : 1);
        if (score > bestScore) { bestScore = score; best = i; }
      }
      ai.goal = best >= 0 ? gridCenter(CERCO, best) : { x: 0, z: 0 };
      ai.retarget = 1 + Math.random() * 1.5;
    }
    const dx = ai.goal.x - b.x;
    const dz = ai.goal.z - b.z;
    const d = Math.hypot(dx, dz) || 1;
    // buraco à frente: pula
    let jump = false;
    if (b.grounded) {
      const ahead = this.w.ground(b.x + (dx / d) * 0.9, b.z + (dz / d) * 0.9, b.y);
      const beyond = this.w.ground(b.x + (dx / d) * 2.4, b.z + (dz / d) * 2.4, b.y);
      jump = ahead === null && beyond !== null && Math.random() < [0.5, 0.85, 1][this.level];
    }
    const near = this.nearest(rt, this.alive());
    const push = !!near && Math.hypot(near.body.x - b.x, near.body.z - b.z) < 1.4 && this.wantsPush(dt * 0.6);
    return this.toward(rt, dx, dz, { jump, push });
  }
}
