import { COLHEITA, harvestWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

interface Pumpkin {
  key: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Quem carrega ('' = no chão). */
  carrier: string;
  gold: boolean;
  /** Quem derrubou não pega de volta logo. */
  blocked: string;
  blockedUntil: number;
}

/** Colheita: leve as abóboras até a carroça no meio. */
export class Colheita extends Minigame {
  readonly id = 'colheita' as const;
  private readonly w = harvestWorld();
  private pumpkins = new Map<string, Pumpkin>();
  private nextSpawn = 0;

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const x = Math.cos(a) * 4;
    const z = Math.sin(a) * 4;
    return { x, z, face: Math.atan2(x, z) };
  }

  protected setup(): void {
    for (let i = 0; i < COLHEITA.pumpkins; i++) this.plant();
  }

  private plant(): void {
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * (COLHEITA.radius - 7);
    const gold = Math.random() < 0.15;
    const p: Pumpkin = { key: '', x: Math.cos(a) * r, y: 0.35, z: Math.sin(a) * r, vx: 0, vy: 0, vz: 0, carrier: '', gold, blocked: '', blockedUntil: 0 };
    p.key = this.addEntity('pumpkin', p.x, p.y, p.z, Math.random() * 6, gold ? 1 : 0);
    this.pumpkins.set(p.key, p);
  }

  private carried(rt: Runtime): Pumpkin | undefined {
    for (const p of this.pumpkins.values()) if (p.carrier === rt.id) return p;
    return undefined;
  }

  protected update(dt: number): void {
    const loose = [...this.pumpkins.values()].filter(p => !p.carrier).length;
    this.nextSpawn -= dt;
    if (loose < COLHEITA.pumpkins - 2 && this.nextSpawn <= 0) {
      this.plant();
      this.nextSpawn = 0.6;
    }
    for (const p of this.pumpkins.values()) {
      if (p.carrier) {
        const c = this.rt(p.carrier);
        if (!c) { p.carrier = ''; continue; }
        p.x = c.body.x; p.y = c.body.y + 1.75; p.z = c.body.z;
        // entregou na carroça
        if (Math.hypot(c.body.x, c.body.z) < COLHEITA.cartR + COLHEITA.deliverR - 1.2) {
          const v = p.gold ? 3 : 1;
          c.score += v;
          this.fx({ kind: 'score', x: 0, y: 2.2, z: 0, pid: c.id, text: `+${v}` });
          this.pumpkins.delete(p.key);
          this.removeEntity(p.key);
        }
        continue;
      }
      // caindo/rolando depois de derrubada
      if (p.y > 0.35 || Math.abs(p.vx) + Math.abs(p.vz) > 0.05) {
        p.vy -= 20 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.35) { p.y = 0.35; p.vy = 0; p.vx *= 0.6; p.vz *= 0.6; }
        const r = Math.hypot(p.x, p.z);
        const max = COLHEITA.radius - 0.6;
        if (r > max) { p.x *= max / r; p.z *= max / r; p.vx = -p.vx * 0.4; p.vz = -p.vz * 0.4; }
        if (r < COLHEITA.cartR + 0.4) { const k = (COLHEITA.cartR + 0.4) / (r || 1); p.x *= k; p.z *= k; }
      }
      if (p.y > 1) continue;
      for (const rt of this.alive()) {
        if (rt.body.stunT > 0 || this.carried(rt)) continue;
        if (rt.id === p.blocked && this.t < p.blockedUntil) continue;
        if (Math.hypot(rt.body.x - p.x, rt.body.z - p.z) < 1.0) {
          p.carrier = rt.id;
          this.fx({ kind: 'grab', x: p.x, y: 1.6, z: p.z, pid: rt.id });
          break;
        }
      }
    }
    for (const rt of this.rts) rt.body.boost = this.carried(rt) ? COLHEITA.carryBoost : 1;
  }

  protected onHit(attacker: Runtime, target: Runtime): void {
    const p = this.carried(target);
    if (!p) return;
    const dx = target.body.x - attacker.body.x;
    const dz = target.body.z - attacker.body.z;
    const d = Math.hypot(dx, dz) || 1;
    p.carrier = '';
    p.vx = (dx / d) * 4;
    p.vz = (dz / d) * 4;
    p.vy = 5;
    p.blocked = target.id;
    p.blockedUntil = this.t + 1;
    this.fx({ kind: 'drop', x: p.x, y: p.y, z: p.z, pid: target.id });
  }

  protected mirrorExtra(): void {
    for (const p of this.pumpkins.values()) this.setEntity(p.key, { x: p.x, y: p.y, z: p.z });
  }

  ranking(): string[][] {
    return this.scoreRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const mine = this.carried(rt);
    if (mine) {
      // contorna quem estiver no caminho da carroça
      const away = this.repel(rt, this.alive().filter(o => o !== rt).map(o => o.body), 2.2, 1.5);
      return this.toward(rt, -b.x + away.x, -b.z + away.z);
    }
    let best: Pumpkin | undefined;
    let bd = Infinity;
    for (const p of this.pumpkins.values()) {
      if (p.carrier || p.y > 1.2 || (p.blocked === rt.id && this.t < p.blockedUntil)) continue;
      const d = Math.hypot(p.x - b.x, p.z - b.z) - (p.gold ? 3 : 0);
      if (d < bd) { bd = d; best = p; }
    }
    // alguém carregando perto? rouba
    const carriers = this.alive().filter(o => o !== rt && this.carried(o));
    const thief = this.nearest(rt, carriers);
    if (thief) {
      const td = Math.hypot(thief.body.x - b.x, thief.body.z - b.z);
      if (td < Math.min(bd, 5) && this.level > 0) {
        const push = td < 2 && this.wantsPush(dt * 1.5);
        return this.toward(rt, thief.body.x - b.x, thief.body.z - b.z, { push });
      }
    }
    if (!best) return this.toward(rt, b.x * 0.2, b.z * 0.2);
    return this.toward(rt, best.x - b.x, best.z - b.z);
  }
}
