import * as THREE from 'three';
import type { Room } from 'colyseus.js';
import {
  ARENA, DT, MSG, PLAYER_RADIUS,
  integrate, resolvePillars, stepMove,
  type HitMsg, type InputMsg, type MoveState,
} from '@fuzue/shared';
import { animateCritter, makeCritter, type Critter } from './critter';
import type { Input } from './Input';
import { SEA_Y, type Stage, type Tag } from './Stage';
import type { Hud, HudPlayer } from '../ui/Hud';
import { escapeHtml, toast } from '../ui/toast';

/** Os outros jogadores são desenhados este tanto no passado, para interpolar suave. */
const INTERP_MS = 100;
const MAX_SNAPS = 40;
/** Erro de previsão acima disto vira teletransporte (ex.: renasceu). */
const SNAP_DISTANCE = 2.5;
const CRITTER_SCALE = 0.85;

/* Formato do estado que chega do servidor (o cliente lê por reflexão). */
interface NetPlayer {
  name: string; character: number;
  x: number; y: number; z: number; vx: number; vz: number;
  face: number; dashT: number; dashCd: number; stunT: number;
  seq: number; ping: number; falls: number; hits: number;
}
interface NetBall { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number }
interface NetState {
  code: string;
  hostId: string;
  players: { forEach(cb: (p: NetPlayer, id: string) => void): void };
  balls: { forEach(cb: (b: NetBall, i: number) => void): void };
}

interface Snap { t: number; x: number; y: number; z: number; face: number; dashT: number; stunT: number }

interface View {
  id: string;
  name: string;
  critter: Critter;
  tag: Tag;
  snaps: Snap[];
  /** Posição desenhada (centro da esfera de colisão). */
  pos: THREE.Vector3;
  face: number;
  speed: number;
  ready: boolean;
}

function lerpAngle(a: number, b: number, k: number): number {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * k;
}

/** Estado interpolado no instante `t` a partir do histórico recebido. */
function sample(snaps: Snap[], t: number): Snap | null {
  if (!snaps.length) return null;
  if (t <= snaps[0].t) return snaps[0];
  for (let i = snaps.length - 1; i >= 0; i--) {
    const a = snaps[i];
    if (a.t > t) continue;
    const b = snaps[i + 1];
    if (!b) return a;
    if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > SNAP_DISTANCE) return b; // renasceu: não desliza pelo ar
    const k = (t - a.t) / Math.max(1, b.t - a.t);
    return {
      t,
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k,
      z: a.z + (b.z - a.z) * k,
      face: lerpAngle(a.face, b.face, k),
      dashT: a.dashT,
      stunT: a.stunT,
    };
  }
  return snaps[0];
}

/**
 * Uma partida em andamento numa sala.
 *
 * Rede em três partes:
 * 1. Previsão: o próprio boneco anda na hora, usando a mesma regra do servidor.
 * 2. Reconciliação: quando chega o estado do servidor, partimos da posição
 *    oficial e reaplicamos os inputs que o servidor ainda não processou.
 * 3. Interpolação: os outros jogadores são desenhados ~100 ms no passado,
 *    deslizando entre dois estados recebidos.
 */
export class Session {
  readonly code: string;
  private views = new Map<string, View>();
  private pred: MoveState | null = null;
  private pending: InputMsg[] = [];
  private seq = 0;
  private acc = 0;
  /** Diferença visual que sobra depois de uma correção; some aos poucos. */
  private offset = new THREE.Vector2();
  private serverY = PLAYER_RADIUS;
  private ballTargets: { p: THREE.Vector3; q: THREE.Quaternion }[] = [];
  private firstState = true;
  private hudKey = '';
  private leaving = false;
  private closed = false;

