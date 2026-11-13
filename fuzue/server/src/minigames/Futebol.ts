import {
  PLAYER_RADIUS, SOCCER,
  soccerWorld, type PlayerInput, type WorldDef,
} from '@fuzue/shared';
import { Minigame, type Runtime, type Spawn } from './Minigame.js';

const R = SOCCER.ballR;
const GRAVITY = -20;

/** Futebol Caótico 2v2 com bola gigante. */
export class Futebol extends Minigame {
  readonly id = 'futebol' as const;
  private readonly w = soccerWorld();
  private ball = { x: 0, y: R, z: 0, vx: 0, vy: 0, vz: 0 };
  private freeze = 0;
  private ballKey = '';

  world(): WorldDef {
    return this.w;
  }

  private kickoffSpot(id: string): Spawn {
    const team = this.teamOf(id);
    const slot = this.slotOf(id);
    const x = team === 0 ? -5.5 : 5.5;
    const z = slot === 0 ? 2.6 : -2.6;
    return { x, z, team, face: team === 0 ? Math.PI / 2 : -Math.PI / 2 };
  }

  spawn(_i: number, _n: number, id: string): Spawn {
    return this.kickoffSpot(id);
  }

  protected setup(): void {
    this.mg.teamScore.push(0);
    this.mg.teamScore.push(0);
    this.ballKey = this.addEntity('ball', 0, R, 0);
  }

  private kickoff(): void {
    this.ball = { x: 0, y: R + 2, z: 0, vx: 0, vy: 0, vz: 0 };
    for (const rt of this.rts) {
      const s = this.kickoffSpot(rt.id);
      Object.assign(rt.body, { x: s.x, y: 0, z: s.z, vx: 0, vy: 0, vz: 0, face: s.face ?? 0, stunT: 0, dashT: 0 });
    }
  }

  protected update(dt: number): void {
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (this.freeze <= 0) this.kickoff();
      return;
    }
    const b = this.ball;
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.y < R) {
      b.y = R;
      b.vy = b.vy < -2 ? -b.vy * 0.45 : 0;
    }
    if (b.y <= R + 0.01) {
      const f = Math.exp(-0.45 * dt);
      b.vx *= f;
      b.vz *= f;
    }

    // paredes e gols
    const inMouth = Math.abs(b.z) < SOCCER.goalHalf - 0.15;
    const maxX = inMouth ? SOCCER.halfX + SOCCER.goalDepth - R : SOCCER.halfX - R;
    if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx) * 0.7; }
    if (b.x < -maxX) { b.x = -maxX; b.vx = Math.abs(b.vx) * 0.7; }
    const maxZ = Math.abs(b.x) > SOCCER.halfX ? SOCCER.goalHalf - R : SOCCER.halfZ - R;
    if (b.z > maxZ) { b.z = maxZ; b.vz = -Math.abs(b.vz) * 0.7; }
    if (b.z < -maxZ) { b.z = -maxZ; b.vz = Math.abs(b.vz) * 0.7; }

    // jogadores chutam a bola
    for (const rt of this.alive()) {
      const p = rt.body;
      if (b.y - R > 1.4) continue;
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const d = Math.hypot(dx, dz);
      const min = PLAYER_RADIUS + R * 0.92;
      if (d >= min || d < 1e-4) continue;
      const nx = dx / d;
      const nz = dz / d;
      b.x = p.x + nx * min;
      b.z = p.z + nz * min;
      const rel = (p.vx - b.vx) * nx + (p.vz - b.vz) * nz;
      if (rel > 0) { b.vx += nx * (rel * 1.35 + 1.6); b.vz += nz * (rel * 1.35 + 1.6); }
      if (p.dashT > 0 && !rt.hitSet.has('ball')) {
        rt.hitSet.add('ball');
        b.vx += nx * 10;
        b.vz += nz * 10;
        b.vy += 3.5;
      }
    }
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 17) { b.vx *= 17 / sp; b.vz *= 17 / sp; }

    // gol?
    const scored = b.x < -(SOCCER.halfX + 0.25) ? 1 : b.x > SOCCER.halfX + 0.25 ? 0 : -1;
    if (scored >= 0 && Math.abs(b.z) < SOCCER.goalHalf) {
      this.addTeamPoint(scored);
      this.fx({ kind: 'goal', x: b.x, y: b.y, z: b.z, team: scored });
      this.freeze = 2.2;
      b.vx = 0; b.vz = 0;
    }
  }

  protected mirrorExtra(): void {
    const e = this.mg.entities.get(this.ballKey);
    if (e) { e.x = this.ball.x; e.y = this.ball.y; e.z = this.ball.z; }
  }

  ranking(): string[][] {
    return this.teamRanking();
  }

  botInput(rt: Runtime, dt: number): PlayerInput {
    if (this.freeze > 0) return { x: 0, z: 0, push: false, jump: false };
    const p = rt.body;
    const b = this.ball;
    const attackX = rt.team === 0 ? SOCCER.halfX + 1 : -(SOCCER.halfX + 1);
    const ownX = -attackX;
    const mates = this.rts.filter(o => o.team === rt.team);
    const closest = mates.sort((a, c) => Math.hypot(a.body.x - b.x, a.body.z - b.z) - Math.hypot(c.body.x - b.x, c.body.z - b.z))[0];

    if (closest !== rt && this.level > 0) {
      // zagueiro: fica entre a bola e o próprio gol
      const gx = ownX * 0.62 + (b.x - ownX * 0.62) * 0.35;
      const gz = b.z * 0.6;
      return this.toward(rt, gx - p.x, gz - p.z);
    }

    // atacante: vai para trás da bola e empurra em direção ao gol
    let gx = attackX - b.x;
    let gz = -b.z;
    const gd = Math.hypot(gx, gz) || 1;
    gx /= gd; gz /= gd;
    const behindX = b.x - gx * (R + 0.9);
    const behindZ = b.z - gz * (R + 0.9);
    const toBehind = Math.hypot(behindX - p.x, behindZ - p.z);
    const aligned = (b.x - p.x) * gx + (b.z - p.z) * gz > 0;
    if (toBehind > 0.9 && !(aligned && toBehind < 1.8)) {
      // contorna a bola se estiver do lado errado
      let tx = behindX - p.x;
      let tz = behindZ - p.z;
      if (!aligned && Math.hypot(b.x - p.x, b.z - p.z) < R + 1.6) {
        tx += -gz * 2.5 * Math.sign((p.x - b.x) * -gz + (p.z - b.z) * gx || 1);
        tz += gx * 2.5 * Math.sign((p.x - b.x) * -gz + (p.z - b.z) * gx || 1);
      }
      return this.toward(rt, tx, tz);
    }
    const dist = Math.hypot(b.x - p.x, b.z - p.z);
    const push = dist < R + 1.4 && this.wantsPush(dt);
    return this.toward(rt, b.x - p.x + gx, b.z - p.z + gz, { push });
  }
}
