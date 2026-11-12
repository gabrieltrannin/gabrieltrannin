import { Room, type Client } from '@colyseus/core';
import {
  ARENA, CHARACTERS, MAX_PLAYERS, MOVE, MSG, TICK_RATE,
  clampInput, sanitizeName, spawnPoint, stepMove,
  type HitMsg, type InputMsg, type JoinOptions, type MoveState,
} from '@fuzue/shared';
import { ArenaWorld, initPhysics } from '../physics/ArenaWorld.js';
import { ArenaState, BallState, PlayerState } from './ArenaState.js';
import { releaseCode, reserveCode } from './roomCodes.js';

/** Fila de inputs de um jogador. O servidor consome um input por tick. */
interface InputBuffer {
  queue: InputMsg[];
  last: InputMsg;
  lastAt: number;
  /** Quem já foi acertado pelo empurrão atual (para acertar só uma vez). */
  hitThisDash: Set<string>;
}

/** Inputs guardados no máximo; acima disso descartamos os mais velhos. */
const MAX_QUEUE = 4;
/** Sem inputs por este tempo, o jogador para (aba em segundo plano, etc.). */
const IDLE_AFTER_MS = 300;

export class ArenaRoom extends Room<ArenaState> {
  maxClients = MAX_PLAYERS;

  private physics!: ArenaWorld;
  private inputs = new Map<string, InputBuffer>();

