import {
  DT, FFA_REWARDS, IDLE_INPUT, MINIGAMES, MOVE, MSG, TEAM_DRAW_REWARD, TEAM_WIN_REWARD,
  clampInput, newBody, separateBodies, stepPlayer,
  type Body, type FxMsg, type HitMsg, type InputMsg, type MgResultMsg, type MinigameId, type PlayerInput, type WorldDef,
} from '@fuzue/shared';
import type { GameRoom } from '../rooms/GameRoom.js';
import { MgEntity, MgPlayer } from '../rooms/schema.js';

const MAX_QUEUE = 4;
const IDLE_AFTER_MS = 300;

/** Memória do bot de cada jogador. */
export interface BotMemory {
  target: string | null;
  retarget: number;
  goal: { x: number; z: number } | null;
  timer: number;
}

/** Estado de um jogador dentro do minijogo (lado do servidor). */
export interface Runtime {
  id: string;
  index: number;
  body: Body;
  seq: number;
  queue: InputMsg[];
  last: InputMsg;
  lastAt: number;
  alive: boolean;
  finished: boolean;
  score: number;
  team: number;
  /** Quem já foi acertado pelo empurrão atual. */
  hitSet: Set<string>;
  ai: BotMemory;
}

export interface Spawn { x: number; z: number; y?: number; face?: number; team?: number }

/**
 * Base de todos os minijogos: inputs, física dos bonecos, colisões entre
 * eles, empurrões, eliminações, espelhamento no estado e recompensas.
 * Cada minijogo só implementa o que é dele (mundo, regras, bot, placar).
 */
export abstract class Minigame {
  abstract readonly id: MinigameId;
  readonly rts: Runtime[] = [];
  /** Tempo de jogo (s). */
  t = 0;
  over = false;
  /** Duração (s), definida pela sala. */
  duration = 60;
  protected pushEnabled = true;
  /** Multiplica a força do empurrão (no gelo, empurrão inteiro derruba). */
  protected knockScale = 1;
  /** Eliminados, em grupos por tick (primeiro grupo = primeiros a sair). */
  protected outGroups: string[][] = [];
  private outThisTick: string[] = [];
  private entitySeq = 0;
  /** Placar dos times (minijogos 2v2). */
  protected teamScores = [0, 0];
  private teamMap = new Map<string, number>();
  private slotMap = new Map<string, number>();

  constructor(protected room: GameRoom) {}

  /* ---------- a implementar ---------- */
  abstract world(): WorldDef;
  abstract spawn(index: number, count: number, id: string): Spawn;
  abstract botInput(rt: Runtime, dt: number): PlayerInput;
  abstract ranking(): string[][];
  protected setup(): void {}
  protected update(_dt: number): void {}
  protected mirrorExtra(): void {}
  protected checkOver(): boolean { return false; }
  protected timeUp(): void { this.over = true; }
  protected onHit(_attacker: Runtime, _target: Runtime): void {}

  /* ---------- montagem ---------- */

  get mg() { return this.room.state.mg; }

  init(ids: string[]): void {
    const mg = this.mg;
    mg.players.clear();
    mg.entities.clear();
    mg.tiles.clear();
    mg.teamScore.clear();
    mg.holder = '';
    mg.fuse = 0;
    mg.radius = 0;
    mg.time = 0;
    mg.id = this.id;
    ids.forEach((id, index) => {
      const sp = this.spawn(index, ids.length, id);
      const idle: InputMsg = { seq: 0, ...IDLE_INPUT };
      this.rts.push({
        id, index,
        body: newBody(sp.x, sp.y ?? 0, sp.z, sp.face ?? 0),
        seq: 0, queue: [], last: idle, lastAt: 0,
        alive: true, finished: false, score: 0, team: sp.team ?? -1,
        hitSet: new Set(),
        ai: { target: null, retarget: 0, goal: null, timer: Math.random() },
      });
      const mp = new MgPlayer();
      mp.team = sp.team ?? -1;
      mg.players.set(id, mp);
    });
    this.setup();
    this.mirror();
  }

  rt(id: string): Runtime | undefined {
    return this.rts.find(r => r.id === id);
  }

  alive(): Runtime[] {
    return this.rts.filter(r => r.alive);
  }

