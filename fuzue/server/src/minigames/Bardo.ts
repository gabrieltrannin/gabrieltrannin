import {
  BARDO, BARDO_GONE, gridCenter, gridIndexAt, gridWorld, type PlayerInput, type WorldDef,
} from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** O Bardo Manda: só o chão da cor cantada fica de pé. */
export class Bardo extends Minigame {
  readonly id = 'bardo' as const;
  private tiles: number[] = this.shuffleColors();
  private readonly w = gridWorld(BARDO, this.tiles, t => t < BARDO_GONE);
  private bardKey = '';
  /** 'call': cor anunciada, contando; 'drop': os outros pisos sumiram. */
  private phase: 'call' | 'drop' = 'call';
  private color = 0;
  private timer = 0;
  private round = 0;
  private changed = new Set<number>();

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number): Spawn {
    const spots = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
    const [x, z] = spots[i % 4];
    return { x, z, face: Math.atan2(-x, -z) };
  }

  /** Cores espalhadas em blocos 2×2 com todas as cores bem distribuídas. */
  private shuffleColors(): number[] {
    const n = BARDO.n;
    const out = new Array(n * n).fill(0);
    for (let bz = 0; bz < n; bz += 2) {
      for (let bx = 0; bx < n; bx += 2) {
        const c = Math.floor(Math.random() * BARDO.colors);
        for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) out[(bz + dz) * n + bx + dx] = (c + (Math.random() < 0.25 ? 1 + Math.floor(Math.random() * 3) : 0)) % BARDO.colors;
      }
    }
    return out;
  }

  protected setup(): void {
    for (const v of this.tiles) this.mg.tiles.push(v);
    this.bardKey = this.addEntity('bard', 0, 0, -BARDO.n * BARDO.cell / 2 - 2.2, 0, -1);
    this.startCall();
    this.timer += 1.5;
  }

  private callTime(): number {
    return Math.max(1.6, 3.4 - this.round * 0.18) * Math.max(0.6, this.duration / 70);
  }

  private startCall(): void {
    this.phase = 'call';
    this.color = Math.floor(Math.random() * BARDO.colors);
    this.timer = this.callTime();
    this.round++;
  }

  protected update(dt: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.phase === 'call') {
        this.phase = 'drop';
        this.timer = 1.6;
        this.tiles.forEach((v, i) => { if (v !== this.color) { this.tiles[i] = v + BARDO_GONE; this.changed.add(i); } });
      } else {
        const fresh = this.shuffleColors();
        fresh.forEach((v, i) => { this.tiles[i] = v; this.changed.add(i); });
        this.startCall();
      }
    }
    for (const rt of this.alive()) if (rt.body.y < BARDO.killY) this.eliminate(rt);
  }

  protected mirrorExtra(): void {
    for (const i of this.changed) this.mg.tiles[i] = this.tiles[i];
    this.changed.clear();
    this.setEntity(this.bardKey, { s: this.color, a: this.phase === 'call' ? Math.max(0, this.timer) : -1 });
  }

  protected checkOver(): boolean {
    return this.alive().length <= 1;
  }

  ranking(): string[][] {
    return this.eliminationRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const ai = rt.ai;
    ai.retarget -= dt;
    const here = gridIndexAt(BARDO, b.x, b.z);
    // reação: o bot leva um tempinho para "ouvir" a cor
    const heard = this.phase === 'drop' || this.callTime() - this.timer > [0.9, 0.5, 0.25][this.level];
    const wrongColor = this.level === 0 && Math.random() < 0.002;
    if (heard && (ai.retarget <= 0 || !ai.goal || this.tiles[gridIndexAt(BARDO, ai.goal.x, ai.goal.z)] !== this.color)) {
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < this.tiles.length; i++) {
        if (this.tiles[i] !== (wrongColor ? (this.color + 1) % BARDO.colors : this.color)) continue;
        const c = gridCenter(BARDO, i);
        const crowd = this.alive().filter(o => o !== rt && Math.hypot(o.body.x - c.x, o.body.z - c.z) < 1.2).length;
        const d = Math.hypot(c.x - b.x, c.z - b.z) + crowd * 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) ai.goal = gridCenter(BARDO, best);
      ai.retarget = 0.6;
    }
    if (!heard) {
      // espera perto do meio
      return this.toward(rt, -b.x * 0.3, -b.z * 0.3);
    }
    if (!ai.goal) return { x: 0, z: 0, push: false, jump: false };
    const dx = ai.goal.x - b.x;
    const dz = ai.goal.z - b.z;
    if (Math.hypot(dx, dz) < 0.35 && here >= 0) return { x: 0, z: 0, push: false, jump: false };
    const near = this.nearest(rt, this.alive());
    const push = this.phase === 'call' && !!near && Math.hypot(near.body.x - b.x, near.body.z - b.z) < 1.3 && this.wantsPush(dt * 0.5);
    return this.toward(rt, dx, dz, { push });
  }
}
