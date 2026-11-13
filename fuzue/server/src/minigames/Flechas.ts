import { FLECHAS, yardWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

interface Arrow { key: string; x: number; y: number; z: number; landed: number }

/** Chuva de Flechas: fuja das sombras; 3 vidas. */
export class Flechas extends Minigame {
  readonly id = 'flechas' as const;
  private readonly w = yardWorld(FLECHAS.radius);
  private arrows = new Map<string, Arrow>();
  private nextVolley = 1.2;
  private safeUntil = new Map<string, number>();

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2 + 0.2;
    return { x: Math.cos(a) * 3.5, z: Math.sin(a) * 3.5, face: a };
  }

  protected setup(): void {
    for (const rt of this.rts) rt.score = FLECHAS.lives;
  }

  private volleys = 0;

  private shoot(x: number, z: number): void {
    const y = 14 + Math.random() * 5;
    const key = this.addEntity('arrow', x, y, z, Math.random() * 6);
    this.arrows.set(key, { key, x, y, z, landed: -1 });
  }

  /** Muralha de flechas: uma linha atravessando a arena, com uma brecha. */
  private wall(): void {
    const a = Math.random() * Math.PI;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const off = (Math.random() - 0.5) * 6;
    const gap = (Math.random() - 0.5) * 10;
    const y = 15;
    for (let t = -FLECHAS.radius; t <= FLECHAS.radius; t += 1.3) {
      if (Math.abs(t - gap) < 1.4) continue;
      const x = dx * t - dz * off;
      const z = dz * t + dx * off;
      if (Math.hypot(x, z) > FLECHAS.radius - 0.6) continue;
      const key = this.addEntity('arrow', x, y, z, Math.random() * 6);
      this.arrows.set(key, { key, x, y, z, landed: -1 });
    }
  }

  /** Anel de flechas em volta de alguém (e uma no meio). */
  private ring(): void {
    const alive = this.alive();
    if (!alive.length) return;
    const v = alive[Math.floor(Math.random() * alive.length)].body;
    this.shoot(v.x, v.z);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random();
      const x = v.x + Math.cos(a) * 1.9;
      const z = v.z + Math.sin(a) * 1.9;
      if (Math.hypot(x, z) < FLECHAS.radius - 0.6) this.shoot(x, z);
    }
  }

  private volley(): void {
    this.volleys++;
    if (this.volleys % 4 === 0) { this.wall(); return; }
    if (this.volleys % 4 === 2) { this.ring(); }
    const k = this.t / this.duration;
    const n = 6 + Math.floor(k * 10);
    const alive = this.alive();
    for (let i = 0; i < n; i++) {
      let s = this.randomIn(FLECHAS.radius - 0.8);
      // metade mira perto de alguém
      if (alive.length && Math.random() < 0.6) {
        const v = alive[Math.floor(Math.random() * alive.length)].body;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.8;
        s = { x: v.x + v.vx * 0.5 + Math.cos(a) * r, z: v.z + v.vz * 0.5 + Math.sin(a) * r };
        const d = Math.hypot(s.x, s.z);
        if (d > FLECHAS.radius - 0.8) { s.x *= (FLECHAS.radius - 0.8) / d; s.z *= (FLECHAS.radius - 0.8) / d; }
      }
      this.shoot(s.x, s.z);
    }
  }

  protected update(dt: number): void {
    if (this.t >= this.nextVolley) {
      this.volley();
      this.nextVolley += 1.2 - 0.5 * (this.t / this.duration);
    }
    for (const a of [...this.arrows.values()]) {
      if (a.landed < 0) {
        a.y -= FLECHAS.fallSpeed * dt;
        if (a.y <= 0) {
          a.y = 0;
          a.landed = this.t;
          this.land(a);
        }
        this.setEntity(a.key, { y: a.y });
      } else if (this.t - a.landed > 1.6) {
        this.arrows.delete(a.key);
        this.removeEntity(a.key);
      }
    }
  }

  private land(a: Arrow): void {
    for (const rt of this.alive()) {
      if (rt.body.y > 1.6) continue;
      if (Math.hypot(rt.body.x - a.x, rt.body.z - a.z) > FLECHAS.hitR) continue;
      if (this.t < (this.safeUntil.get(rt.id) ?? 0)) continue;
      rt.score--;
      this.safeUntil.set(rt.id, this.t + 1.2);
      rt.body.stunT = 0.5;
      this.fx({ kind: 'hurt', x: rt.body.x, y: 1.6, z: rt.body.z, pid: rt.id, text: rt.score > 0 ? `${rt.score} ❤` : '' });
      if (rt.score <= 0) this.eliminate(rt);
    }
  }

  protected checkOver(): boolean {
    return this.alive().length <= 1;
  }

  ranking(): string[][] {
    // vivos ordenados por vidas, depois quem saiu por último
    const alive = this.alive().sort((a, b) => b.score - a.score);
    const groups: string[][] = [];
    alive.forEach((r, i) => {
      if (i > 0 && alive[i - 1].score === r.score) groups[groups.length - 1].push(r.id);
      else groups.push([r.id]);
    });
    const out = this.eliminationRanking().filter(g => g.every(id => !this.rt(id)?.alive));
    return [...groups, ...out];
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const ai = rt.ai;
    ai.timer -= dt;
    if (!ai.goal || ai.timer <= 0) {
      ai.goal = this.randomIn(FLECHAS.radius - 2.5);
      ai.timer = 1.5 + Math.random() * 1.5;
    }
    // o bot só "vê" a flecha quando ela já está perto do chão
    const sight = [4, 6.5, 9][this.level];
    const danger = [...this.arrows.values()].filter(a => a.landed < 0 && a.y < sight);
    const away = this.repel(rt, danger, 1.9, 4);
    const crowd = this.repel(rt, this.alive().filter(o => o !== rt).map(o => o.body), 1.6, 1);
    return this.toward(rt, (ai.goal.x - b.x) * 0.4 + away.x + crowd.x, (ai.goal.z - b.z) * 0.4 + away.z + crowd.z);
  }
}
