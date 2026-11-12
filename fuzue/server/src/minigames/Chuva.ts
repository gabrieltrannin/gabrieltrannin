import { CHUVA, flatWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

interface Drop { key: string; kind: 'coin' | 'bomb'; x: number; y: number; z: number; value: number; landedAt: number }

const FALL_SPEED = 7;

/** Chuva de Moedas: pegue as moedas, fuja das bombas. */
export class Chuva extends Minigame {
  readonly id = 'chuva' as const;
  private readonly w = flatWorld(CHUVA.radius);
  private drops = new Map<string, Drop>();
  private nextCoin = 0.4;
  private nextBomb = 2.5;

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2 + 0.3;
    return { x: Math.cos(a) * 3, z: Math.sin(a) * 3, face: a + Math.PI };
  }

  private randomSpot(radius = CHUVA.radius - 1): { x: number; z: number } {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  }

  private drop(kind: 'coin' | 'bomb', x: number, z: number, value = 1): void {
    const y = 11 + Math.random() * 3;
    const key = this.addEntity(kind, x, y, z, Math.random() * 6, value);
    this.drops.set(key, { key, kind, x, y, z, value, landedAt: -1 });
  }

  protected update(dt: number): void {
    const k = this.t / this.duration;
    while (this.t >= this.nextCoin) {
      const s = this.randomSpot();
      this.drop('coin', s.x, s.z, Math.random() < 0.12 ? 3 : 1);
      this.nextCoin += 0.32 * (1 - 0.35 * k);
    }
    while (this.t >= this.nextBomb) {
      const alive = this.alive();
      const victim = alive[Math.floor(Math.random() * alive.length)];
      let s = this.randomSpot();
      if (victim && Math.random() < 0.55) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 2.2;
        s = { x: victim.body.x + Math.cos(a) * r, z: victim.body.z + Math.sin(a) * r };
        const d = Math.hypot(s.x, s.z);
        if (d > CHUVA.radius - 1) { s.x *= (CHUVA.radius - 1) / d; s.z *= (CHUVA.radius - 1) / d; }
      }
      this.drop('bomb', s.x, s.z);
      this.nextBomb += 1.5 - 0.75 * k;
    }

    for (const d of [...this.drops.values()]) {
      const e = this.mg.entities.get(d.key);
      if (d.y > 0) {
        d.y = Math.max(0, d.y - FALL_SPEED * dt);
        if (e) e.y = d.y;
        if (d.y === 0) d.landedAt = this.t;
      }
      if (e && d.kind === 'coin') e.a += dt * 4;
      if (d.kind === 'bomb' && d.landedAt >= 0) this.explode(d);
      else if (d.kind === 'coin' && d.landedAt >= 0 && this.t - d.landedAt > 4.5) this.remove(d);
    }

    for (const rt of this.alive()) {
      for (const d of [...this.drops.values()]) {
        if (d.kind !== 'coin' || d.y > 1.7) continue;
        if (Math.hypot(d.x - rt.body.x, d.z - rt.body.z) < 0.95) {
          rt.score += d.value;
          this.fx({ kind: 'coin', x: d.x, y: Math.max(0.6, d.y), z: d.z, pid: rt.id });
          this.remove(d);
        }
      }
    }
  }

  private remove(d: Drop): void {
    this.drops.delete(d.key);
    this.removeEntity(d.key);
  }

  private explode(d: Drop): void {
    this.remove(d);
    this.fx({ kind: 'explode', x: d.x, y: 0.4, z: d.z });
    for (const rt of this.alive()) {
      const dx = rt.body.x - d.x;
      const dz = rt.body.z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.6) continue;
      const nx = dist > 0.01 ? dx / dist : 1;
      const nz = dist > 0.01 ? dz / dist : 0;
      this.knock(rt, nx, nz, 8, 6, 0.9);
      rt.score = Math.max(0, rt.score - 2);
    }
  }

  ranking(): string[][] {
    return this.scoreRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const ai = rt.ai;
    ai.retarget -= dt;
    let target = ai.target ? this.drops.get(ai.target) : undefined;
    if (!target || ai.retarget <= 0) {
      let best: Drop | undefined;
      let bestCost = Infinity;
      const speed = 6 * this.botSpeed;
      for (const d of this.drops.values()) {
        if (d.kind !== 'coin') continue;
        const dist = Math.hypot(d.x - b.x, d.z - b.z);
        const arrive = dist / speed;
        const fall = d.y / FALL_SPEED;
        const cost = dist + Math.max(0, fall - arrive) * 1.5 - d.value * 1.2 + (arrive > fall + 4 ? 99 : 0);
        if (cost < bestCost) { bestCost = cost; best = d; }
      }
      target = best;
      ai.target = best?.key ?? null;
      ai.retarget = this.botReaction;
    }
    let dx = target ? target.x - b.x : -b.x * 0.3;
    let dz = target ? target.z - b.z : -b.z * 0.3;
    // foge da sombra das bombas
    if (this.level > 0 || Math.random() < 0.5) {
      for (const d of this.drops.values()) {
        if (d.kind !== 'bomb' || d.y > 7) continue;
        const ox = b.x - d.x;
        const oz = b.z - d.z;
        const od = Math.hypot(ox, oz);
        if (od < 3.2) {
          const w = (3.2 - od) * 3;
          dx += (ox / (od || 1)) * w;
          dz += (oz / (od || 1)) * w;
        }
      }
    }
    const near = this.alive().some(o => o !== rt && Math.hypot(o.body.x - b.x, o.body.z - b.z) < 1.3);
    return this.toward(rt, dx, dz, { push: near && this.wantsPush(dt) && Math.random() < 0.5 });
  }
}
