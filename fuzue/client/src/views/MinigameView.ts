import * as THREE from 'three';
import {
  BARDO_COLORS, BARDO_NAMES, CHARACTERS, DT, FFA_REWARDS, MINIGAMES, MSG, TEAMS,
  copyBody, lerpAngle, newBody, stepPlayer, worldFor,
  type Body, type FxMsg, type HitMsg, type InputMsg, type MgResultMsg, type MinigameId,
} from '@fuzue/shared';
import { sound } from '../audio/sound';
import { animateCritter, makeCritter, type Critter } from '../engine/critter';
import { paint } from '../engine/materials';
import { makeBomb, makeCrown } from '../engine/scenery';
import { isTouch, type Tag } from '../engine/Stage';
import type { NetMgPlayer, NetState } from '../net/types';
import { $, avatar, escapeHtml, fmtTime, setHtml } from '../ui/dom';
import { createEntity, type EntityView } from './minigames/entities';
import { buildEnv, type Env } from './minigames/envs';
import { type Ctx, type RoomView } from './types';

const INTERP_MS = 100;
const SNAP_DISTANCE = 3;
const SCALE = 0.85;

interface Snap { t: number; x: number; y: number; z: number; face: number; dashT: number; stunT: number }

interface Actor {
  id: string;
  critter: Critter;
  tag: Tag;
  snaps: Snap[];
  pos: THREE.Vector3;
  face: number;
  speed: number;
  ready: boolean;
  alive: boolean;
  ring: THREE.Mesh | null;
}

function sample(snaps: Snap[], t: number): Snap | null {
  if (!snaps.length) return null;
  if (t <= snaps[0].t) return snaps[0];
  for (let i = snaps.length - 1; i >= 0; i--) {
    const a = snaps[i];
    if (a.t > t) continue;
    const b = snaps[i + 1];
    if (!b) return a;
    if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > SNAP_DISTANCE) return b;
    const k = (t - a.t) / Math.max(1, b.t - a.t);
    return { t, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, face: lerpAngle(a.face, b.face, k), dashT: a.dashT, stunT: a.stunT };
  }
  return snaps[0];
}

/** Um minijogo em andamento. */
export class MinigameView implements RoomView {
  readonly scene = new THREE.Scene();
  readonly id: MinigameId;
  private env: Env;
  private actors = new Map<string, Actor>();
  private entities = new Map<string, EntityView>();
  private state: NetState | null = null;
  private unsub: (() => void)[] = [];
  // previsão do próprio boneco
  private pred: Body | null = null;
  private pending: InputMsg[] = [];
  private seq = 0;
  private acc = 0;
  private offset = new THREE.Vector3();
  private lastStep = '';
  private lastCount = -1;
  private camTarget = new THREE.Vector3();
  private bardCalling = false;
  private lastBardA = -1;
  /** O que flutua sobre a cabeça de quem está com o objeto (barril, coroa). */
  private holderProp: THREE.Object3D | null = null;
  private result: MgResultMsg | null = null;
  private hud = { name: $('mgName'), timer: $('mgTimer'), board: $('mgBoard'), note: $('mgNote'), intro: $('mgIntro'), count: $('mgCount'), result: $('mgResult') };

  constructor(private ctx: Ctx, id: MinigameId) {
    this.id = id;
    this.env = buildEnv(id, this.scene);
    const prop = MINIGAMES[id].holderProp;
    if (prop) {
      this.holderProp = prop === 'bomb' ? makeBomb(1) : makeCrown();
      if (prop === 'crown') this.holderProp.scale.setScalar(1.1);
      this.holderProp.visible = false;
      this.scene.add(this.holderProp);
    }
  }

  private get me(): string { return this.ctx.net.me; }

  enter(): void {
    document.body.dataset.scene = 'minigame';
    $('mg').hidden = false;
    this.hud.name.textContent = MINIGAMES[this.id].name;
    this.hud.result.hidden = true;
    const net = this.ctx.net;
    this.unsub.push(
      net.on<HitMsg>(MSG.hit, m => this.onHit(m)),
      net.on<FxMsg>(MSG.fx, m => this.onFx(m)),
      net.on<MgResultMsg>(MSG.mgResult, m => this.onResult(m)),
    );
    this.hud.intro.onclick = e => {
      if ((e.target as HTMLElement).closest('[data-ready]')) {
        sound.play('click');
        net.send(MSG.mgReady);
      }
    };
    sound.music('fast');
  }

