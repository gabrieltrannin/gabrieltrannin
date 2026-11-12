import * as THREE from 'three';
import {
  DT, FFA_REWARDS, MINIGAMES, MSG, RACE, SOCCER,
  copyBody, lerpAngle, newBody, stepPlayer, worldFor,
  type Body, type FxMsg, type HitMsg, type InputMsg, type MgResultMsg, type MinigameId,
} from '@fuzue/shared';
import { sound } from '../audio/sound';
import { animateCritter, makeCritter, type Critter } from '../engine/critter';
import { canvasTexture, outline, toon, toonMap } from '../engine/materials';
import { makeBomb, makeCoin, makeShadowMarker } from '../engine/scenery';
import { isTouch, type Tag } from '../engine/Stage';
import type { NetEntity, NetMgPlayer, NetState } from '../net/types';
import { $, avatar, escapeHtml, fmtTime, setHtml } from '../ui/dom';
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

interface EntityView { obj: THREE.Object3D; shadow: THREE.Mesh | null; target: THREE.Vector3; kind: string; last: THREE.Vector3 }

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
  private holderBomb = makeBomb(1);
  private ballRoll = new THREE.Quaternion();
  private result: MgResultMsg | null = null;
  private hud = { name: $('mgName'), timer: $('mgTimer'), board: $('mgBoard'), note: $('mgNote'), intro: $('mgIntro'), count: $('mgCount'), result: $('mgResult') };

  constructor(private ctx: Ctx, id: MinigameId) {
    this.id = id;
    this.env = buildEnv(id, this.scene);
    this.holderBomb.visible = false;
    this.scene.add(this.holderBomb);
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
    if (p.team >= 0) {
      ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 32), toon(SOCCER.teamColors[p.team]));
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
        v = this.createEntity(e);
        this.entities.set(key, v);
      }
      v.target.set(e.x, e.y, e.z);
      if (e.kind === 'sweeper') v.obj.rotation.y = -e.a;
    });
    for (const [key, v] of this.entities) {
      if (!seen.has(key)) {
        this.scene.remove(v.obj);
        if (v.shadow) this.scene.remove(v.shadow);
        this.entities.delete(key);
      }
    }
  }

  private createEntity(e: NetEntity): EntityView {
    let obj: THREE.Object3D;
    let shadow: THREE.Mesh | null = null;
    switch (e.kind) {
      case 'coin': obj = makeCoin(e.s); shadow = makeShadowMarker('#ffc93c', 0.45); break;
      case 'bomb': obj = makeBomb(1); shadow = makeShadowMarker('#ff4d5a', 1.2); break;
      case 'ball': {
        const tex = canvasTexture(512, 256, (g, w, h) => {
          const cols = ['#ff5fa2', '#ffffff', '#ffc93c', '#ffffff', '#4aa3ff', '#ffffff', '#3fd6b0', '#ffffff'];
          cols.forEach((c, i) => { g.fillStyle = c; g.fillRect((i * w) / cols.length, 0, w / cols.length + 1, h); });
        });
        const m = new THREE.Mesh(new THREE.SphereGeometry(SOCCER.ballR, 32, 20), toonMap(tex));
        m.castShadow = true;
        outline(m, 1.04);
        obj = m;
        break;
      }
      case 'sweeper': {
        const g = new THREE.Group();
        const bar = new THREE.Mesh(new THREE.BoxGeometry(RACE.sweeperLength * 2, 0.5, 0.5), toon('#ff5fa2'));
        bar.castShadow = true;
        outline(bar, 1.04, 1.1);
        g.add(bar);
        for (const sx of [-1, 1]) {
          const head = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 16), toon('#ffc93c'));
          head.rotation.x = Math.PI / 2;
          head.position.x = sx * RACE.sweeperLength;
          outline(head, 1.06);
          g.add(head);
        }
        obj = g;
        break;
      }
      default: obj = new THREE.Object3D();
    }
    obj.position.set(e.x, e.y, e.z);
    this.scene.add(obj);
    if (shadow) {
      shadow.position.set(e.x, 0.03, e.z);
      this.scene.add(shadow);
    }
    return { obj, shadow, target: new THREE.Vector3(e.x, e.y, e.z), kind: e.kind, last: new THREE.Vector3(e.x, e.y, e.z) };
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
      title = w === null || w === undefined ? `Empate! ${m.teamScores[0]} x ${m.teamScores[1]}` : `${SOCCER.teamNames[w]} venceu! ${m.teamScores[0]} x ${m.teamScores[1]}`;
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
        team = `<p class="team-note" style="--tc:${SOCCER.teamColors[mine.team]}">Você é do ${SOCCER.teamNames[mine.team]}${mates.length ? ` com ${escapeHtml(mates.join(' e '))}` : ''}. Ataque o gol do outro lado!</p>`;
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
    if (this.id === 'futebol') {
      const sc = [mg.teamScore[0] ?? 0, mg.teamScore[1] ?? 0];
      rows.push(`<li><span class="teams" style="grid-column:1/-1"><span style="color:${SOCCER.teamColors[0]};-webkit-text-stroke:2px var(--ink);paint-order:stroke fill">${sc[0]}</span> x <span style="color:${SOCCER.teamColors[1]};-webkit-text-stroke:2px var(--ink);paint-order:stroke fill">${sc[1]}</span></span></li>`);
    }
    const list: { id: string; p: NetMgPlayer }[] = [];
    mg.players.forEach((p, id) => list.push({ id, p }));
    if (def.scoreLabel && this.id !== 'futebol') list.sort((a, b) => b.p.score - a.p.score);
    for (const { id, p } of list) {
      const info = s.players.get(id);
      if (!info) continue;
      let right = '';
      if (this.id === 'chuva') right = `${p.score} <i class="coin-i"></i>`;
      else if (this.id === 'corrida') right = p.finished ? `🏁 ${p.score}º` : `${Math.max(0, Math.round(p.z - RACE.finishZ))} m`;
      else if (this.id === 'bomba' && id === mg.holder) right = '💣';
      else if (this.id === 'futebol') right = `<span style="color:${SOCCER.teamColors[p.team] ?? '#000'}">●</span>`;
      else right = p.alive ? '' : '✗';
      rows.push(`<li class="${p.alive ? '' : 'out'}">${avatar(info.name, info.character)}<span>${escapeHtml(info.name)}${id === me ? ' ★' : ''}</span><span class="num">${right}</span></li>`);
    }
    setHtml(this.hud.board, rows.join(''));

    // aviso para quem saiu
    let note = '';
    if (mg.step === 'play' && mine) {
      if (!mine.alive) note = 'Você caiu! Torcendo pelos outros…';
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
    this.env.update(dt, t, mg);
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
      if (this.id === 'bomba' && mg.holder === a.id && a.alive) {
        this.holderBomb.visible = true;
        this.holderBomb.position.set(x, y + 1.9, z);
        const pulse = 1 + Math.sin(t * (6 + 20 / Math.max(0.5, mg.fuse))) * 0.12;
        this.holderBomb.scale.setScalar(pulse);
      }
    }
    if (this.id === 'bomba' && !mg.holder) this.holderBomb.visible = false;

    // objetos
    const k = 1 - Math.exp(-18 * dt);
    for (const v of this.entities.values()) {
      v.last.copy(v.obj.position);
      if (v.obj.position.distanceTo(v.target) > 6) v.obj.position.copy(v.target);
      else v.obj.position.lerp(v.target, k);
      if (v.kind === 'coin') v.obj.rotation.z += dt * 4;
      if (v.kind === 'bomb') { const sp = v.obj.getObjectByName('spark'); if (sp) sp.scale.setScalar(0.8 + Math.sin(t * 25) * 0.4); }
      if (v.kind === 'ball') {
        const dx = v.obj.position.x - v.last.x;
        const dz = v.obj.position.z - v.last.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1e-4) {
          const axis = new THREE.Vector3(dz / dist, 0, -dx / dist);
          this.ballRoll.setFromAxisAngle(axis, dist / SOCCER.ballR);
          v.obj.quaternion.premultiply(this.ballRoll);
        }
      }
      if (v.shadow) {
        v.shadow.position.set(v.obj.position.x, 0.03, v.obj.position.z);
        v.shadow.visible = v.obj.position.y > 0.3;
        const h = Math.min(1, v.obj.position.y / 12);
        v.shadow.scale.setScalar(0.6 + (1 - h) * 0.6);
      }
    }

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
      const want = new THREE.Vector3(leader.x * 0.4, 0, leader.z - 3.5);
      this.camTarget.lerp(want, 1 - Math.exp(-5 * dt));
      cam.position.set(this.camTarget.x * 0.8, portrait ? 11 : 8, this.camTarget.z + (portrait ? 14 : 11));
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
