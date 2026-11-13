import { LAVA, LAVA_COLUMNS, lavaLevel, lavaWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Maré de Lava: escale as colunas antes que a lava suba. */
export class Lava extends Minigame {
  readonly id = 'lava' as const;
  private readonly w = lavaWorld();

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2 + 1.9;
    const x = Math.cos(a) * 8.3;
    const z = Math.sin(a) * 8.3;
    return { x, z, face: Math.atan2(-x, -z) };
  }

  protected update(): void {
    const level = lavaLevel(this.t, this.duration);
    this.mg.radius = level;
    for (const rt of this.alive()) {
      if (rt.body.y < level - LAVA.killMargin) this.eliminate(rt);
    }
  }

  protected checkOver(): boolean {
    return this.alive().length <= 1;
  }

  ranking(): string[][] {
    return this.eliminationRanking();
  }

  /** Coluna mais alta debaixo do bot (−1 = chão). */
  private columnUnder(x: number, z: number, y: number): number {
    let best = -1;
    LAVA_COLUMNS.forEach((c, i) => {
      if (Math.abs(c.h - y) < 0.2 && Math.hypot(x - c.x, z - c.z) <= c.r + 0.05 && (best < 0 || c.h > LAVA_COLUMNS[best].h)) best = i;
    });
    return best;
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const ai = rt.ai;
    const here = b.grounded ? this.columnUnder(b.x, b.z, b.y) : -2;
    const top = LAVA_COLUMNS.length - 1;
    if (here !== -2) {
      // próxima coluna: um degrau acima, a mais perto (o topo quando possível)
      const curH = here >= 0 ? LAVA_COLUMNS[here].h : 0;
      let best = -1;
      let bd = Infinity;
      LAVA_COLUMNS.forEach((c, i) => {
        if (c.h <= curH + 0.05 || c.h > curH + 0.75) return;
        const d = Math.hypot(c.x - b.x, c.z - b.z) - c.r;
        if (d < bd) { bd = d; best = i; }
      });
      if (here === top) best = top;
      ai.goal = best >= 0 ? { x: LAVA_COLUMNS[best].x, z: LAVA_COLUMNS[best].z } : ai.goal;
      ai.target = String(best);
    }
    if (!ai.goal) return this.toward(rt, -b.x, -b.z);
    const goal = LAVA_COLUMNS[Number(ai.target)] ?? LAVA_COLUMNS[0];
    const dx = ai.goal.x - b.x;
    const dz = ai.goal.z - b.z;
    const d = Math.hypot(dx, dz);
    // pula na beirada da coluna atual (ou quando a próxima está pertinho)
    let jump = false;
    if (b.grounded && goal.h > b.y + 0.05 && d > 0.01) {
      const ahead = this.w.ground(b.x + (dx / d) * 0.75, b.z + (dz / d) * 0.75, b.y);
      const atEdge = ahead === null || ahead < b.y - 0.1;
      jump = (atEdge || d - goal.r < 0.9) && Math.random() < [0.45, 0.8, 0.97][this.level];
    }
    // no topo: empurra quem chegar
    const near = this.nearest(rt, this.alive());
    const push = here === top && !!near && Math.hypot(near.body.x - b.x, near.body.z - b.z) < 1.5 && this.wantsPush(dt);
    // devagar o bastante para não passar da coluna
    const slow = here === top || (d < goal.r * 0.5 && goal.h <= b.y + 0.05);
    const s = slow ? 0.25 : 1;
    const inp = this.toward(rt, dx, dz, { jump, push });
    return { ...inp, x: inp.x * s, z: inp.z * s };
  }
}
