import { LADEIRA, slopeHeight, slopeWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Race } from './Race.js';
import type { Runtime, Spawn } from './Minigame.js';

interface Barrel { key: string; x: number; z: number; vz: number; spin: number }

/** Ladeira dos Barris: suba desviando dos barris que rolam. */
export class Ladeira extends Race {
  readonly id = 'ladeira' as const;
  protected readonly finishZ = LADEIRA.finishZ;
  protected readonly checkpoints = [2] as const;
  protected readonly killY = LADEIRA.killY;
  private readonly w = slopeWorld();
  private barrels = new Map<string, Barrel>();
  private nextBarrel = 0.5;
  private hitCd = new Map<string, number>();

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number): Spawn {
    return { x: -2.4 + i * 1.6, z: 3, face: Math.PI };
  }

  private y(z: number): number {
    return (slopeHeight(z) ?? 0) + LADEIRA.barrelR;
  }

  protected obstacles(dt: number): void {
    const k = this.t / this.duration;
    if (this.t >= this.nextBarrel) {
      const lanes = [-3, -1.5, 0, 1.5, 3];
      const x = lanes[Math.floor(Math.random() * lanes.length)] + (Math.random() - 0.5) * 0.6;
      const z = -64;
      const key = this.addEntity('barrel', x, this.y(z), z, 0);
      this.barrels.set(key, { key, x, z, vz: 6 + Math.random() * 3 + k * 2, spin: 0 });
      this.nextBarrel += 1.0 - 0.4 * k;
    }
    for (const bl of [...this.barrels.values()]) {
      // mais rápido na descida
      const slope = (slopeHeight(bl.z - 0.5) ?? 0) - (slopeHeight(bl.z + 0.5) ?? 0);
      bl.vz = Math.min(11, bl.vz + slope * 7 * dt);
      bl.z += bl.vz * dt;
      bl.spin += (bl.vz / LADEIRA.barrelR) * dt;
      if (bl.z > 6) {
        this.barrels.delete(bl.key);
        this.removeEntity(bl.key);
        continue;
      }
      const by = this.y(bl.z);
      this.setEntity(bl.key, { z: bl.z, y: by, a: bl.spin });
      for (const rt of this.rts) {
        if (!rt.alive || rt.finished) continue;
        const b = rt.body;
        if ((this.hitCd.get(rt.id) ?? 0) > this.t) continue;
        if (Math.abs(b.x - bl.x) > 1.25 || Math.abs(b.z - bl.z) > 0.9) continue;
        if (b.y > by + LADEIRA.barrelR - 0.15) continue; // pulou por cima
        this.knock(rt, (b.x - bl.x) * 0.3, 1, 5 + bl.vz * 0.2, 4.5, 0.4);
        this.hitCd.set(rt.id, this.t + 0.6);
        this.room.broadcast('hit', { attacker: '', target: rt.id, x: b.x, y: b.y, z: b.z });
      }
    }
  }

  protected respawnY(z: number): number {
    return slopeHeight(z) ?? 0;
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    let dx = -b.x * 0.1;
    let jump = false;
    const look = [3, 4.5, 6][this.level];
    for (const bl of this.barrels.values()) {
      const ahead = b.z - bl.z;
      if (ahead < -0.5 || ahead > look) continue;
      if (Math.abs(bl.x - b.x) > 1.4) continue;
      const eta = ahead / (bl.vz + 6);
      // de lado se der tempo; senão pula
      if (eta > 0.45) dx += b.x > bl.x ? 2.5 : -2.5;
      else if (eta < 0.28 && b.grounded && Math.random() < [0.4, 0.8, 0.95][this.level]) jump = true;
    }
    const near = this.rts.some(o => o !== rt && !o.finished && Math.hypot(o.body.x - b.x, o.body.z - b.z) < 1.3);
    return this.toward(rt, dx, -1, { jump, push: near && this.wantsPush(dt * 0.5) });
  }
}
