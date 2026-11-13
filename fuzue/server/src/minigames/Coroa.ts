import { COROA, yardWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Coroa Roubada: quem segura a coroa ganha pontos; empurrão faz derrubar. */
export class Coroa extends Minigame {
  readonly id = 'coroa' as const;
  private readonly w = yardWorld(COROA.radius);
  private holder = '';
  private crown = { x: 0, z: 0, vx: 0, vz: 0, y: 0.4 };
  private crownKey = '';
  /** Quem acabou de derrubar não pega de volta na hora. */
  private blocked = { id: '', until: 0 };
  private held = new Map<string, number>();

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2 + 0.5;
    const x = Math.cos(a) * 5;
    const z = Math.sin(a) * 5;
    return { x, z, face: Math.atan2(-x, -z) };
  }

  protected setup(): void {
    this.crownKey = this.addEntity('crown', 0, 0.4, 0);
  }

  protected update(dt: number): void {
    const c = this.crown;
    if (!this.holder) {
      // coroa solta: desliza e quica no muro
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      c.vx *= Math.exp(-3 * dt);
      c.vz *= Math.exp(-3 * dt);
      const r = Math.hypot(c.x, c.z);
      const max = COROA.radius - 0.8;
      if (r > max) { c.x *= max / r; c.z *= max / r; c.vx *= -0.5; c.vz *= -0.5; }
      for (const rt of this.alive()) {
        if (rt.id === this.blocked.id && this.t < this.blocked.until) continue;
        if (rt.body.stunT > 0) continue;
        if (Math.hypot(rt.body.x - c.x, rt.body.z - c.z) < 1.0) {
          this.holder = rt.id;
          this.fx({ kind: 'grab', x: c.x, y: 1.8, z: c.z, pid: rt.id, text: 'Peguei!' });
          break;
        }
      }
    }
    const h = this.holder ? this.rt(this.holder) : undefined;
    if (h) {
      c.x = h.body.x;
      c.z = h.body.z;
      const time = (this.held.get(h.id) ?? 0) + dt;
      this.held.set(h.id, time);
      h.score = Math.floor(time);
    }
    for (const rt of this.rts) rt.body.boost = rt.id === this.holder ? COROA.holderBoost : 1;
  }

  protected onHit(attacker: Runtime, target: Runtime): void {
    if (target.id !== this.holder) return;
    // a coroa voa na direção do empurrão
    this.holder = '';
    const dx = target.body.x - attacker.body.x;
    const dz = target.body.z - attacker.body.z;
    const d = Math.hypot(dx, dz) || 1;
    this.crown = { x: target.body.x, z: target.body.z, vx: (dx / d) * 6 + (Math.random() - 0.5) * 3, vz: (dz / d) * 6 + (Math.random() - 0.5) * 3, y: 0.4 };
    this.blocked = { id: target.id, until: this.t + COROA.grabDelay };
    this.fx({ kind: 'drop', x: target.body.x, y: 1.8, z: target.body.z, pid: target.id });
  }

  protected mirrorExtra(): void {
    this.mg.holder = this.holder;
    this.setEntity(this.crownKey, { x: this.crown.x, z: this.crown.z, y: this.holder ? -50 : 0.45 });
  }

  ranking(): string[][] {
    // desempate pelo tempo exato com a coroa
    for (const rt of this.rts) rt.score = Math.floor(this.held.get(rt.id) ?? 0);
    const sorted = [...this.rts].sort((a, b) => (this.held.get(b.id) ?? 0) - (this.held.get(a.id) ?? 0));
    const groups: string[][] = [];
    sorted.forEach((r, i) => {
      if (i > 0 && sorted[i - 1].score === r.score) groups[groups.length - 1].push(r.id);
      else groups.push([r.id]);
    });
    return groups;
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    if (rt.id === this.holder) {
      const chaser = this.nearest(rt, this.alive());
      const away = chaser ? this.flee(rt, chaser.body, COROA.radius, 8) : { x: -b.x, z: -b.z };
      return this.toward(rt, away.x, away.z);
    }
    if (!this.holder) return this.toward(rt, this.crown.x - b.x, this.crown.z - b.z);
    const h = this.rt(this.holder);
    if (!h) return this.toward(rt, -b.x, -b.z);
    const lead = 0.15 + this.level * 0.15;
    const dx = h.body.x + h.body.vx * lead - b.x;
    const dz = h.body.z + h.body.vz * lead - b.z;
    const push = Math.hypot(dx, dz) < 2.2 && this.wantsPush(dt * 1.5);
    return this.toward(rt, dx, dz, { push });
  }
}