  async onCreate(): Promise<void> {
    // O código curto vira o próprio id da sala: assim `joinById("K7QX")` funciona.
    this.roomId = reserveCode();
    this.setState(new ArenaState());
    this.state.code = this.roomId;

    await initPhysics();
    this.physics = new ArenaWorld();
    for (const b of this.physics.balls) {
      const s = new BallState();
      s.r = b.r;
      this.state.balls.push(s);
    }

    this.onMessage(MSG.input, (client, msg: InputMsg) => this.receiveInput(client, msg));
    this.onMessage(MSG.pong, (client, msg: { t?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (p && typeof msg?.t === 'number') p.ping = Math.max(0, Math.min(9999, Date.now() - msg.t));
    });

    this.setPatchRate(1000 / TICK_RATE);
    this.setSimulationInterval(() => this.tick(), 1000 / TICK_RATE);
    this.clock.setInterval(() => this.broadcast(MSG.ping, { t: Date.now() }), 2000);
  }

  onJoin(client: Client, options: Partial<JoinOptions> = {}): void {
    const p = new PlayerState();
    p.name = sanitizeName(options.name);
    const ch = Math.floor(Number(options.character));
    p.character = Number.isInteger(ch) && ch >= 0 && ch < CHARACTERS.length ? ch : 0;

    const spot = spawnPoint();
    p.x = spot.x; p.y = ARENA.spawnY; p.z = spot.z;
    p.face = Math.atan2(-spot.x, -spot.z); // olhando para o centro
    this.state.players.set(client.sessionId, p);
    this.physics.addPlayer(client.sessionId, p.x, p.y, p.z);

    const idle: InputMsg = { seq: 0, x: 0, z: 0, push: false };
    this.inputs.set(client.sessionId, { queue: [], last: idle, lastAt: 0, hitThisDash: new Set() });

    if (!this.state.hostId) this.state.hostId = client.sessionId;
    console.log(`[${this.roomId}] ${p.name} entrou (${this.clients.length}/${MAX_PLAYERS})`);
  }

  onLeave(client: Client): void {
    const p = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.physics.removePlayer(client.sessionId);
    this.inputs.delete(client.sessionId);
    if (this.state.hostId === client.sessionId) {
      this.state.hostId = this.state.players.keys().next().value ?? '';
    }
    console.log(`[${this.roomId}] ${p?.name ?? client.sessionId} saiu`);
  }

  onDispose(): void {
    releaseCode(this.roomId);
    this.physics?.dispose();
    console.log(`[${this.roomId}] sala fechada`);
  }

  private receiveInput(client: Client, msg: InputMsg): void {
    const buf = this.inputs.get(client.sessionId);
    if (!buf || !msg || !Number.isInteger(msg.seq)) return;
    const newest = buf.queue.length ? buf.queue[buf.queue.length - 1].seq : buf.last.seq;
    if (msg.seq <= newest) return; // repetido ou fora de ordem
    const dir = clampInput(Number(msg.x), Number(msg.z));
    buf.queue.push({ seq: msg.seq, x: dir.x, z: dir.z, push: msg.push === true });
    // Rede engasgou e chegaram muitos de uma vez: descarta os mais velhos,
    // mas não perde um empurrão que estava neles.
    while (buf.queue.length > MAX_QUEUE) {
      const dropped = buf.queue.shift()!;
      if (dropped.push) buf.queue[0].push = true;
    }
    buf.lastAt = Date.now();
  }

  /** Um passo da simulação: inputs → velocidades → física → estado. */
  private tick(): void {
    const now = Date.now();

    // 1) Inputs → velocidade de cada jogador (mesma regra que o cliente prevê)
    this.state.players.forEach((p, id) => {
      const buf = this.inputs.get(id);
      const pose = this.physics.pose(id);
      if (!buf || !pose) return;

      let input: InputMsg;
      const next = buf.queue.shift();
      if (next) { input = next; buf.last = next; p.seq = next.seq; }
      else if (now - buf.lastAt > IDLE_AFTER_MS) input = { seq: buf.last.seq, x: 0, z: 0, push: false };
      else input = { ...buf.last, push: false }; // repete a direção, nunca o empurrão

      const s: MoveState = { x: pose.x, z: pose.z, vx: pose.vx, vz: pose.vz, face: p.face, dashT: p.dashT, dashCd: p.dashCd, stunT: p.stunT };
      if (stepMove(s, input)) buf.hitThisDash.clear();
      p.face = s.face; p.dashT = s.dashT; p.dashCd = s.dashCd; p.stunT = s.stunT;
      this.physics.setVelocity(id, s.vx, pose.vy, s.vz);
    });

    // 2) Física
    this.physics.step();
    this.physics.respawnFallenBalls();

    // 3) Física → estado sincronizado
    this.state.players.forEach((p, id) => {
      const pose = this.physics.pose(id);
      if (!pose) return;
      if (pose.y < ARENA.killY) {
        const spot = spawnPoint();
        this.physics.teleport(id, spot.x, ARENA.spawnY, spot.z);
        p.x = spot.x; p.y = ARENA.spawnY; p.z = spot.z;
        p.vx = 0; p.vz = 0; p.dashT = 0; p.stunT = 0;
        p.falls++;
        return;
      }
      p.x = pose.x; p.y = pose.y; p.z = pose.z;
      p.vx = pose.vx; p.vz = pose.vz;
    });

    // 4) Empurrões: quem está no meio do empurrão arremessa quem estiver perto
    this.state.players.forEach((attacker, aid) => {
      if (attacker.dashT <= 0) return;
      const buf = this.inputs.get(aid);
      if (!buf) return;
      this.state.players.forEach((target, tid) => {
        if (tid === aid || buf.hitThisDash.has(tid)) return;
        const dx = target.x - attacker.x;
        const dz = target.z - attacker.z;
        const dist = Math.hypot(dx, dz);
        if (dist > MOVE.hitRange || Math.abs(target.y - attacker.y) > 1) return;
        const nx = dist > 1e-4 ? dx / dist : Math.sin(attacker.face);
        const nz = dist > 1e-4 ? dz / dist : Math.cos(attacker.face);
        buf.hitThisDash.add(tid);
        target.stunT = MOVE.stunTime;
        target.dashT = 0;
        this.physics.setVelocity(tid, nx * MOVE.knockback, MOVE.knockUp, nz * MOVE.knockback);
        target.vx = nx * MOVE.knockback; target.vz = nz * MOVE.knockback;
        // o atacante perde o embalo ao acertar
        attacker.dashT = 0;
        const pose = this.physics.pose(aid);
        if (pose) this.physics.setVelocity(aid, pose.vx * 0.3, pose.vy, pose.vz * 0.3);
        attacker.hits++;
        const hit: HitMsg = { attacker: aid, target: tid, x: target.x, y: target.y, z: target.z };
        this.broadcast(MSG.hit, hit);
      });
    });

    // 5) Bolas
    this.physics.balls.forEach((b, i) => {
      const s = this.state.balls[i];
      const t = b.body.translation();
      const q = b.body.rotation();
      s.x = t.x; s.y = t.y; s.z = t.z;
      s.qx = q.x; s.qy = q.y; s.qz = q.z; s.qw = q.w;
    });
  }
}