  constructor(
    private room: Room,
    private stage: Stage,
    private hud: Hud,
    private input: Input,
    private onClosed: (reason: string | null) => void,
  ) {
    this.code = room.roomId;
    this.ballTargets = stage.balls.map(m => ({ p: m.position.clone(), q: m.quaternion.clone() }));

    room.onStateChange(state => this.onState(state as unknown as NetState));
    room.onMessage(MSG.ping, (m: unknown) => room.send(MSG.pong, m));
    room.onMessage(MSG.hit, (m: HitMsg) => this.onHit(m));
    room.onLeave(() => this.close(this.leaving ? null : 'A conexão com a sala caiu.'));
    room.onError((code, message) => console.warn('Erro na sala', code, message));

    input.reset();
    input.enabled = true;
    stage.setMode('game');
    stage.onFrame((dt, t) => this.update(dt, t));
  }

  get me(): string {
    return this.room.sessionId;
  }

  leave(): void {
    this.leaving = true;
    this.room.leave(true).catch(() => this.close(null));
  }

  /* ---------------- rede → mundo ---------------- */

  private onState(state: NetState): void {
    const now = performance.now();
    const seen = new Set<string>();
    const hudList: HudPlayer[] = [];

    state.players.forEach((p, id) => {
      seen.add(id);
      let v = this.views.get(id);
      if (!v) {
        v = this.addView(id, p);
        if (!this.firstState && id !== this.me) toast(`${p.name} entrou na sala`);
      }
      v.snaps.push({ t: now, x: p.x, y: p.y, z: p.z, face: p.face, dashT: p.dashT, stunT: p.stunT });
      if (v.snaps.length > MAX_SNAPS) v.snaps.shift();
      if (id === this.me) this.reconcile(p);
      hudList.push({ id, name: p.name, character: p.character, ping: p.ping, falls: p.falls, hits: p.hits, me: id === this.me, host: id === state.hostId });
    });

    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        toast(`${v.name} saiu da sala`);
        this.removeView(id);
      }
    }
    this.firstState = false;

    state.balls.forEach((b, i) => {
      const tg = this.ballTargets[i];
      if (tg) { tg.p.set(b.x, b.y, b.z); tg.q.set(b.qx, b.qy, b.qz, b.qw); }
    });

    const key = JSON.stringify(hudList);
    if (key !== this.hudKey) {
      this.hudKey = key;
      this.hud.setPlayers(hudList);
    }
  }

  private reconcile(p: NetPlayer): void {
    this.serverY = p.y;
    this.pending = this.pending.filter(i => i.seq > p.seq);

    const s: MoveState = { x: p.x, z: p.z, vx: p.vx, vz: p.vz, face: p.face, dashT: p.dashT, dashCd: p.dashCd, stunT: p.stunT };
    for (const i of this.pending) {
      stepMove(s, i);
      integrate(s);
      resolvePillars(s);
    }

    if (this.pred) {
      // mantém o boneco onde estava na tela e corrige aos poucos
      this.offset.x += this.pred.x - s.x;
      this.offset.y += this.pred.z - s.z;
      if (this.offset.length() > SNAP_DISTANCE) this.offset.set(0, 0);
    }
    this.pred = s;
  }

  private onHit(m: HitMsg): void {
    const target = this.views.get(m.target);
    const at = target ? target.pos.clone() : new THREE.Vector3(m.x, m.y, m.z);
    at.y += 0.9;
    this.stage.pop(at, 'POW!', 'gain');
    this.stage.burst(at);
    if (m.target === this.me) {
      this.stage.shake(0.7);
      navigator.vibrate?.(80);
    } else if (m.attacker === this.me) {
      this.stage.shake(0.25);
    }
  }

  /* ---------------- bonecos ---------------- */

  private addView(id: string, p: NetPlayer): View {
    const critter = makeCritter(p.character);
    critter.root.scale.setScalar(CRITTER_SCALE);
    critter.root.position.set(p.x, p.y - PLAYER_RADIUS, p.z);
    this.stage.scene.add(critter.root);
    const mine = id === this.me;
    const label = escapeHtml(p.name) + (mine ? ' <small>você</small>' : '');
    const tag = this.stage.addTag(critter.root, 1.75, label, mine ? 'tag me' : 'tag');
    const view: View = { id, name: p.name, critter, tag, snaps: [], pos: new THREE.Vector3(p.x, p.y, p.z), face: p.face, speed: 0, ready: false };
    this.views.set(id, view);
    return view;
  }

  private removeView(id: string): void {
    const v = this.views.get(id);
    if (!v) return;
    this.stage.scene.remove(v.critter.root);
    this.stage.removeTag(v.tag);
    this.views.delete(id);
  }

  /* ---------------- quadro a quadro ---------------- */

  private fixedTick(): void {
    if (!this.pred) return;
    const s = this.input.sample();
    // arredonda antes de enviar: servidor e previsão usam exatamente os mesmos números
    const msg: InputMsg = { seq: ++this.seq, x: Math.round(s.x * 1000) / 1000, z: Math.round(s.z * 1000) / 1000, push: s.push };
    this.room.send(MSG.input, msg);
    this.pending.push(msg);
    if (this.pending.length > 120) this.pending.shift();
    stepMove(this.pred, msg);
    integrate(this.pred);
    resolvePillars(this.pred);
  }

  private update(dt: number, t: number): void {
    // inputs em passo fixo de 1/30 s, independente do FPS
    this.acc = Math.min(this.acc + dt, DT * 5);
    while (this.acc >= DT) {
      this.acc -= DT;
      this.fixedTick();
    }
    this.offset.multiplyScalar(Math.exp(-12 * dt));

    const renderT = performance.now() - INTERP_MS;
    for (const v of this.views.values()) {
      let x: number, y: number, z: number, face: number, dashT: number, stunT: number, speed: number;
      if (v.id === this.me && this.pred) {
        x = this.pred.x + this.offset.x;
        z = this.pred.z + this.offset.y;
        y = v.pos.y + (this.serverY - v.pos.y) * (1 - Math.exp(-20 * dt));
        face = this.pred.face;
        dashT = this.pred.dashT;
        stunT = this.pred.stunT;
        speed = Math.hypot(this.pred.vx, this.pred.vz);
      } else {
        const s = sample(v.snaps, renderT);
        if (!s) continue;
        x = s.x; y = s.y; z = s.z; face = s.face; dashT = s.dashT; stunT = s.stunT;
        const moved = v.ready ? Math.hypot(x - v.pos.x, z - v.pos.z) / Math.max(dt, 1e-3) : 0;
        speed = v.speed + (moved - v.speed) * 0.3;
      }

      const prevY = v.pos.y;
      v.pos.set(x, y, z);
      v.speed = speed;
      v.face = v.ready ? lerpAngle(v.face, face, 1 - Math.exp(-14 * dt)) : face;
      v.ready = true;

      const root = v.critter.root;
      root.position.set(x, y - PLAYER_RADIUS, z);
      root.rotation.y = v.face;
      const offArena = Math.hypot(x, z) > ARENA.radius;
      animateCritter(v.critter, t, {
        speed,
        punching: dashT > 0,
        stunned: stunT > 0,
        falling: y < PLAYER_RADIUS - 0.3 && offArena,
      });

      const splashY = SEA_Y + 0.4;
      if (prevY > splashY && y <= splashY) {
        this.stage.splash(x, z);
        this.stage.pop(new THREE.Vector3(x, SEA_Y + 1, z), 'Tchibum!', 'loss');
      }
      if (v.id === this.me) this.stage.follow.set(x, 0, z);
    }

    const k = 1 - Math.exp(-15 * dt);
    this.stage.balls.forEach((m, i) => {
      const tg = this.ballTargets[i];
      if (!tg) return;
      if (m.position.distanceTo(tg.p) > 6) m.position.copy(tg.p);
      else m.position.lerp(tg.p, k);
      m.quaternion.slerp(tg.q, k);
    });
  }

  private close(reason: string | null): void {
    if (this.closed) return;
    this.closed = true;
    for (const id of [...this.views.keys()]) this.removeView(id);
    this.stage.onFrame(null);
    this.input.enabled = false;
    this.onClosed(reason);
  }
}