  exit(): void {
    $('mg').hidden = true;
    this.hud.intro.hidden = true;
    this.hud.count.hidden = true;
    this.hud.result.hidden = true;
    this.hud.note.hidden = true;
    this.unsub.forEach(u => u());
    this.unsub = [];
    for (const a of this.actors.values()) this.ctx.stage.removeTag(a.tag);
    this.ctx.input.setEnabled(false);
    sound.music('calm');
  }

  /* =============== rede =============== */

  onState(s: NetState): void {
    this.state = s;
    const mg = s.mg;
    const now = performance.now();
    const seen = new Set<string>();
    mg.players.forEach((p, id) => {
      seen.add(id);
      let a = this.actors.get(id);
      if (!a) a = this.addActor(id, p);
      a.snaps.push({ t: now, x: p.x, y: p.y, z: p.z, face: p.face, dashT: p.dashT, stunT: p.stunT });
      if (a.snaps.length > 40) a.snaps.shift();
      if (a.alive && !p.alive) {
        a.alive = false;
        window.setTimeout(() => { a!.critter.root.visible = false; a!.tag.hidden = true; }, 900);
      }
      if (id === this.me) this.reconcile(p, mg.step === 'play');
    });
    for (const [id, a] of this.actors) {
      if (!seen.has(id)) { this.scene.remove(a.critter.root); this.ctx.stage.removeTag(a.tag); this.actors.delete(id); }
    }
    this.syncEntities(mg.entities);
    if (mg.step !== this.lastStep) this.onStep(mg.step);
    this.renderHud(s);
  }

