import { BOMBA, flatWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Bomba-Relógio: passe a bomba encostando nos outros antes de explodir. */
export class Bomba extends Minigame {
  readonly id = 'bomba' as const;
  private readonly w = flatWorld(BOMBA.radius);
  private holder = '';
  private fuse = 0;
  private pause = 1.2;
  private bombNo = 0;
  private noReturn = { from: '', until: 0 };

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * 4;
    const z = Math.sin(a) * 4;
    return { x, z, face: Math.atan2(-x, -z) };
  }

  protected update(dt: number): void {
    const alive = this.alive();
    if (!this.holder) {
      this.pause -= dt;
      if (this.pause <= 0 && alive.length > 1) {
        this.holder = alive[Math.floor(Math.random() * alive.length)].id;
        const scale = this.duration / 90;
        this.fuse = (Math.max(4.5, 10.5 - this.bombNo * 1.4) + Math.random() * 2.5) * scale;
        this.bombNo++;
        this.noReturn = { from: '', until: 0 };
      }
    } else {
      this.fuse -= dt;
      const h = this.rt(this.holder);
      if (h && h.alive) {
        for (const o of alive) {
          if (o === h) continue;
          if (o.id === this.noReturn.from && this.t < this.noReturn.until) continue;
          if (Math.hypot(o.body.x - h.body.x, o.body.z - h.body.z) < 1.0 && Math.abs(o.body.y - h.body.y) < 1.2) {
            this.noReturn = { from: h.id, until: this.t + 0.8 };
            this.holder = o.id;
            this.fx({ kind: 'pass', x: o.body.x, y: o.body.y + 1.2, z: o.body.z, pid: o.id });
            break;
          }
        }
      }
      if (this.fuse <= 0) this.explode();
    }
    for (const rt of this.rts) rt.body.boost = rt.id === this.holder ? 1.15 : 1;
  }

  private explode(): void {
    const h = this.rt(this.holder);
    this.holder = '';
    this.pause = 1.4;
    if (!h) return;
    this.fx({ kind: 'explode', x: h.body.x, y: 0.6, z: h.body.z, pid: h.id });
    for (const o of this.alive()) {
      if (o === h) continue;
      const dx = o.body.x - h.body.x;
      const dz = o.body.z - h.body.z;
      const d = Math.hypot(dx, dz);
      if (d < 3) this.knock(o, dx / (d || 1), dz / (d || 1), 7, 5, 0.5);
    }
    this.eliminate(h);
  }

  protected timeUp(): void {
    if (this.holder) this.explode();
    this.over = true;
  }

  protected checkOver(): boolean {
    return this.alive().length <= 1;
  }

  protected mirrorExtra(): void {
    this.mg.holder = this.holder;
    this.mg.fuse = Math.max(0, this.fuse);
  }

  ranking(): string[][] {
    return this.eliminationRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const others = this.alive().filter(o => o !== rt);
    if (rt.id === this.holder) {
      const victims = others.filter(o => !(o.id === this.noReturn.from && this.t < this.noReturn.until));
      const target = this.nearest(rt, victims.length ? victims : others);
      if (!target) return this.toward(rt, -b.x, -b.z);
      const lead = this.level * 0.25;
      const dx = target.body.x + target.body.vx * lead - b.x;
      const dz = target.body.z + target.body.vz * lead - b.z;
      const push = Math.hypot(dx, dz) < 2.4 && this.wantsPush(dt);
      return this.toward(rt, dx, dz, { push });
    }
    const h = this.rt(this.holder);
    let dx = -b.x * 0.15;
    let dz = -b.z * 0.15;
    if (h && h.alive) {
      const ox = b.x - h.body.x;
      const oz = b.z - h.body.z;
      const od = Math.hypot(ox, oz) || 1;
      const w = Math.max(0, 7 - od);
      dx += (ox / od) * w;
      dz += (oz / od) * w;
      // encostado na parede: escapa de lado em vez de ficar preso
      const r = Math.hypot(b.x, b.z);
      if (r > BOMBA.radius - 2) {
        const tx = -b.z / r;
        const tz = b.x / r;
        const side = tx * ox + tz * oz >= 0 ? 1 : -1;
        dx += tx * side * 4 - (b.x / r) * 2;
        dz += tz * side * 4 - (b.z / r) * 2;
      }
    }
    return this.toward(rt, dx, dz);
  }
}
