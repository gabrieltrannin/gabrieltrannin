import { TRONO, yardWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

/** Trono Disputado: pontua quem estiver sozinho no círculo; o círculo muda de lugar. */
export class Trono extends Minigame {
  readonly id = 'trono' as const;
  private readonly w = yardWorld(TRONO.radius);
  private zone = { x: 0, z: 0 };
  private zoneKey = '';
  private nextMove = TRONO.moveEvery;
  private time = new Map<string, number>();
  private owner = '';

  world(): WorldDef {
    return this.w;
  }

  spawn(i: number, n: number): Spawn {
    const a = (i / n) * Math.PI * 2 + 0.8;
    const x = Math.cos(a) * 6.5;
    const z = Math.sin(a) * 6.5;
    return { x, z, face: Math.atan2(-x, -z) };
  }

  protected setup(): void {
    this.zoneKey = this.addEntity('zone', 0, 0, 0, 0, TRONO.zoneR);
  }

  private inside(rt: Runtime): boolean {
    return rt.body.y > -0.3 && Math.hypot(rt.body.x - this.zone.x, rt.body.z - this.zone.z) < TRONO.zoneR;
  }

  protected update(dt: number): void {
    const every = TRONO.moveEvery * (this.duration / 50);
    if (this.t >= this.nextMove) {
      this.nextMove += every;
      // longe do lugar anterior
      let spot = this.randomIn(TRONO.radius - TRONO.zoneR - 0.8);
      for (let k = 0; k < 8 && Math.hypot(spot.x - this.zone.x, spot.z - this.zone.z) < 5; k++) spot = this.randomIn(TRONO.radius - TRONO.zoneR - 0.8);
      this.zone = spot;
      this.fx({ kind: 'score', x: spot.x, y: 1.5, z: spot.z, text: 'O trono mudou!' });
    }
    const inside = this.alive().filter(r => this.inside(r));
    const owner = inside.length === 1 ? inside[0] : null;
    this.owner = owner?.id ?? '';
    if (owner) {
      const v = (this.time.get(owner.id) ?? 0) + dt;
      this.time.set(owner.id, v);
      owner.score = Math.floor(v);
    }
  }

  protected mirrorExtra(): void {
    const left = Math.max(0, this.nextMove - this.t);
    this.setEntity(this.zoneKey, { x: this.zone.x, z: this.zone.z, a: left });
    this.mg.holder = this.owner;
  }

  ranking(): string[][] {
    return this.scoreRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const z = this.zone;
    const dx = z.x - b.x;
    const dz = z.z - b.z;
    const dist = Math.hypot(dx, dz);
    const others = this.alive().filter(o => o !== rt && this.inside(o));
    if (dist < TRONO.zoneR - 0.4 && others.length) {
      // tem alguém no trono: empurra para fora (de dentro para a borda)
      const t = this.nearest(rt, others)!;
      const tx = t.body.x - b.x;
      const tz = t.body.z - b.z;
      const push = Math.hypot(tx, tz) < 1.6 && this.wantsPush(dt * 0.7);
      return this.toward(rt, tx + (t.body.x - z.x) * 0.3, tz + (t.body.z - z.z) * 0.3, { push });
    }
    if (dist < TRONO.zoneR * 0.45) return { x: 0, z: 0, push: false, jump: false };
    const near = this.nearest(rt, this.alive());
    const push = !!near && Math.hypot(near.body.x - b.x, near.body.z - b.z) < 1.5 && this.wantsPush(dt);
    return this.toward(rt, dx, dz, { push });
  }
}
