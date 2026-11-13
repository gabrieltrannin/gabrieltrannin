import { POTES, separateBodies, newBody, yardWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Tipo de pote: 0 barro (1 ponto), 1 ouro (3), 2 pólvora (explode, −2). */
type PotKind = 0 | 1 | 2;
interface Pot { key: string; x: number; z: number; kind: PotKind }

const VALUE = [1, 3, -2];

/** Quebra-Potes: empurre os potes para quebrar. */
export class Potes extends Minigame {
  readonly id = 'potes' as const;
  private readonly w = yardWorld(POTES.radius);
  private pots = new Map<string, Pot>();
  private respawn: number[] = [];

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2 + 0.3;
    return { x: Math.cos(a) * 2.5, z: Math.sin(a) * 2.5, face: a };
  }

  protected setup(): void {
    for (let i = 0; i < POTES.count; i++) this.placePot();
  }

  private placePot(): void {
    let spot = this.randomIn(POTES.radius - 1.2);
    for (let k = 0; k < 12; k++) {
      const clear = this.rts.every(r => Math.hypot(r.body.x - spot.x, r.body.z - spot.z) > 2)
        && [...this.pots.values()].every(p => Math.hypot(p.x - spot.x, p.z - spot.z) > 1.8);
      if (clear) break;
      spot = this.randomIn(POTES.radius - 1.2);
    }
    const r = Math.random();
    const kind: PotKind = r < 0.16 ? 1 : r < 0.32 ? 2 : 0;
    const key = this.addEntity('pot', spot.x, 0, spot.z, Math.random() * 6, kind);
    this.pots.set(key, { key, x: spot.x, z: spot.z, kind });
  }

  protected update(dt: number): void {
    // potes fazem volume: o boneco esbarra neles
    const dummy = newBody(0, 0, 0);
    for (const rt of this.alive()) {
      for (const p of this.pots.values()) {
        dummy.x = p.x; dummy.z = p.z; dummy.y = rt.body.y; dummy.vx = 0; dummy.vz = 0;
        if (separateBodies(rt.body, dummy)) {
          // o pote não se mexe: devolve o deslocamento todo ao boneco
          rt.body.x += dummy.x - p.x;
          rt.body.z += dummy.z - p.z;
        }
        if (rt.body.dashT > 0 && Math.hypot(rt.body.x - p.x, rt.body.z - p.z) < POTES.breakRange) this.smash(rt, p);
      }
    }
    this.respawn = this.respawn.map(t => t - dt);
    while (this.respawn.length && this.respawn[0] <= 0) {
      this.respawn.shift();
      this.placePot();
    }
  }

  private smash(rt: Runtime, p: Pot): void {
    if (!this.pots.delete(p.key)) return;
    this.removeEntity(p.key);
    this.respawn.push(0.8 + Math.random() * 0.8);
    const value = VALUE[p.kind];
    rt.score = Math.max(0, rt.score + value);
    if (p.kind === 2) {
      this.fx({ kind: 'explode', x: p.x, y: 0.5, z: p.z, pid: rt.id });
      for (const o of this.alive()) {
        const dx = o.body.x - p.x;
        const dz = o.body.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.6) this.knock(o, dx / (d || 1), dz / (d || 1), 8, 6, 0.8);
      }
    } else {
      this.fx({ kind: 'break', x: p.x, y: 0.6, z: p.z, pid: rt.id, text: `+${value}`, team: p.kind });
    }
  }

  ranking(): string[][] {
    return this.scoreRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const ai = rt.ai;
    ai.retarget -= dt;
    let target = ai.target ? this.pots.get(ai.target) : undefined;
    if (!target || ai.retarget <= 0) {
      let best: Pot | undefined;
      let bestCost = Infinity;
      for (const p of this.pots.values()) {
        // o bot difícil reconhece a pólvora; o fácil às vezes cai
        if (p.kind === 2 && Math.random() < [0.3, 0.75, 0.97][this.level]) continue;
        const cost = Math.hypot(p.x - b.x, p.z - b.z) - (p.kind === 1 ? 4 : 0);
        if (cost < bestCost) { bestCost = cost; best = p; }
      }
      target = best;
      ai.target = best?.key ?? null;
      ai.retarget = this.botReaction + 0.5;
    }
    if (!target) return this.toward(rt, -b.x, -b.z);
    const dx = target.x - b.x;
    const dz = target.z - b.z;
    const d = Math.hypot(dx, dz);
    // perto e de frente: empurrão
    const facing = Math.cos(Math.atan2(dx, dz) - b.face) > 0.8;
    const push = d < 2.2 && facing && b.dashCd <= 0 && Math.random() < 0.5 + this.level * 0.25;
    return this.toward(rt, dx, dz, { push });
  }
}
