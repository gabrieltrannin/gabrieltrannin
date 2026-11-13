import { TINTA, gridCenter, gridHalf, gridIndexAt, gridWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Tinta do Reino: cada piso fica da cor de quem pisou por último. Piso = índice do jogador + 1. */
export class Tinta extends Minigame {
  readonly id = 'tinta' as const;
  private tiles: number[] = new Array(TINTA.n * TINTA.n).fill(0);
  private readonly w = gridWorld(TINTA, this.tiles, () => true);
  private buckets = new Map<string, { x: number; z: number }>();
  private nextBucket = 3;
  private changed = new Set<number>();

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number): Spawn {
    const h = gridHalf(TINTA) - 1.6;
    const spots = [[-h, -h], [h, h], [h, -h], [-h, h]];
    const [x, z] = spots[i % 4];
    return { x, z, face: Math.atan2(-x, -z), team: i };
  }

  protected setup(): void {
    for (const v of this.tiles) this.mg.tiles.push(v);
  }

  private paint(i: number, owner: number): void {
    if (i < 0 || this.tiles[i] === owner) return;
    this.tiles[i] = owner;
    this.changed.add(i);
  }

  protected update(dt: number): void {
    this.nextBucket -= dt;
    if (this.nextBucket <= 0 && this.buckets.size < TINTA.buckets) {
      const h = gridHalf(TINTA) - 1;
      const x = (Math.random() * 2 - 1) * h;
      const z = (Math.random() * 2 - 1) * h;
      this.buckets.set(this.addEntity('bucket', x, 0, z, Math.random() * 6), { x, z });
      this.nextBucket = 4 + Math.random() * 3;
    }
    for (const rt of this.alive()) {
      const b = rt.body;
      if (!b.grounded) continue;
      const owner = rt.index + 1;
      this.paint(gridIndexAt(TINTA, b.x, b.z), owner);
      for (const [key, bk] of this.buckets) {
        if (Math.hypot(bk.x - b.x, bk.z - b.z) > 1) continue;
        // balde: pinta um quadrado 3×3 em volta
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.paint(gridIndexAt(TINTA, b.x + dx * TINTA.cell, b.z + dz * TINTA.cell), owner);
        this.buckets.delete(key);
        this.removeEntity(key);
        this.fx({ kind: 'paint', x: bk.x, y: 0.6, z: bk.z, pid: rt.id, team: rt.index });
      }
    }
    const counts = new Array(this.rts.length + 1).fill(0);
    for (const v of this.tiles) counts[v]++;
    for (const rt of this.rts) rt.score = counts[rt.index + 1];
  }

  protected mirrorExtra(): void {
    for (const i of this.changed) this.mg.tiles[i] = this.tiles[i];
    this.changed.clear();
  }

  ranking(): string[][] {
    return this.scoreRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const ai = rt.ai;
    ai.retarget -= dt;
    const me = rt.index + 1;
    const goalI = ai.goal ? gridIndexAt(TINTA, ai.goal.x, ai.goal.z) : -1;
    if (!ai.goal || ai.retarget <= 0 || (goalI >= 0 && this.tiles[goalI] === me)) {
      let best: { x: number; z: number } | null = null;
      let bd = Infinity;
      for (const bk of this.buckets.values()) {
        const d = Math.hypot(bk.x - b.x, bk.z - b.z) - 3;
        if (d < bd) { bd = d; best = bk; }
      }
      for (let i = 0; i < this.tiles.length; i++) {
        if (this.tiles[i] === me) continue;
        const c = gridCenter(TINTA, i);
        const d = Math.hypot(c.x - b.x, c.z - b.z) + (this.tiles[i] === 0 ? 0 : 0.6) + Math.random() * (this.level === 0 ? 2 : 0.6);
        if (d < bd) { bd = d; best = c; }
      }
      ai.goal = best ?? { x: 0, z: 0 };
      ai.retarget = 0.5 + Math.random() * 0.6;
    }
    const near = this.nearest(rt, this.alive());
    const push = !!near && Math.hypot(near.body.x - b.x, near.body.z - b.z) < 1.3 && this.wantsPush(dt * 0.6);
    return this.toward(rt, ai.goal.x - b.x, ai.goal.z - b.z, { push });
  }
}
