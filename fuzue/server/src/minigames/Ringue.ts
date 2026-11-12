import { RING, ringWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Ringue Escorregadio: chão de gelo que encolhe; último de pé vence. */
export class Ringue extends Minigame {
  readonly id = 'ringue' as const;
  private radius: number = RING.startRadius;
  protected knockScale = 0.55;

  world(): WorldDef {
    return ringWorld(this.radius);
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 3.6;
    const z = Math.sin(a) * 3.6;
    return { x, z, face: Math.atan2(-x, -z) };
  }

  protected setup(): void {
    this.mg.radius = this.radius;
  }

  protected update(): void {
    const k = Math.min(1, this.t / (this.duration * 0.75));
    this.radius = RING.startRadius - (RING.startRadius - RING.endRadius) * k;
    for (const rt of this.alive()) if (rt.body.y < RING.killY) this.eliminate(rt);
  }

  protected mirrorExtra(): void {
    this.mg.radius = this.radius;
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
    const others = this.alive().filter(o => o !== rt && o.body.y > -0.5);
    ai.retarget -= dt;
    let target = others.find(o => o.id === ai.target) ?? null;
    if (!target || ai.retarget <= 0) {
      target = this.nearest(rt, others);
      ai.target = target?.id ?? null;
      ai.retarget = this.botReaction + Math.random() * 0.4;
    }
    const d = Math.hypot(b.x, b.z) || 1;
    let dx = target ? target.body.x - b.x : -b.x;
    let dz = target ? target.body.z - b.z : -b.z;
    // perto da borda: volta para o meio antes de qualquer coisa
    // no gelo é preciso frear antes: considera para onde o bot já está deslizando
    const slideX = b.x + b.vx * 0.45;
    const slideZ = b.z + b.vz * 0.45;
    const sd = Math.hypot(slideX, slideZ) || 1;
    const edge = this.radius - Math.max(d, sd);
    if (edge < 3) {
      const w = (3 - edge) * 3;
      dx += (-slideX / sd) * w;
      dz += (-slideZ / sd) * w;
    }
    const dist = target ? Math.hypot(target.body.x - b.x, target.body.z - b.z) : 99;
    // só empurra quem está mais perto da borda (para jogar para fora, não para dentro)
    const outward = target ? Math.hypot(target.body.x, target.body.z) > d - 0.3 : false;
    const push = dist < 1.6 && edge > 1.5 && outward && this.wantsPush(dt * 0.7);
    return this.toward(rt, dx, dz, { push });
  }
}
