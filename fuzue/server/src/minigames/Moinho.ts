import {
  MOINHO, PLAYER_RADIUS, millAngle, millSpeed, millWorld, type PlayerInput, type WorldDef,
} from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Moinho Maluco: pule a pá que gira cada vez mais rápido. */
export class Moinho extends Minigame {
  readonly id = 'moinho' as const;
  private readonly w = millWorld();
  private millKey = '';
  private cd = new Map<string, number>();
  private arms = 1;

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2 + 0.7;
    const x = Math.cos(a) * 4.2;
    const z = Math.sin(a) * 4.2;
    return { x, z, face: Math.atan2(-x, -z) };
  }

  protected setup(): void {
    this.millKey = this.addEntity('mill', 0, 0, 0, 0, 1);
  }

  private angle(): number {
    return millAngle(this.t, this.duration);
  }

  protected update(dt: number): void {
    // segunda pá na metade do jogo
    if (this.arms === 1 && this.t > this.duration * 0.45) this.arms = 2;
    const a = this.angle();
    const speed = millSpeed(this.t, this.duration);
    for (const rt of this.alive()) {
      const b = rt.body;
      if (b.y < MOINHO.killY) { this.eliminate(rt); continue; }
      const cd = Math.max(0, (this.cd.get(rt.id) ?? 0) - dt);
      this.cd.set(rt.id, cd);
      if (cd > 0 || b.y > MOINHO.armTop) continue;
      for (let k = 0; k < this.arms; k++) {
        const ang = a + k * Math.PI;
        const dirx = Math.cos(ang);
        const dirz = Math.sin(ang);
        const proj = b.x * dirx + b.z * dirz;
        if (proj < MOINHO.hubR || proj > MOINHO.armLen) continue;
        const perp = Math.abs(-b.x * dirz + b.z * dirx);
        if (perp > 0.3 + PLAYER_RADIUS) continue;
        // varre na direção em que a pá gira, um pouco para fora
        const kx = -Math.sin(ang) * 0.85 + dirx * 0.5;
        const kz = Math.cos(ang) * 0.85 + dirz * 0.5;
        const kd = Math.hypot(kx, kz);
        this.knock(rt, kx / kd, kz / kd, 4.5 + speed * 1.4, 4.5, 0.45);
        this.cd.set(rt.id, 0.5);
        this.room.broadcast('hit', { attacker: '', target: rt.id, x: b.x, y: b.y, z: b.z });
        break;
      }
    }
  }

  protected mirrorExtra(): void {
    this.setEntity(this.millKey, { a: this.angle(), s: this.arms });
  }

  protected checkOver(): boolean {
    return this.alive().length <= 1;
  }

  ranking(): string[][] {
    return this.eliminationRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const r = Math.hypot(b.x, b.z) || 1;
    // fica no meio do raio, longe da borda e do eixo
    const want = 3.6;
    let dx = (b.x / r) * (want - r);
    let dz = (b.z / r) * (want - r);
    // anda devagar no sentido contrário da pá (ganha tempo para pular)
    dx += (b.z / r) * 0.6;
    dz += (-b.x / r) * 0.6;
    const near = this.nearest(rt, this.alive());
    const push = !!near && Math.hypot(near.body.x - b.x, near.body.z - b.z) < 1.4 && Math.hypot(near.body.x, near.body.z) > r && this.wantsPush(dt);
    let jump = false;
    if (b.grounded) {
      const speed = millSpeed(this.t, this.duration);
      const me = Math.atan2(b.z, b.x);
      const a = this.angle();
      for (let k = 0; k < this.arms; k++) {
        let diff = (me - (a + k * Math.PI)) % (Math.PI * 2);
        if (diff < 0) diff += Math.PI * 2;
        const eta = diff / speed;
        // o pulo fica acima da pá entre ~0,1 s e ~0,6 s depois de sair do chão
        const [lo, hi] = [[0.08, 0.3], [0.12, 0.35], [0.15, 0.4]][this.level];
        if (eta > lo && eta < hi && Math.random() < [0.12, 0.3, 0.5][this.level]) jump = true;
      }
    }
    return this.toward(rt, dx, dz, { jump, push });
  }
}