  /* ---------- inputs ---------- */

  receiveInput(id: string, msg: InputMsg): void {
    if (this.mg.step !== 'play' || this.over) return;
    const rt = this.rt(id);
    if (!rt || !msg || !Number.isInteger(msg.seq)) return;
    const newest = rt.queue.length ? rt.queue[rt.queue.length - 1].seq : rt.last.seq;
    if (msg.seq <= newest) return;
    const dir = clampInput(Number(msg.x), Number(msg.z));
    rt.queue.push({ seq: msg.seq, x: dir.x, z: dir.z, push: msg.push === true, jump: msg.jump === true });
    while (rt.queue.length > MAX_QUEUE) {
      const dropped = rt.queue.shift()!;
      if (dropped.push) rt.queue[0].push = true;
      if (dropped.jump) rt.queue[0].jump = true;
    }
    rt.lastAt = Date.now();
  }

  private nextInput(rt: Runtime): PlayerInput {
    const next = rt.queue.shift();
    if (next) {
      rt.last = next;
      rt.seq = next.seq;
      return next;
    }
    if (Date.now() - rt.lastAt > IDLE_AFTER_MS) return IDLE_INPUT;
    return { x: rt.last.x, z: rt.last.z, push: false, jump: false };
  }

  /* ---------- tick ---------- */

  tick(_dt: number, playing: boolean): void {
    const dt = DT; // passo fixo: igual ao da previsão no cliente
    const active = playing && !this.over;
    if (active) this.t += dt;
    const world = this.world();
    for (const rt of this.rts) {
      if (!rt.alive) continue;
      let input: PlayerInput = IDLE_INPUT;
      if (active && !rt.finished) input = this.room.isBot(rt.id) ? this.botInput(rt, dt) : this.nextInput(rt);
      if (!this.pushEnabled && input.push) input = { ...input, push: false };
      const r = stepPlayer(rt.body, input, world, dt);
      if (r.dashed) rt.hitSet.clear();
    }
    if (active) {
      this.collide();
      this.hits();
      this.update(dt);
      if (this.outThisTick.length) {
        this.outGroups.push(this.outThisTick);
        this.outThisTick = [];
      }
      if (this.t >= this.duration) this.timeUp();
      if (this.checkOver()) this.over = true;
    }
    this.mirror();
  }

