import {
  MINIGAMES, PLAYER_RADIUS, RACE,
  raceWorld, sweeperAngle, type PlayerInput, type WorldDef,
} from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Corrida Doce: até a linha de chegada, com buracos, esteira e martelos. */
export class Corrida extends Minigame {
  readonly id = 'corrida' as const;
  private readonly w = raceWorld();
  private progress = new Map<string, number>();
  private checkpoint = new Map<string, number>();
  private finishOrder: string[] = [];
  private firstFinishT = -1;
  private sweeperCd = new Map<string, number>();
  private sweeperKeys: string[] = [];

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number): Spawn {
    return { x: -2.4 + i * 1.6, z: 2.5, face: Math.PI };
  }

  protected setup(): void {
    RACE.sweepers.forEach((s, i) => {
      this.sweeperKeys.push(this.addEntity('sweeper', 0, 0.9, s.z, sweeperAngle(i, 0), s.speed));
    });
    for (const rt of this.rts) {
      this.progress.set(rt.id, rt.body.z);
      this.checkpoint.set(rt.id, 0);
    }
  }

  protected update(dt: number): void {
    this.sweeperKeys.forEach((key, i) => {
      const e = this.mg.entities.get(key);
      if (e) e.a = sweeperAngle(i, this.t);
    });

    for (const rt of this.rts) {
      if (!rt.alive || rt.finished) continue;
      const b = rt.body;
      this.progress.set(rt.id, Math.min(this.progress.get(rt.id) ?? b.z, b.z));
      RACE.checkpoints.forEach((cz, ci) => {
        if (b.z <= cz && ci > (this.checkpoint.get(rt.id) ?? 0)) this.checkpoint.set(rt.id, ci);
      });

      // martelos
      const cd = Math.max(0, (this.sweeperCd.get(rt.id) ?? 0) - dt);
      this.sweeperCd.set(rt.id, cd);
      if (cd <= 0 && b.y < 1.3) {
        RACE.sweepers.forEach((s, i) => {
          const a = sweeperAngle(i, this.t);
          const dirx = Math.cos(a);
          const dirz = Math.sin(a);
          const rx = b.x;
          const rz = b.z - s.z;
          const proj = Math.max(-RACE.sweeperLength, Math.min(RACE.sweeperLength, rx * dirx + rz * dirz));
          const cx = dirx * proj;
          const cz = dirz * proj;
          if (Math.hypot(rx - cx, rz - cz) > 0.35 + PLAYER_RADIUS || Math.abs(proj) < 0.4) return;
          // direção em que a barra está varrendo naquele ponto
          let kx = -Math.sin(a) * proj * s.speed;
          let kz = Math.cos(a) * proj * s.speed;
          const kd = Math.hypot(kx, kz) || 1;
          kx /= kd; kz /= kd;
          this.knock(rt, kx, kz, 6.5, 4, 0.45);
          this.sweeperCd.set(rt.id, 0.6);
          this.room.broadcast('hit', { attacker: '', target: rt.id, x: b.x, y: b.y, z: b.z });
        });
      }

      if (b.y < RACE.killY) {
        const cz = RACE.checkpoints[this.checkpoint.get(rt.id) ?? 0];
        b.x = (Math.random() - 0.5) * 3;
        b.y = 0.6;
        b.z = cz;
        b.vx = 0; b.vy = 0; b.vz = 0;
        b.face = Math.PI;
        b.stunT = 0.25;
        this.fx({ kind: 'fall', x: b.x, y: b.y, z: b.z, pid: rt.id });
        continue;
      }

      if (b.z <= RACE.finishZ) {
        rt.finished = true;
        rt.score = this.finishOrder.length + 1;
        this.finishOrder.push(rt.id);
        if (this.firstFinishT < 0) this.firstFinishT = this.t;
        b.vx = 0; b.vz = 0;
        this.fx({ kind: 'finish', x: b.x, y: b.y, z: b.z, pid: rt.id });
      }
    }
  }

  protected checkOver(): boolean {
    if (this.rts.every(r => r.finished)) return true;
    const grace = 12 * (this.duration / MINIGAMES.corrida.duration);
    return this.firstFinishT >= 0 && this.t - this.firstFinishT > grace;
  }

  ranking(): string[][] {
    const groups: string[][] = this.finishOrder.map(id => [id]);
    const rest = this.rts.filter(r => !r.finished)
      .map(r => ({ id: r.id, p: Math.round((this.progress.get(r.id) ?? 0) * 2) / 2 }))
      .sort((a, b) => a.p - b.p);
    rest.forEach((r, i) => {
      if (i > 0 && rest[i - 1].p === r.p) groups[groups.length - 1].push(r.id);
      else groups.push([r.id]);
    });
    return groups;
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    let dx = 0;
    const dz = -1;
    // desvia dos pinos à frente
    for (const p of RACE.bumpers) {
      const ahead = b.z - p.z;
      if (ahead > 0 && ahead < 3.2 && Math.abs(b.x - p.x) < p.r + 0.9) dx += b.x >= p.x ? 1.4 : -1.4;
    }
    dx += -b.x * 0.15; // tende ao meio da pista
    rt.ai.timer -= dt;
    if (rt.ai.timer <= 0) {
      rt.ai.timer = 0.8 + Math.random();
      rt.ai.goal = { x: (Math.random() - 0.5) * (this.level === 2 ? 1 : 3), z: 0 };
    }
    dx += ((rt.ai.goal?.x ?? 0) - b.x) * 0.2;
    let jump = false;
    if (b.grounded) {
      const gapAhead = this.w.ground(b.x, b.z - 1.1, b.y) === null;
      jump = gapAhead && Math.random() < [0.55, 0.9, 1][this.level];
    }
    const near = this.rts.some(o => o !== rt && !o.finished && Math.hypot(o.body.x - b.x, o.body.z - b.z) < 1.3);
    return this.toward(rt, dx, dz, { jump, push: near && this.wantsPush(dt) });
  }
}