  private addActor(id: string, p: NetMgPlayer): Actor {
    const info = this.state?.players.get(id);
    const critter = makeCritter(info?.character ?? 0);
    critter.root.scale.setScalar(SCALE);
    critter.root.position.set(p.x, p.y, p.z);
    critter.root.rotation.y = p.face;
    this.scene.add(critter.root);
    const mine = id === this.me;
    const tag = this.ctx.stage.addTag(critter.root, 1.65, `${escapeHtml(info?.name ?? '')}${mine ? ' <small>você</small>' : ''}`, mine ? 'tag me' : 'tag');
    let ring: THREE.Mesh | null = null;
    // anel no chão: cor do time (2v2) ou a cor da tinta do jogador
    const ringColor = MINIGAMES[this.id].mode === 'team' ? TEAMS.colors[p.team] : this.id === 'tinta' ? CHARACTERS[info?.character ?? 0]?.color : undefined;
    if (ringColor) {
      ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 4, 18), paint(ringColor));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      critter.root.add(ring);
    }
    const a: Actor = { id, critter, tag, snaps: [], pos: new THREE.Vector3(p.x, p.y, p.z), face: p.face, speed: 0, ready: false, alive: p.alive, ring };
    this.actors.set(id, a);
    return a;
  }

  private reconcile(p: NetMgPlayer, playing: boolean): void {
    const server: Body = {
      x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, face: p.face,
      dashT: p.dashT, dashCd: p.dashCd, stunT: p.stunT, grounded: p.grounded, boost: p.boost || 1,
    };
    if (!playing || !p.alive) {
      this.pending = [];
      this.pred = copyBody(server, this.pred ?? newBody(0, 0, 0));
      this.offset.set(0, 0, 0);
      return;
    }
    this.pending = this.pending.filter(i => i.seq > p.seq);
    const world = this.world();
    const s = copyBody(server, newBody(0, 0, 0));
    for (const i of this.pending) stepPlayer(s, i, world);
    if (this.pred) {
      this.offset.x += this.pred.x - s.x;
      this.offset.y += this.pred.y - s.y;
      this.offset.z += this.pred.z - s.z;
      if (this.offset.length() > SNAP_DISTANCE) this.offset.set(0, 0, 0);
    }
    this.pred = s;
  }

  private world() {
    const mg = this.state?.mg;
    return worldFor(this.id, { radius: mg?.radius ?? 0, tiles: mg?.tiles ?? [] });
  }

  private syncEntities(map: NetState['mg']['entities']): void {
    const seen = new Set<string>();
    map.forEach((e, key) => {
      seen.add(key);
      let v = this.entities.get(key);
      if (!v) {
        v = createEntity(e);
        this.scene.add(v.obj);
        if (v.shadow) {
          v.shadow.position.set(e.x, 0.03, e.z);
          this.scene.add(v.shadow);
        }
        this.entities.set(key, v);
      }
      v.data = e;
      v.target.set(e.x, e.y, e.z);
    });
    for (const [key, v] of this.entities) {
      if (!seen.has(key)) {
        this.scene.remove(v.obj);
        if (v.shadow) this.scene.remove(v.shadow);
        this.entities.delete(key);
      }
    }
  }

  /* =============== eventos =============== */

  private onStep(step: string): void {
    this.lastStep = step;
    const playing = step === 'play';
    this.ctx.input.setEnabled(playing);
    if (playing) {
      this.ctx.stage.banner('JÁ!', 'pink');
      sound.play('go');
    }
  }

  private onHit(m: HitMsg): void {
    const t = this.actors.get(m.target);
    const at = t ? t.pos.clone() : new THREE.Vector3(m.x, m.y, m.z);
    at.y += 1;
    this.ctx.stage.pop(at, 'POW!', 'gain');
    this.ctx.stage.burst(at, 12);
    sound.play('hit');
    if (m.target === this.me) { this.ctx.stage.shake(0.7); navigator.vibrate?.(60); }
    else if (m.attacker === this.me) this.ctx.stage.shake(0.25);
  }

  private onFx(m: FxMsg): void {
    const at = new THREE.Vector3(m.x, m.y, m.z);
    const stage = this.ctx.stage;
    switch (m.kind) {
      case 'out':
        stage.pop(at.setY(Math.max(at.y, 0) + 1), 'Fora!', 'loss');
        sound.play(m.pid === this.me ? 'fail' : 'splash');
        if (m.pid === this.me) stage.slowMo(0.35, 600);
        break;
      case 'fall':
        stage.pop(at.setY(1.5), 'Ops!', 'loss');
        sound.play('splash');
        break;
      case 'finish':
        stage.pop(at.setY(2), 'Chegou!', 'gain');
        stage.burst(at, 24, 1.2);
        sound.play(m.pid === this.me ? 'win' : 'pop');
        break;
      case 'coin':
        stage.burst(at, 5, 0.5);
        if (m.pid === this.me) sound.play('coin');
        break;
      case 'explode':
        stage.burst(at, 30, 1.5);
        stage.shake(0.6);
        sound.play('explode');
        break;
      case 'goal': {
        const team = m.team ?? 0;
        stage.banner('GOOOL!', team === 0 ? 'pink' : 'sky');
        stage.burst(at, 40, 1.4);
        stage.slowMo(0.3, 900);
        sound.play('goal');
        break;
      }
      case 'pass':
        stage.pop(at, 'Passou!', '');
        sound.play('pass');
        break;
      case 'grab':
        stage.pop(at, m.text ?? 'Peguei!', 'gain');
        stage.burst(at, 10, 0.7);
        sound.play(m.pid === this.me ? 'coin' : 'pop');
        break;
      case 'drop':
        stage.pop(at, 'Derrubou!', 'loss');
        sound.play('lose');
        break;
      case 'score':
        stage.pop(at, m.text ?? '+1', 'gain');
        stage.burst(at, 18, 0.9);
        sound.play(m.pid === this.me || (m.team !== undefined && this.myTeam() === m.team) ? 'win' : 'coin');
        break;
      case 'break':
        stage.pop(at, m.text ?? '+1', m.team === 1 ? 'gain big' : 'gain');
        stage.burst(at, m.team === 1 ? 22 : 10, 0.8);
        sound.play(m.team === 1 ? 'coin' : 'pop');
        break;
      case 'hurt':
        stage.pop(at, m.text ? `−1 ❤` : 'Sem vidas!', 'loss');
        stage.burst(at, 8, 0.6);
        sound.play('hit');
        if (m.pid === this.me) { stage.shake(0.6); navigator.vibrate?.(80); }
        break;
      case 'smash':
        stage.burst(at, 26, 1.3);
        stage.shake(0.35);
        sound.play('explode');
        break;
      case 'splash':
        sound.play('splash');
        break;
      case 'paint':
        stage.pop(at, 'Splash!', 'gain');
        stage.burst(at, 20, 1);
        sound.play('pop');
        break;
    }
  }

  private myTeam(): number {
    return this.state?.mg.players.get(this.me)?.team ?? -1;
  }

  /** O Bardo começou a cantar uma cor nova: anuncia na tela. */
  private watchBard(): void {
    for (const v of this.entities.values()) {
      if (v.kind !== 'bard') continue;
      const color = Math.round(v.data.s);
      const calling = v.data.a >= 0;
      if (calling && (!this.bardCalling || v.data.a > this.lastBardA + 0.3) && color >= 0) {
        this.ctx.stage.banner(`${BARDO_NAMES[color]}!`, 'bard');
        document.documentElement.style.setProperty('--bard', BARDO_COLORS[color]);
        sound.play('turn');
      }
      this.bardCalling = calling;
      this.lastBardA = calling ? v.data.a : -1;
    }
  }

  private onResult(m: MgResultMsg): void {
    this.result = m;
    const s = this.state;
    if (!s) return;
    const me = this.me;
    const won = m.ranking[0]?.includes(me);
    sound.play(won ? 'win' : 'fail');
    let pos = 0;
    const rows: string[] = [];
    m.ranking.forEach(group => {
      group.forEach(id => {
        const p = s.players.get(id);
        if (!p) return;
        const reward = m.rewards[id] ?? 0;
        rows.push(`<li class="${pos === 0 ? 'first' : ''}"><span class="pos">${pos + 1}º</span>${avatar(p.name, p.character)}
          <span>${escapeHtml(p.name)}${id === me ? ' (você)' : ''}</span>
          <span class="gain num">+${reward} <i class="coin-i"></i></span></li>`);
      });
      pos += group.length;
    });
    let title = won ? 'Você venceu!' : 'Fim de jogo!';
    if (m.teamScores) {
      const w = m.winnerTeam;
      title = w === null || w === undefined ? `Empate! ${m.teamScores[0]} x ${m.teamScores[1]}` : `${TEAMS.names[w]} venceu! ${m.teamScores[0]} x ${m.teamScores[1]}`;
    }
    this.hud.result.innerHTML = `<div class="card result-card"><h2 style="margin:0;font-family:var(--display);font-weight:400;font-size:30px">${title}</h2>
      <ol class="res-list">${rows.join('')}</ol><p class="hint">Voltando para o tabuleiro…</p></div>`;
    this.hud.result.hidden = false;
    this.ctx.input.setEnabled(false);
  }

  /* =============== HUD =============== */

  private renderHud(s: NetState): void {
    const mg = s.mg;
    const def = MINIGAMES[this.id];
    const me = this.me;
    const mine = mg.players.get(me);

    // instruções
    const intro = mg.step === 'intro';
    this.hud.intro.hidden = !intro;
    if (intro) {
      const chips: string[] = [];
      mg.players.forEach((p, id) => {
        const info = s.players.get(id);
        if (!info) return;
        const ok = p.ready || info.bot || info.away;
        chips.push(`<span class="badge ${ok ? 'ok' : 'wait'}">${escapeHtml(info.name)} ${ok ? '✓' : '…'}</span>`);
      });
      const controls = isTouch
        ? '<span>🕹️ Joystick: andar</span><span>Pular</span><span>Empurrar</span>'
        : '<span><b>WASD</b> ou setas: andar</span><span><b>Espaço</b>: pular</span><span><b>J</b> ou clique: empurrar</span>';
      let team = '';
      if (def.mode === 'team' && mine && mine.team >= 0) {
        const mates: string[] = [];
        mg.players.forEach((p, id) => { if (id !== me && p.team === mine.team) mates.push(s.players.get(id)?.name ?? ''); });
        team = `<p class="team-note" style="--tc:${TEAMS.colors[mine.team]}">Você é da ${TEAMS.names[mine.team]}${mates.length ? ` com ${escapeHtml(mates.join(' e '))}` : ''}. ${def.teamHint ?? ''}</p>`;
      }
      const rewards = def.mode === 'team' ? 'Time vencedor: +8 moedas cada' : `Prêmio: ${FFA_REWARDS.slice(0, 3).map((r, i) => `${i + 1}º +${r}`).join(' · ')}`;
      setHtml(this.hud.intro, `<div class="card intro-card">
        <span class="eyebrow">Minijogo</span>
        <h2>${def.name}</h2>
        <p class="rule">${def.rule}</p>
        ${team}
        <div class="controls">${controls}</div>
        <p class="hint">${rewards}</p>
        <div class="ready-row">${chips.join('')}</div>
        ${mine?.ready ? '<p class="hint">Esperando os outros…</p>' : '<button type="button" class="btn big pink" data-ready="1">Estou pronto!</button>'}
        <p class="hint" data-left>Começa em ${Math.ceil(this.ctx.net.secondsLeft(mg.stepEnds))} s</p>
      </div>`);
    }

    // placar
    const rows: string[] = [];
    if (def.hud === 'team') {
      const sc = [mg.teamScore[0] ?? 0, mg.teamScore[1] ?? 0];
      const num = (i: number) => `<span style="color:${TEAMS.colors[i]};-webkit-text-stroke:2px var(--ink);paint-order:stroke fill">${sc[i]}</span>`;
      rows.push(`<li><span class="teams" style="grid-column:1/-1">${num(0)} x ${num(1)}</span></li>`);
    }
    const list: { id: string; p: NetMgPlayer }[] = [];
    mg.players.forEach((p, id) => list.push({ id, p }));
    if (def.hud === 'score' || def.hud === 'lives') list.sort((a, b) => Number(b.p.alive) - Number(a.p.alive) || b.p.score - a.p.score);
    for (const { id, p } of list) {
      const info = s.players.get(id);
      if (!info) continue;
      let right = p.alive ? '' : '✗';
      switch (def.hud) {
        case 'score':
          right = def.unit === 'coin' ? `${p.score} <i class="coin-i"></i>` : `${p.score} ${def.unit ?? ''}`;
          if (def.holderProp === 'crown' && id === mg.holder) right = `👑 ${right}`;
          break;
        case 'lives': right = p.alive ? '❤'.repeat(Math.max(0, p.score)) : '✗'; break;
        case 'race': right = p.finished ? `🏁 ${p.score}º` : `${Math.max(0, Math.round(p.z - (def.finishZ ?? 0)))} m`; break;
        case 'holder': if (id === mg.holder) right = '💣'; break;
        case 'team': right = `<span style="color:${TEAMS.colors[p.team] ?? '#000'}">●</span>`; break;
      }
      rows.push(`<li class="${p.alive ? '' : 'out'}">${avatar(info.name, info.character)}<span>${escapeHtml(info.name)}${id === me ? ' ★' : ''}</span><span class="num">${right}</span></li>`);
    }
    setHtml(this.hud.board, rows.join(''));

    // aviso para quem saiu
    let note = '';
    if (mg.step === 'play' && mine) {
      if (!mine.alive) note = def.hud === 'lives' ? 'Acabaram suas vidas! Torcendo pelos outros…' : 'Você caiu! Torcendo pelos outros…';
      else if (mine.finished) note = `Você chegou em ${mine.score}º!`;
    }
    this.hud.note.hidden = !note;
    this.hud.note.textContent = note;
  }

  /* =============== quadro a quadro =============== */

  private fixedTick(): void {
    const s = this.state;
    if (!s || !this.pred || s.mg.step !== 'play') return;
    const mine = s.mg.players.get(this.me);
    if (!mine || !mine.alive || mine.finished || this.result) return;
    const raw = this.ctx.input.sample();
    const w = this.screenToWorld(raw.x, raw.z);
    const msg: InputMsg = { seq: ++this.seq, x: Math.round(w.x * 1000) / 1000, z: Math.round(w.z * 1000) / 1000, push: raw.push, jump: raw.jump };
    this.ctx.net.send(MSG.input, msg);
    this.pending.push(msg);
    if (this.pending.length > 120) this.pending.shift();
    const r = stepPlayer(this.pred, msg, this.world());
    if (r.jumped) sound.play('jump');
    if (r.dashed) sound.play('dash');
  }

  /** Converte a direção da tela (cima = longe da câmera) para o mundo. */
  private screenToWorld(x: number, z: number): { x: number; z: number } {
    const cam = this.ctx.stage.camera;
    let fx = this.camTarget.x - cam.position.x;
    let fz = this.camTarget.z - cam.position.z;
    const d = Math.hypot(fx, fz) || 1;
    fx /= d; fz /= d;
    const rx = -fz;
    const rz = fx;
    return { x: rx * x + fx * -z, z: rz * x + fz * -z };
  }

  update(dt: number, t: number): void {
    const s = this.state;
    const mg = s?.mg ?? null;
    this.env.update(dt, t, mg, s);
    if (!s || !mg) return;

    this.acc = Math.min(this.acc + dt, DT * 5);
    while (this.acc >= DT) {
      this.acc -= DT;
      this.fixedTick();
    }
    this.offset.multiplyScalar(Math.exp(-12 * dt));

    // contagem regressiva e relógio
    if (mg.step === 'countdown') {
      const left = Math.ceil(this.ctx.net.secondsLeft(mg.stepEnds));
      if (left !== this.lastCount && left > 0 && left <= 3) {
        this.lastCount = left;
        this.hud.count.hidden = false;
        this.hud.count.innerHTML = `<span>${left}</span>`;
        sound.play('tick');
      }
    } else {
      this.hud.count.hidden = true;
      this.lastCount = -1;
    }
    const left = mg.step === 'play' ? this.ctx.net.secondsLeft(mg.stepEnds) : mg.step === 'intro' || mg.step === 'countdown' ? MINIGAMES[this.id].duration : 0;
    this.hud.timer.textContent = fmtTime(left);
    this.hud.timer.classList.toggle('hurry', mg.step === 'play' && left <= 10);
    const leftEl = this.hud.intro.querySelector<HTMLElement>('[data-left]');
    if (leftEl && mg.step === 'intro') leftEl.textContent = `Começa em ${Math.ceil(this.ctx.net.secondsLeft(mg.stepEnds))} s`;

    // bonecos
    const renderT = performance.now() - INTERP_MS;
    let focus: THREE.Vector3 | null = null;
    for (const a of this.actors.values()) {
      let x: number, y: number, z: number, face: number, dashT: number, stunT: number, speed: number;
      const mine = a.id === this.me;
      if (mine && this.pred && mg.step === 'play' && a.alive) {
        x = this.pred.x + this.offset.x;
        y = this.pred.y + this.offset.y;
        z = this.pred.z + this.offset.z;
        face = this.pred.face;
        dashT = this.pred.dashT;
        stunT = this.pred.stunT;
        speed = Math.hypot(this.pred.vx, this.pred.vz);
      } else {
        const sm = sample(a.snaps, renderT);
        if (!sm) continue;
        x = sm.x; y = sm.y; z = sm.z; face = sm.face; dashT = sm.dashT; stunT = sm.stunT;
        const moved = a.ready ? Math.hypot(x - a.pos.x, z - a.pos.z) / Math.max(dt, 1e-3) : 0;
        speed = a.speed + (moved - a.speed) * 0.3;
      }
      a.pos.set(x, y, z);
      a.speed = speed;
      a.face = a.ready ? lerpAngle(a.face, face, 1 - Math.exp(-14 * dt)) : face;
      a.ready = true;
      const root = a.critter.root;
      root.position.set(x, y, z);
      root.rotation.y = a.face;
      const result = mg.step === 'result' && this.result;
      animateCritter(a.critter, t, {
        speed: result ? 0 : speed,
        punching: dashT > 0,
        stunned: stunT > 0,
        falling: y < -0.6,
        celebrate: !!(result && this.result?.ranking[0]?.includes(a.id)),
      });
      if (mine) focus = a.pos;
      if (this.holderProp && mg.holder === a.id && a.alive) {
        const prop = this.holderProp;
        prop.visible = true;
        prop.position.set(x, y + (this.id === 'bomba' ? 1.9 : 1.75), z);
        if (this.id === 'bomba') prop.scale.setScalar(1 + Math.sin(t * (6 + 20 / Math.max(0.5, mg.fuse))) * 0.12);
        else prop.rotation.y = t * 2;
      }
    }
    if (this.holderProp && (!mg.holder || !this.actors.get(mg.holder)?.alive)) this.holderProp.visible = false;

    // objetos
    const k = 1 - Math.exp(-18 * dt);
    for (const v of this.entities.values()) {
      v.last.copy(v.obj.position);
      if (!v.fixed) {
        if (v.obj.position.distanceTo(v.target) > 6) v.obj.position.copy(v.target);
        else v.obj.position.lerp(v.target, k);
      }
      v.tick?.(v, dt, t);
      if (v.shadow) {
        v.shadow.position.set(v.obj.position.x, 0.03, v.obj.position.z);
        v.shadow.visible = v.obj.position.y > 0.3;
        const h = Math.min(1, v.obj.position.y / 12);
        v.shadow.scale.setScalar(0.6 + (1 - h) * 0.6);
      }
    }

    if (this.id === 'bardo') this.watchBard();
    this.updateCamera(dt, focus);
  }

  private updateCamera(dt: number, focus: THREE.Vector3 | null): void {
    const cam = this.ctx.stage.camera;
    const portrait = this.ctx.stage.portrait;
    const mode = MINIGAMES[this.id].camera;
    const f = focus ?? new THREE.Vector3();
    if (mode === 'follow') {
      let leader = f;
      if (!focus) {
        let best = Infinity;
        for (const a of this.actors.values()) if (a.pos.z < best) { best = a.pos.z; leader = a.pos; }
      }
      // nas ladeiras a câmera sobe junto (quem cai num buraco não puxa a câmera para baixo)
      const want = new THREE.Vector3(leader.x * 0.4, Math.max(0, leader.y), leader.z - 3.5);
      this.camTarget.lerp(want, 1 - Math.exp(-5 * dt));
      cam.position.set(this.camTarget.x * 0.8, this.camTarget.y + (portrait ? 11 : 8), this.camTarget.z + (portrait ? 14 : 11));
    } else if (mode === 'climb') {
      // escalada: acompanha a altura de quem joga (ou da lava, para quem já saiu)
      const lava = this.state?.mg.radius ?? 0;
      const y = focus && focus.y > lava - 0.5 ? focus.y : Math.max(0, lava + 1);
      this.camTarget.lerp(new THREE.Vector3(f.x * 0.3, y, f.z * 0.3 + 0.5), 1 - Math.exp(-3 * dt));
      cam.position.set(this.camTarget.x * 0.5, this.camTarget.y + (portrait ? 17 : 12), this.camTarget.z + (portrait ? 15 : 13));
    } else if (mode === 'field') {
      this.camTarget.lerp(new THREE.Vector3(f.x * 0.15, 0, 0.6), 1 - Math.exp(-3 * dt));
      if (portrait) cam.position.set(this.camTarget.x + 24, 26, this.camTarget.z);
      else cam.position.set(this.camTarget.x, 19, this.camTarget.z + 14);
    } else {
      const k = this.env.size / 9;
      const deep = this.id === 'hexa' && f.y < -3 ? f.y : 0;
      this.camTarget.lerp(new THREE.Vector3(f.x * 0.2, deep, f.z * 0.2 + 0.6), 1 - Math.exp(-3 * dt));
      cam.position.set(this.camTarget.x, this.camTarget.y + (portrait ? 22 : 15) * k, this.camTarget.z + (portrait ? 17 : 13.5) * k);
    }
    cam.lookAt(this.camTarget);
  }
}
