import {
  HEX, HEX_PER_LAYER, HEX_TILES, TILE_CRACK, TILE_GONE, TILE_OK,
  hexIndexAt, hexWorld, type PlayerInput, type WorldDef,
} from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Chão que Some: pisos caem logo depois de pisados; dois andares. */
export class Hexa extends Minigame {
  readonly id = 'hexa' as const;
  private tiles: number[] = new Array(HEX.layers.length * HEX_PER_LAYER).fill(TILE_OK);
  private crackAt = new Map<number, number>();
  private changed = new Set<number>();

  world(): WorldDef {
    return hexWorld(this.tiles);
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const x = Math.cos(a) * 4.2;
    const z = Math.sin(a) * 4.2;
    return { x, z, face: Math.atan2(-x, -z) };
  }

  protected setup(): void {
    for (const v of this.tiles) this.mg.tiles.push(v);
  }

  private layerOf(y: number): number {
    let best = 0;
    HEX.layers.forEach((h, i) => { if (Math.abs(y - h) < Math.abs(y - HEX.layers[best])) best = i; });
    return best;
  }

  protected update(): void {
    for (const rt of this.alive()) {
      const b = rt.body;
      if (b.grounded) {
        const i = hexIndexAt(b.x, b.z);
        if (i >= 0) {
          const k = this.layerOf(b.y) * HEX_PER_LAYER + i;
          if (this.tiles[k] === TILE_OK) {
            this.tiles[k] = TILE_CRACK;
            this.crackAt.set(k, this.t);
            this.changed.add(k);
          }
        }
      }
      if (b.y < HEX.killY) this.eliminate(rt);
    }
    for (const [k, at] of this.crackAt) {
      if (this.t - at >= HEX.crackTime) {
        this.tiles[k] = TILE_GONE;
        this.crackAt.delete(k);
        this.changed.add(k);
      }
    }
  }

  protected mirrorExtra(): void {
    for (const k of this.changed) this.mg.tiles[k] = this.tiles[k];
    this.changed.clear();
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
    const layer = this.layerOf(b.y);
    const base = layer * HEX_PER_LAYER;
    ai.retarget -= dt;
    const goalOk = ai.goal && this.tiles[base + hexIndexAt(ai.goal.x, ai.goal.z)] === TILE_OK;
    const reached = ai.goal && Math.hypot(ai.goal.x - b.x, ai.goal.z - b.z) < 0.7;
    if (!ai.goal || !goalOk || reached || ai.retarget <= 0) {
      const others = this.alive().filter(o => o !== rt);
      const options = HEX_TILES
        .map((t, i) => ({ t, i, d: Math.hypot(t.x - b.x, t.z - b.z) }))
        .filter(o => this.tiles[base + o.i] === TILE_OK && o.d > 1.6 && o.d < 5.5)
        .map(o => ({ ...o, crowd: Math.min(...others.map(p => Math.hypot(p.body.x - o.t.x, p.body.z - o.t.z)), 9) }))
        .sort((p, q) => (q.crowd - q.d * 0.3) - (p.crowd - p.d * 0.3));
      const pickFrom = options.slice(0, this.level === 0 ? 8 : 3);
      const choice = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      ai.goal = choice ? { x: choice.t.x, z: choice.t.z } : { x: 0, z: 0 };
      ai.retarget = 1.2 + Math.random();
    }
    const dx = ai.goal.x - b.x;
    const dz = ai.goal.z - b.z;
    const d = Math.hypot(dx, dz) || 1;
    // buraco logo à frente e chão depois dele: pula
    let jump = false;
    if (b.grounded) {
      const w = this.world();
      const ahead = w.ground(b.x + (dx / d) * 1.0, b.z + (dz / d) * 1.0, b.y);
      const beyond = w.ground(b.x + (dx / d) * 2.6, b.z + (dz / d) * 2.6, b.y);
      jump = ahead === null && beyond !== null && Math.random() < [0.5, 0.85, 1][this.level];
    }
    const push = this.wantsPush(dt) && this.alive().some(o => o !== rt && Math.hypot(o.body.x - b.x, o.body.z - b.z) < 1.4);
    return this.toward(rt, dx, dz, { jump, push });
  }
}