  private collide(): void {
    const list = this.rts.filter(r => r.alive && !r.finished);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) separateBodies(list[i].body, list[j].body);
    }
  }

  private hits(): void {
    for (const a of this.rts) {
      if (!a.alive || a.body.dashT <= 0) continue;
      for (const t of this.rts) {
        if (t === a || !t.alive || t.finished || a.hitSet.has(t.id)) continue;
        const dx = t.body.x - a.body.x;
        const dz = t.body.z - a.body.z;
        const dist = Math.hypot(dx, dz);
        if (dist > MOVE.hitRange || Math.abs(t.body.y - a.body.y) > 1) continue;
        const nx = dist > 1e-4 ? dx / dist : Math.sin(a.body.face);
        const nz = dist > 1e-4 ? dz / dist : Math.cos(a.body.face);
        a.hitSet.add(t.id);
        this.knock(t, nx, nz, MOVE.knockback * this.knockScale, MOVE.knockUp * Math.min(1, this.knockScale * 1.3), MOVE.stunTime * Math.min(1, this.knockScale * 1.2));
        a.body.dashT = 0;
        a.body.vx *= 0.3;
        a.body.vz *= 0.3;
        const hit: HitMsg = { attacker: a.id, target: t.id, x: t.body.x, y: t.body.y, z: t.body.z };
        this.room.broadcast(MSG.hit, hit);
        this.onHit(a, t);
      }
    }
  }

  /** Arremessa um jogador na direção (nx, nz). */
  protected knock(rt: Runtime, nx: number, nz: number, speed: number, up: number, stun: number): void {
    rt.body.vx = nx * speed;
    rt.body.vz = nz * speed;
    rt.body.vy = up;
    rt.body.grounded = false;
    rt.body.stunT = stun;
    rt.body.dashT = 0;
  }

  protected eliminate(rt: Runtime): void {
    if (!rt.alive) return;
    rt.alive = false;
    this.outThisTick.push(rt.id);
    this.fx({ kind: 'out', x: rt.body.x, y: rt.body.y, z: rt.body.z, pid: rt.id });
  }

  protected fx(msg: FxMsg): void {
    this.room.broadcast(MSG.fx, msg);
  }

  /* ---------- estado sincronizado ---------- */

  private mirror(): void {
    this.mg.time = this.t;
    for (const rt of this.rts) {
      const mp = this.mg.players.get(rt.id);
      if (!mp) continue;
      const b = rt.body;
      mp.x = b.x; mp.y = b.y; mp.z = b.z;
      mp.vx = b.vx; mp.vy = b.vy; mp.vz = b.vz;
      mp.face = b.face;
      mp.dashT = b.dashT; mp.dashCd = b.dashCd; mp.stunT = b.stunT;
      mp.boost = b.boost;
      mp.grounded = b.grounded;
      mp.seq = rt.seq;
      mp.alive = rt.alive;
      mp.finished = rt.finished;
      mp.score = rt.score;
      mp.team = rt.team;
    }
    this.mirrorExtra();
  }

  protected addEntity(kind: string, x: number, y: number, z: number, a = 0, s = 0): string {
    const key = `${kind}${++this.entitySeq}`;
    const e = new MgEntity();
    e.kind = kind; e.x = x; e.y = y; e.z = z; e.a = a; e.s = s;
    this.mg.entities.set(key, e);
    return key;
  }

  protected removeEntity(key: string): void {
    this.mg.entities.delete(key);
  }

  /* ---------- times (2v2) ---------- */

  /** Times equilibrados pela colocação no tabuleiro: 1º+4º contra 2º+3º. */
  protected teamOf(id: string): number {
    if (!this.teamMap.size) {
      const ranked = this.room.participants().sort((a, b) => b.crowns - a.crowns || b.coins - a.coins);
      ranked.forEach((p, i) => this.teamMap.set(p.id, i === 0 || i === 3 ? 0 : 1));
      const count = [0, 0];
      ranked.forEach(p => { const t = this.teamMap.get(p.id)!; this.slotMap.set(p.id, count[t]++); });
    }
    return this.teamMap.get(id) ?? 0;
  }

  /** 0 ou 1: posição do jogador dentro do time. */
  protected slotOf(id: string): number {
    this.teamOf(id);
    return this.slotMap.get(id) ?? 0;
  }

  protected addTeamPoint(team: number): void {
    this.teamScores[team]++;
    this.mg.teamScore[team] = this.teamScores[team];
  }

  /* ---------- resultado ---------- */

  /** Sobreviventes empatados em 1º, depois quem saiu por último. */
  protected eliminationRanking(): string[][] {
    const groups: string[][] = [];
    const alive = this.alive().map(r => r.id);
    if (alive.length) groups.push(alive);
    for (let i = this.outGroups.length - 1; i >= 0; i--) groups.push(this.outGroups[i]);
    return groups;
  }

  /** Por pontos (empates no mesmo grupo). */
  protected scoreRanking(): string[][] {
    const sorted = [...this.rts].sort((a, b) => b.score - a.score);
    const groups: string[][] = [];
    sorted.forEach((r, i) => {
      if (i > 0 && sorted[i - 1].score === r.score) groups[groups.length - 1].push(r.id);
      else groups.push([r.id]);
    });
    return groups;
  }

  /** Ranking de minijogo de time: vencedores juntos, depois perdedores. */
  protected teamRanking(): string[][] {
    const t0 = this.rts.filter(r => r.team === 0).map(r => r.id);
    const t1 = this.rts.filter(r => r.team === 1).map(r => r.id);
    const [a, b] = this.teamScores;
    if (a === b) return [[...t0, ...t1]];
    return a > b ? [t0, t1] : [t1, t0];
  }

  result(): MgResultMsg {
    if (MINIGAMES[this.id].mode === 'team') {
      const [a, b] = this.teamScores;
      const draw = a === b;
      const winnerTeam = draw ? null : a > b ? 0 : 1;
      const rewards: Record<string, number> = {};
      for (const rt of this.rts) {
        rewards[rt.id] = draw ? TEAM_DRAW_REWARD : rt.team === winnerTeam ? TEAM_WIN_REWARD : 0;
        rt.score = this.teamScores[rt.team] ?? 0;
      }
      return { ranking: this.teamRanking(), rewards, teamScores: [...this.teamScores], winnerTeam };
    }
    const ranking = this.ranking();
    const rewards: Record<string, number> = {};
    let pos = 0;
    for (const g of ranking) {
      const reward = FFA_REWARDS[pos] ?? 0;
      g.forEach(id => { rewards[id] = reward; });
      pos += g.length;
    }
    return { ranking, rewards };
  }

  /* ---------- ajudas para bots ---------- */

  protected get level(): number {
    return this.room.botLevel;
  }

  /** Fração da velocidade máxima que o bot usa. */
  protected get botSpeed(): number {
    return [0.7, 0.86, 1][this.level] ?? 0.86;
  }

  /** Quantas vezes por segundo o bot tenta empurrar quando está perto. */
  protected get botPushRate(): number {
    return [0.7, 1.5, 2.6][this.level] ?? 1.5;
  }

  /** Tempo de reação para trocar de alvo (s). */
  protected get botReaction(): number {
    return [1.2, 0.7, 0.35][this.level] ?? 0.7;
  }

  protected toward(rt: Runtime, dx: number, dz: number, extra: Partial<PlayerInput> = {}): PlayerInput {
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return { ...IDLE_INPUT, ...extra };
    const s = this.botSpeed;
    // um pouco de "mão tremida" nos níveis mais fáceis
    const wobble = (1 - this.level / 2) * 0.25 * Math.sin(this.t * 3 + rt.index * 1.7);
    const c = Math.cos(wobble);
    const sn = Math.sin(wobble);
    const x = (dx / d) * c - (dz / d) * sn;
    const z = (dx / d) * sn + (dz / d) * c;
    return { x: x * s, z: z * s, push: false, jump: false, ...extra };
  }

  protected nearest(rt: Runtime, pool: Runtime[]): Runtime | null {
    let best: Runtime | null = null;
    let bd = Infinity;
    for (const o of pool) {
      if (o === rt) continue;
      const d = Math.hypot(o.body.x - rt.body.x, o.body.z - rt.body.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  protected wantsPush(dt: number): boolean {
    return Math.random() < dt * this.botPushRate;
  }

  /** Soma um "empurrão para longe" de cada ponto perigoso dentro do raio. */
  protected repel(rt: Runtime, points: Iterable<{ x: number; z: number }>, radius: number, weight = 3): { x: number; z: number } {
    let x = 0;
    let z = 0;
    for (const p of points) {
      const ox = rt.body.x - p.x;
      const oz = rt.body.z - p.z;
      const d = Math.hypot(ox, oz);
      if (d >= radius) continue;
      const w = (radius - d) * weight;
      x += (ox / (d || 1)) * w;
      z += (oz / (d || 1)) * w;
    }
    return { x, z };
  }

  /** Foge de alguém, escorregando pela parede de uma arena redonda em vez de travar nela. */
  protected flee(rt: Runtime, from: { x: number; z: number }, arenaR: number, range = 7): { x: number; z: number } {
    const b = rt.body;
    const ox = b.x - from.x;
    const oz = b.z - from.z;
    const od = Math.hypot(ox, oz) || 1;
    const w = Math.max(0, range - od);
    let dx = (ox / od) * w - b.x * 0.15;
    let dz = (oz / od) * w - b.z * 0.15;
    const r = Math.hypot(b.x, b.z);
    if (r > arenaR - 2) {
      const tx = -b.z / r;
      const tz = b.x / r;
      const side = tx * ox + tz * oz >= 0 ? 1 : -1;
      dx += tx * side * 4 - (b.x / r) * 2;
      dz += tz * side * 4 - (b.z / r) * 2;
    }
    return { x: dx, z: dz };
  }

  /** Ponto aleatório dentro de um círculo. */
  protected randomIn(radius: number): { x: number; z: number } {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  }

  protected setEntity(key: string, fields: Partial<{ x: number; y: number; z: number; a: number; s: number }>): void {
    const e = this.mg.entities.get(key);
    if (e) Object.assign(e, fields);
  }
}
