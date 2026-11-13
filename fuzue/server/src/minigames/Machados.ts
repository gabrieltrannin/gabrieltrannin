import { MACHADOS, PLAYER_RADIUS, axeWorld, axeX, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Race } from './Race.js';
import type { Runtime, Spawn } from './Minigame.js';

/** Corredor dos Machados: passarela estreita com pêndulos e buracos. */
export class Machados extends Race {
  readonly id = 'machados' as const;
  protected readonly finishZ = MACHADOS.finishZ;
  protected readonly checkpoints = MACHADOS.checkpoints;
  protected readonly killY = MACHADOS.killY;
  private readonly w = axeWorld();
  private keys: string[] = [];
  private hitCd = new Map<string, number>();

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number): Spawn {
    return { x: -1.2 + (i % 2) * 2.4, z: 2.6 - Math.floor(i / 2) * 1.3, face: Math.PI };
  }

  protected setup(): void {
    MACHADOS.axes.forEach((a, i) => this.keys.push(this.addEntity('axe', axeX(i, 0), 0, a.z, 0, a.speed)));
  }

  protected obstacles(): void {
    MACHADOS.axes.forEach((ax, i) => {
      const x = axeX(i, this.t);
      // velocidade da lâmina: para que lado ela está indo
      const vx = Math.cos(ax.phase + ax.speed * this.t) * ax.speed * MACHADOS.swing;
      this.setEntity(this.keys[i], { x, a: Math.asin(Math.max(-1, Math.min(1, x / MACHADOS.swing))) * 0.55 });
      for (const rt of this.rts) {
        if (!rt.alive || rt.finished) continue;
        const b = rt.body;
        if ((this.hitCd.get(rt.id) ?? 0) > this.t || b.y > 2) continue;
        if (Math.abs(b.z - ax.z) > 0.25 + PLAYER_RADIUS || Math.abs(b.x - x) > 0.35 + PLAYER_RADIUS) continue;
        this.knock(rt, Math.sign(vx) || 1, 0.15, 7 + Math.abs(vx) * 0.6, 4, 0.5);
        this.hitCd.set(rt.id, this.t + 0.6);
        this.room.broadcast('hit', { attacker: '', target: rt.id, x: b.x, y: b.y, z: b.z });
      }
    });
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    let dz = -1;
    let dx = -b.x * 0.6;
    // machado logo à frente: espera ele passar para o outro lado
    for (let i = 0; i < MACHADOS.axes.length; i++) {
      const ax = MACHADOS.axes[i];
      const ahead = b.z - ax.z;
      if (ahead < 0.2 || ahead > 2.2) continue;
      const x = axeX(i, this.t);
      const vx = Math.cos(ax.phase + ax.speed * this.t);
      // a lâmina está saindo do meio: dá para passar
      const leaving = Math.abs(x) > 0.9 && Math.sign(vx) === Math.sign(x);
      const careful = Math.random() < [0.5, 0.85, 1][this.level];
      if (!leaving && careful) dz = ahead > 1.4 ? -0.15 : 0.6;
    }
    let jump = false;
    if (b.grounded) {
      const gap = this.w.ground(b.x, b.z - 1.1, b.y) === null;
      jump = gap && Math.random() < [0.55, 0.9, 1][this.level];
    }
    const near = this.rts.some(o => o !== rt && !o.finished && Math.hypot(o.body.x - b.x, o.body.z - b.z) < 1.2);
    return this.toward(rt, dx, dz, { jump, push: near && this.wantsPush(dt * 0.6) });
  }
}
