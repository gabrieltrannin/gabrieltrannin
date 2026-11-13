import { PASTOREIO, SOCCER, soccerWorld, type PlayerInput, type WorldDef } from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

interface Sheep { key: string; x: number; z: number; vx: number; vz: number; wander: number; face: number; scared: number }

const PEN_X = SOCCER.halfX;

/** Pastoreio 2v2: assuste as ovelhas até o curral do seu time. Time 0: curral da esquerda (x < 0). */
export class Pastoreio extends Minigame {
  readonly id = 'pastoreio' as const;
  private readonly w = soccerWorld();
  private sheep = new Map<string, Sheep>();
  private respawn: number[] = [];

  world(): WorldDef {
    return this.w;
  }

  spawn(_i: number, _n: number, id: string): Spawn {
    const team = this.teamOf(id);
    const slot = this.slotOf(id);
    // começa do lado do adversário, para empurrar as ovelhas para o próprio curral
    const x = team === 0 ? 4.5 : -4.5;
    return { x, z: slot === 0 ? 3 : -3, team, face: team === 0 ? -Math.PI / 2 : Math.PI / 2 };
  }

  protected setup(): void {
    this.mg.teamScore.push(0);
    this.mg.teamScore.push(0);
    for (let i = 0; i < PASTOREIO.sheep; i++) this.addSheep((i - (PASTOREIO.sheep - 1) / 2) * 1.6, (Math.random() - 0.5) * 6);
  }

  private addSheep(x: number, z: number): void {
    const key = this.addEntity('sheep', x, 0, z, Math.random() * 6);
    this.sheep.set(key, { key, x, z, vx: 0, vz: 0, wander: Math.random() * 6, face: Math.random() * 6, scared: 0 });
  }

  protected update(dt: number): void {
    this.respawn = this.respawn.map(t => t - dt);
    while (this.respawn.length && this.respawn[0] <= 0) {
      this.respawn.shift();
      this.addSheep((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6);
    }
    const list = [...this.sheep.values()];
    for (const s of list) {
      // foge dos bonecos por perto
      let fx = 0;
      let fz = 0;
      for (const rt of this.alive()) {
        const dx = s.x - rt.body.x;
        const dz = s.z - rt.body.z;
        const d = Math.hypot(dx, dz);
        if (d > PASTOREIO.fleeR) continue;
        const w = (PASTOREIO.fleeR - d) / PASTOREIO.fleeR;
        fx += (dx / (d || 1)) * w;
        fz += (dz / (d || 1)) * w;
        // empurrão espanta de vez
        if (rt.body.dashT > 0 && d < 1.6) { s.vx += (dx / (d || 1)) * 7; s.vz += (dz / (d || 1)) * 7; s.scared = 1; }
      }
      // separação entre ovelhas
      for (const o of list) {
        if (o === s) continue;
        const dx = s.x - o.x;
        const dz = s.z - o.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.1 && d > 1e-4) { fx += (dx / d) * 0.8; fz += (dz / d) * 0.8; }
      }
      const fl = Math.hypot(fx, fz);
      let tx = 0;
      let tz = 0;
      if (fl > 0.05) {
        const speed = 3 + 3.2 * Math.min(1, fl);
        tx = (fx / fl) * speed;
        tz = (fz / fl) * speed;
        s.scared = Math.max(s.scared, 0.6);
      } else {
        s.wander += (Math.random() - 0.5) * dt * 3;
        tx = Math.cos(s.wander) * 0.7;
        tz = Math.sin(s.wander) * 0.7;
      }
      s.scared = Math.max(0, s.scared - dt);
      const a = Math.min(1, 6 * dt);
      s.vx += (tx - s.vx) * a;
      s.vz += (tz - s.vz) * a;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      if (Math.hypot(s.vx, s.vz) > 0.3) s.face = Math.atan2(s.vx, s.vz);
      // paredes; na boca do curral a ovelha passa
      const mouth = Math.abs(s.z) < PASTOREIO.penHalf - 0.3;
      const maxX = mouth ? PEN_X + PASTOREIO.penDepth : PEN_X - PASTOREIO.sheepR;
      const maxZ = SOCCER.halfZ - PASTOREIO.sheepR;
      if (s.x > maxX) { s.x = maxX; s.vx = -Math.abs(s.vx) * 0.5; }
      if (s.x < -maxX) { s.x = -maxX; s.vx = Math.abs(s.vx) * 0.5; }
      if (Math.abs(s.x) < PEN_X && Math.abs(s.z) > maxZ) { s.z = Math.sign(s.z) * maxZ; s.vz = -s.vz * 0.5; }
      // entrou no curral
      if (Math.abs(s.x) > PEN_X + 0.6) {
        const team = s.x < 0 ? 0 : 1;
        this.addTeamPoint(team);
        this.fx({ kind: 'score', x: s.x, y: 1.6, z: s.z, team, text: '+1 🐑' });
        this.sheep.delete(s.key);
        this.removeEntity(s.key);
        this.respawn.push(1.2);
      }
    }
  }

  protected mirrorExtra(): void {
    for (const s of this.sheep.values()) this.setEntity(s.key, { x: s.x, z: s.z, a: s.face, s: s.scared });
  }

  ranking(): string[][] {
    return this.teamRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    const b = rt.body;
    const penX = rt.team === 0 ? -PEN_X - 1 : PEN_X + 1;
    // ovelha que dá para "tocar" até o curral: a mais perto, preferindo as do lado certo
    const ai = rt.ai;
    ai.retarget -= dt;
    let target = ai.target ? this.sheep.get(ai.target) : undefined;
    if (!target || ai.retarget <= 0) {
      const mate = this.rts.find(o => o !== rt && o.team === rt.team);
      let best: Sheep | undefined;
      let bc = Infinity;
      for (const s of this.sheep.values()) {
        if (mate?.ai.target === s.key) continue;
        const cost = Math.hypot(s.x - b.x, s.z - b.z) + Math.abs(s.x - penX) * 0.4;
        if (cost < bc) { bc = cost; best = s; }
      }
      target = best;
      ai.target = best?.key ?? null;
      ai.retarget = this.botReaction + 0.6;
    }
    if (!target) return this.toward(rt, -b.x * 0.3, -b.z * 0.3);
    // vai para trás da ovelha (lado oposto ao curral), mirando a boca do curral
    let gx = penX - target.x;
    let gz = -target.z * 0.8;
    const gd = Math.hypot(gx, gz) || 1;
    gx /= gd; gz /= gd;
    const bx = target.x - gx * 2.2;
    const bz = target.z - gz * 2.2;
    const toBehind = Math.hypot(bx - b.x, bz - b.z);
    const aligned = (target.x - b.x) * gx + (target.z - b.z) * gz > 0;
    if (toBehind > 1.2 && !aligned) {
      // contorna sem assustar a ovelha para o lado errado
      const side = Math.sign((b.x - target.x) * -gz + (b.z - target.z) * gx) || 1;
      return this.toward(rt, bx - b.x + -gz * side * 2.5, bz - b.z + gx * side * 2.5);
    }
    const push = Math.hypot(target.x - b.x, target.z - b.z) < 1.5 && this.wantsPush(dt * 0.8);
    return this.toward(rt, target.x - b.x + gx * 0.5, target.z - b.z + gz * 0.5, { push });
  }
}
