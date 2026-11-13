import { JAVALI, PLAYER_RADIUS, islandWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Estado do javali: mira (cava o chão), investe, descansa. */
interface Boar {
  key: string;
  x: number; z: number;
  face: number;
  state: 0 | 1 | 2;
  timer: number;
  target: string;
  speed: number;
}

/** Fúria do Javali: saia da frente quando ele disparar. */
export class Javali extends Minigame {
  readonly id = 'javali' as const;
  private readonly w = islandWorld(JAVALI.radius);
  private boars: Boar[] = [];
  private hitCd = new Map<string, number>();

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const x = Math.cos(a) * 4.5;
    const z = Math.sin(a) * 4.5;
    return { x, z, face: Math.atan2(-x, -z) };
  }

  protected setup(): void {
    this.addBoar(0, -7.5);
  }

  private addBoar(x: number, z: number): void {
    const key = this.addEntity('boar', x, 0, z, 0, 0);
    this.boars.push({ key, x, z, face: Math.atan2(-x, -z), state: 2, timer: 1.2, target: '', speed: 10 });
  }

  protected update(dt: number): void {
    if (this.boars.length === 1 && this.t > this.duration * 0.5) this.addBoar(0, 7.5);
    const k = this.t / this.duration;
    for (const boar of this.boars) {
      boar.timer -= dt;
      if (boar.state === 2 && boar.timer <= 0) {
        // escolhe um alvo e mira
        const alive = this.alive();
        if (!alive.length) continue;
        const t = alive[Math.floor(Math.random() * alive.length)];
        boar.target = t.id;
        boar.state = 0;
        boar.timer = 1.0 - 0.4 * k;
      }
      if (boar.state === 0) {
        const t = this.rt(boar.target);
        if (t) boar.face = Math.atan2(t.body.x - boar.x, t.body.z - boar.z);
        if (boar.timer <= 0) {
          boar.state = 1;
          boar.timer = 2.4;
          boar.speed = 10 + 4 * k;
        }
      } else if (boar.state === 1) {
        const nx = boar.x + Math.sin(boar.face) * boar.speed * dt;
        const nz = boar.z + Math.cos(boar.face) * boar.speed * dt;
        // freia na beira da ilha
        if (Math.hypot(nx, nz) > JAVALI.radius - 1 || boar.timer <= 0) {
          boar.state = 2;
          boar.timer = 0.9 - 0.4 * k;
        } else {
          boar.x = nx;
          boar.z = nz;
        }
        for (const rt of this.alive()) {
          const b = rt.body;
          if (b.y > 1.2 || (this.hitCd.get(rt.id) ?? 0) > this.t) continue;
          if (Math.hypot(b.x - boar.x, b.z - boar.z) > JAVALI.boarR + PLAYER_RADIUS) continue;
          const side = Math.sign((b.x - boar.x) * Math.cos(boar.face) - (b.z - boar.z) * Math.sin(boar.face)) || 1;
          const kx = Math.sin(boar.face) + Math.cos(boar.face) * side * 0.4;
          const kz = Math.cos(boar.face) - Math.sin(boar.face) * side * 0.4;
          const kd = Math.hypot(kx, kz);
          this.knock(rt, kx / kd, kz / kd, 13, 6.5, 0.9);
          this.hitCd.set(rt.id, this.t + 0.8);
          this.room.broadcast('hit', { attacker: '', target: rt.id, x: b.x, y: b.y, z: b.z });
        }
      }
    }
    for (const rt of this.alive()) if (rt.body.y < JAVALI.killY) this.eliminate(rt);
  }

  protected mirrorExtra(): void {
    for (const b of this.boars) this.setEntity(b.key, { x: b.x, z: b.z, a: b.face, s: b.state });
  }

  protected checkOver(): boolean {
    return this.alive().length <= 1;
  }

  ranking(): string[][] {
    return this.eliminationRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    // tende ao meio da ilha
    let dx = -b.x * 0.35;
    let dz = -b.z * 0.35;
    const sense = [0.5, 0.85, 1][this.level];
    for (const boar of this.boars) {
      const toMeX = b.x - boar.x;
      const toMeZ = b.z - boar.z;
      const dist = Math.hypot(toMeX, toMeZ);
      const fx = Math.sin(boar.face);
      const fz = Math.cos(boar.face);
      const ahead = toMeX * fx + toMeZ * fz;
      const lateral = toMeX * fz - toMeZ * fx;
      const threatened = (boar.state === 1 || (boar.state === 0 && boar.target === rt.id)) && ahead > 0 && Math.abs(lateral) < 2.2;
      if (threatened && Math.random() < sense) {
        // sai de lado, para o lado em que já está (e de volta para o meio se perto da borda)
        const side = Math.sign(lateral) || (Math.random() < 0.5 ? 1 : -1);
        const sx = fz * side;
        const sz = -fx * side;
        const toward = Math.hypot(b.x + sx * 2, b.z + sz * 2) < JAVALI.radius - 1.5 ? 1 : -1;
        dx = sx * 5 * toward;
        dz = sz * 5 * toward;
      } else if (dist < 3) {
        dx += (toMeX / (dist || 1)) * 2;
        dz += (toMeZ / (dist || 1)) * 2;
      }
    }
    const near = this.nearest(rt, this.alive());
    const push = !!near && Math.hypot(near.body.x - b.x, near.body.z - b.z) < 1.4 && Math.hypot(near.body.x, near.body.z) > Math.hypot(b.x, b.z) && this.wantsPush(dt);
    return this.toward(rt, dx, dz, { push });
  }
}
