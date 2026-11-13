import { Minigame, type Runtime } from './Minigame.js';

/**
 * Base das corridas em direção a −z: guarda o progresso de cada um, a
 * ordem de chegada, renasce quem cai no último ponto de controle.
 */
export abstract class Race extends Minigame {
  protected abstract readonly finishZ: number;
  protected abstract readonly checkpoints: readonly number[];
  protected abstract readonly killY: number;
  private progress = new Map<string, number>();
  private checkpoint = new Map<string, number>();
  private finishOrder: string[] = [];
  private firstFinishT = -1;

  /** Altura do chão no ponto de controle (corridas planas: 0). */
  protected respawnY(_z: number): number {
    return 0;
  }

  /** Chamado a cada tick para quem ainda está correndo. */
  protected runner(rt: Runtime): void {
    const b = rt.body;
    this.progress.set(rt.id, Math.min(this.progress.get(rt.id) ?? b.z, b.z));
    this.checkpoints.forEach((cz, ci) => {
      if (b.z <= cz && ci > (this.checkpoint.get(rt.id) ?? 0)) this.checkpoint.set(rt.id, ci);
    });
    if (b.y < this.killY) {
      const cz = this.checkpoints[this.checkpoint.get(rt.id) ?? 0];
      Object.assign(b, { x: (Math.random() - 0.5) * 2, y: this.respawnY(cz) + 0.6, z: cz, vx: 0, vy: 0, vz: 0, face: Math.PI, stunT: 0.25 });
      this.fx({ kind: 'fall', x: b.x, y: b.y, z: b.z, pid: rt.id });
      return;
    }
    if (b.z <= this.finishZ) {
      rt.finished = true;
      rt.score = this.finishOrder.length + 1;
      this.finishOrder.push(rt.id);
      if (this.firstFinishT < 0) this.firstFinishT = this.t;
      b.vx = 0; b.vz = 0;
      this.fx({ kind: 'finish', x: b.x, y: b.y, z: b.z, pid: rt.id });
    }
  }

  protected update(dt: number): void {
    this.obstacles(dt);
    for (const rt of this.rts) if (rt.alive && !rt.finished) this.runner(rt);
  }

  protected abstract obstacles(dt: number): void;

  protected checkOver(): boolean {
    if (this.rts.every(r => r.finished)) return true;
    return this.firstFinishT >= 0 && this.t - this.firstFinishT > 12 * (this.duration / 70);
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
}
