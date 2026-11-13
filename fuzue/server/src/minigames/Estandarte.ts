import { ESTANDARTE, soccerWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

interface Flag {
  key: string;
  team: number;
  x: number; z: number; y: number;
  carrier: string;
  /** Caído no chão desde (s), ou −1 se está na base ou sendo carregado. */
  droppedAt: number;
}

/** Base do time: time 0 à esquerda (x < 0). */
function base(team: number): { x: number; z: number } {
  return { x: team === 0 ? -ESTANDARTE.baseX : ESTANDARTE.baseX, z: 0 };
}

/** Captura do Estandarte 2v2. */
export class Estandarte extends Minigame {
  readonly id = 'estandarte' as const;
  private readonly w = soccerWorld();
  private flags: Flag[] = [];
  private blocked = new Map<string, number>();

  world(): WorldDef {
    return this.w;
  }

  spawn(_i: number, _n: number, id: string): Spawn {
    const team = this.teamOf(id);
    const slot = this.slotOf(id);
    const b = base(team);
    return { x: b.x + (team === 0 ? 2 : -2), z: slot === 0 ? 2.5 : -2.5, team, face: team === 0 ? Math.PI / 2 : -Math.PI / 2 };
  }

  protected setup(): void {
    this.mg.teamScore.push(0);
    this.mg.teamScore.push(0);
    for (const team of [0, 1]) {
      const b = base(team);
      this.flags.push({ key: this.addEntity('flag', b.x, 0, b.z, 0, team), team, x: b.x, z: b.z, y: 0, carrier: '', droppedAt: -1 });
    }
  }

  private home(f: Flag): void {
    const b = base(f.team);
    Object.assign(f, { x: b.x, z: b.z, y: 0, carrier: '', droppedAt: -1 });
  }

  private atHome(f: Flag): boolean {
    const b = base(f.team);
    return !f.carrier && f.droppedAt < 0 && f.x === b.x && f.z === b.z;
  }

  private carrying(rt: Runtime): Flag | undefined {
    return this.flags.find(f => f.carrier === rt.id);
  }

  protected update(): void {
    for (const f of this.flags) {
      if (f.carrier) {
        const c = this.rt(f.carrier);
        if (!c) { this.home(f); continue; }
        f.x = c.body.x; f.z = c.body.z; f.y = c.body.y + 0.4;
        // levou para a própria base, com o próprio estandarte lá: ponto!
        const own = this.flags.find(o => o.team === c.team)!;
        const b = base(c.team);
        if (Math.hypot(c.body.x - b.x, c.body.z - b.z) < ESTANDARTE.homeR && this.atHome(own)) {
          this.addTeamPoint(c.team);
          this.fx({ kind: 'score', x: b.x, y: 2.4, z: b.z, team: c.team, pid: c.id, text: '+1' });
          this.home(f);
        }
        continue;
      }
      if (f.droppedAt >= 0 && this.t - f.droppedAt > ESTANDARTE.returnAfter) {
        this.home(f);
        continue;
      }
      for (const rt of this.alive()) {
        if (rt.body.stunT > 0 || this.carrying(rt) || (this.blocked.get(rt.id) ?? 0) > this.t) continue;
        if (Math.hypot(rt.body.x - f.x, rt.body.z - f.z) > ESTANDARTE.grabR) continue;
        if (rt.team === f.team) {
          // o próprio estandarte caído: devolve para a base
          if (f.droppedAt >= 0) { this.home(f); this.fx({ kind: 'grab', x: rt.body.x, y: 1.8, z: rt.body.z, pid: rt.id, text: 'Salvo!' }); }
          continue;
        }
        f.carrier = rt.id;
        f.droppedAt = -1;
        this.fx({ kind: 'grab', x: rt.body.x, y: 1.8, z: rt.body.z, pid: rt.id, team: rt.team, text: 'Peguei!' });
        break;
      }
    }
    for (const rt of this.rts) rt.body.boost = this.carrying(rt) ? ESTANDARTE.carryBoost : 1;
  }

  protected onHit(_a: Runtime, target: Runtime): void {
    const f = this.carrying(target);
    if (!f) return;
    f.carrier = '';
    f.droppedAt = this.t;
    f.y = 0;
    this.blocked.set(target.id, this.t + 1);
    this.fx({ kind: 'drop', x: f.x, y: 1.6, z: f.z, pid: target.id });
  }

  protected mirrorExtra(): void {
    for (const f of this.flags) this.setEntity(f.key, { x: f.x, y: f.y, z: f.z, a: f.carrier ? 1 : f.droppedAt >= 0 ? 2 : 0 });
  }

  ranking(): string[][] {
    return this.teamRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const mine = this.flags[rt.team];
    const theirs = this.flags[1 - rt.team];
    const myBase = base(rt.team);
    const carried = this.carrying(rt);
    if (carried) {
      const away = this.repel(rt, this.alive().filter(o => o.team !== rt.team).map(o => o.body), 2.5, 1.5);
      return this.toward(rt, myBase.x - b.x + away.x, myBase.z - b.z + away.z);
    }
    // alguém levando o nosso: persegue e empurra
    const thief = mine.carrier ? this.rt(mine.carrier) : undefined;
    const mate = this.rts.find(o => o !== rt && o.team === rt.team);
    const defender = this.slotOf(rt.id) === 1 || !mate;
    if (thief && (defender || Math.hypot(thief.body.x - b.x, thief.body.z - b.z) < 6)) {
      const dx = thief.body.x + thief.body.vx * 0.3 - b.x;
      const dz = thief.body.z + thief.body.vz * 0.3 - b.z;
      return this.toward(rt, dx, dz, { push: Math.hypot(dx, dz) < 2 && this.wantsPush(dt * 1.6) });
    }
    // o nosso caído: vai salvar
    if (mine.droppedAt >= 0) return this.toward(rt, mine.x - b.x, mine.z - b.z);
    if (defender && this.level > 0 && !theirs.carrier) {
      // fica entre a própria base e o atacante mais perto
      const enemy = this.nearest(rt, this.alive().filter(o => o.team !== rt.team));
      const gx = enemy ? (myBase.x + enemy.body.x) / 2 : myBase.x * 0.7;
      const gz = enemy ? (myBase.z + enemy.body.z) / 2 : 0;
      const push = !!enemy && Math.hypot(enemy.body.x - b.x, enemy.body.z - b.z) < 1.6 && this.wantsPush(dt);
      return this.toward(rt, gx - b.x, gz - b.z, { push });
    }
    // atacante: vai buscar o deles (ou escolta quem está com ele)
    if (theirs.carrier) {
      const c = this.rt(theirs.carrier);
      const chaser = c ? this.nearest(c, this.alive().filter(o => o.team !== rt.team)) : null;
      if (chaser) {
        const push = Math.hypot(chaser.body.x - b.x, chaser.body.z - b.z) < 1.6 && this.wantsPush(dt);
        return this.toward(rt, chaser.body.x - b.x, chaser.body.z - b.z, { push });
      }
      return this.toward(rt, myBase.x - b.x, myBase.z - b.z);
    }
    const near = this.nearest(rt, this.alive().filter(o => o.team !== rt.team));
    const push = !!near && Math.hypot(near.body.x - b.x, near.body.z - b.z) < 1.4 && this.wantsPush(dt * 0.6);
    return this.toward(rt, theirs.x - b.x, theirs.z - b.z, { push });
  }
}

