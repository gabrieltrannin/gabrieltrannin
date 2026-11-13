import * as THREE from 'three';
import {
  BOARD, HOP_MS, ISLAND_RADIUS, ITEMS, MSG, TILE_INFO,
  forkLabel, lerpAngle, seeded,
  type CoinsMsg, type CrownMsg, type DuelMsg, type ItemId, type MoveMsg, type NoteMsg, type RollMsg, type TeleportMsg, type TileType,
} from '@fuzue/shared';
import { sound } from '../audio/sound';
import { animateCritter, makeCritter, type Critter } from '../engine/critter';
import { canvasTexture, outline, toon, toonMap } from '../engine/materials';
import {
  addHorizon, addLights, addSea, bannerPole, bush, castle, grassTexture, house,
  makeBomb, makeCrown, marketTent, oakTree, pineTree, rock, signpost,
} from '../engine/scenery';
import { reduceMotion, type Tag } from '../engine/Stage';
import { playersBySeat, ranking, type NetPlayer, type NetState } from '../net/types';
import { $, avatar, escapeHtml, setHtml } from '../ui/dom';
import { toast } from '../ui/toast';
import { Bubbles, type Ctx, type RoomView } from './types';

const SLOT = [[-0.26, 0.22], [0.26, 0.22], [-0.26, -0.24], [0.26, -0.24]];
const SCALE = 0.62;
const TILE_TOP = 0.22;

type Anim =
  | { kind: 'hop'; tile: number }
  | { kind: 'tp'; tile: number };

interface Piece {
  id: string;
  critter: Critter;
  tag: Tag;
  seat: number;
  tile: number;
  queue: Anim[];
  anim: { a: Anim; t: number; from: THREE.Vector3; to: THREE.Vector3 } | null;
  character: number;
}

/** Tabuleiro "Vale da Coroa": vale 3D, peões, dados, coroa e o HUD do turno. */
export class BoardView implements RoomView {
  readonly scene = new THREE.Scene();
  private pieces = new Map<string, Piece>();
  private bubbles: Bubbles;
  private iconGroups: THREE.Group[] = [];
  private crownGroup = new THREE.Group();
  private crown = makeCrown();
  private crownTile = -1;
  private crownMove: { t: number; from: number; to: number } | null = null;
  private bombMeshes = new Map<string, THREE.Group>();
  private dice: THREE.Mesh[] = [];
  private diceAnim: { pid: string; values: number[]; t: number } | null = null;
  private sea: (dt: number, t: number) => void;
  private target = new THREE.Vector3();
  private az = 0;
  private drag: { id: number; x: number; az: number } | null = null;
  private state: NetState | null = null;
  private unsub: (() => void)[] = [];
  private timerStart = { deadline: 0, at: 0 };
  private hud = {
    players: $('bPlayers'), round: $('bRound'), turn: $('bTurn'), timer: $('bTimer'),
    dock: $('bDock'), shop: $('bShop'), order: $('bOrder'), duel: $('bDuel'), legend: $('bLegend'),
  };

  constructor(private ctx: Ctx) {
    this.bubbles = new Bubbles(ctx.stage);
    addLights(this.scene, 13);
    this.sea = addSea(this.scene, 7);
    addHorizon(this.scene, 34);
    this.buildIsland();
    this.buildTiles();
    this.buildProps();
    this.crownGroup.add(this.crown);
    this.crown.scale.setScalar(1.35);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.06, 8, 36), toon('#d4af37'));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = TILE_TOP + 0.04;
    ring.name = 'ring';
    this.crownGroup.add(ring);
    this.scene.add(this.crownGroup);
    for (let i = 0; i < 2; i++) {
      const mats = [1, 6, 2, 5, 3, 4].map(n => new THREE.MeshBasicMaterial({ map: pipTexture(n) }));
      const die = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), mats);
      outline(die, 1.08);
      die.visible = false;
      this.scene.add(die);
      this.dice.push(die);
    }
    this.hud.legend.innerHTML = (Object.keys(TILE_INFO) as TileType[]).map(k =>
      `<li><i style="--t:${TILE_INFO[k].color}"></i>${TILE_INFO[k].label}</li>`).join('')
      + '<li>👑 Passe pela coroa com 20 moedas para comprar</li>';
  }

  /* =============== cenário =============== */

  private buildIsland(): void {
    const R = ISLAND_RADIUS;
    const grass = grassTexture();
    grass.repeat.set(5, 5);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, 64), [toon('#5f7d42'), toonMap(grass), toon('#5f7d42')]);
    top.position.y = -0.3;
    top.receiveShadow = true;
    outline(top, 1.008, 1.06);
    this.scene.add(top);
    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.2, R - 0.45, 0.8, 64), toon('#6b4a2f'));
    dirt.position.y = -1;
    this.scene.add(dirt);
    const cliffGeo = new THREE.CylinderGeometry(R - 0.5, 1.6, 5.4, 18, 4).toNonIndexed();
    cliffGeo.computeVertexNormals();
    const cliff = new THREE.Mesh(cliffGeo, toon('#7d7468'));
    cliff.position.y = -4.1;
    this.scene.add(cliff);
    const rand = seeded(4);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rand() * 0.1;
      const r = rock(0.9 + rand() * 1.2, rand() < 0.5 ? '#7d7468' : '#8c857a');
      r.position.set(Math.cos(a) * (R - 0.1), -0.55 - rand() * 0.4, Math.sin(a) * (R - 0.1));
      r.rotation.y = rand() * 3;
      this.scene.add(r);
    }
  }

  private buildTiles(): void {
    const baseGeo = new THREE.CylinderGeometry(0.66, 0.72, 0.2, 10);
    const inlayGeo = new THREE.CylinderGeometry(0.54, 0.54, 0.06, 24);
    const iconGeo = new THREE.CircleGeometry(0.46, 24);
    const stoneGeo = new THREE.DodecahedronGeometry(0.11, 0);
    const stone = toon('#8c857a');
    const iconMats = new Map<TileType, THREE.MeshBasicMaterial>();
    for (const type of Object.keys(TILE_INFO) as TileType[]) {
      iconMats.set(type, new THREE.MeshBasicMaterial({ map: iconTexture(type), transparent: true, depthWrite: false }));
    }
    for (const tile of BOARD) {
      const base = new THREE.Mesh(baseGeo, stone);
      base.position.set(tile.x, 0.1, tile.z);
      base.receiveShadow = true;
      outline(base, 1.05, 1.2);
      this.scene.add(base);
      const inlay = new THREE.Mesh(inlayGeo, toon(TILE_INFO[tile.type].color));
      inlay.position.set(tile.x, 0.21, tile.z);
      this.scene.add(inlay);
      const g = new THREE.Group();
      g.position.set(tile.x, 0.245, tile.z);
      const icon = new THREE.Mesh(iconGeo, iconMats.get(tile.type)!);
      icon.rotation.x = -Math.PI / 2;
      g.add(icon);
      this.scene.add(g);
      this.iconGroups.push(g);
      for (const n of tile.next) {
        const to = BOARD[n];
        const d = new THREE.Mesh(stoneGeo, toon('#a39b8e'));
        d.position.set((tile.x + to.x) / 2, 0.04, (tile.z + to.z) / 2);
        d.scale.y = 0.5;
        this.scene.add(d);
      }
      if (tile.next.length > 1) {
        const sign = signpost();
        sign.position.set(tile.x * 0.82, 0, tile.z * 0.82);
        sign.rotation.y = Math.atan2(tile.x, tile.z);
        this.scene.add(sign);
      }
    }
  }

  private buildProps(): void {
    const rand = seeded(9);
    const avoid = BOARD.map(t => ({ x: t.x, z: t.z, r: 1.0 }));
    // castelo no meio do vale
    const keep = castle();
    keep.position.set(0.2, 0, -0.1);
    keep.scale.setScalar(0.85);
    this.scene.add(keep);
    avoid.push({ x: 0.2, z: -0.1, r: 2.0 });
    const free = (rMin: number, rMax: number, clear: number) => {
      for (let k = 0; k < 80; k++) {
        const a = rand() * Math.PI * 2;
        const r = rMin + rand() * (rMax - rMin);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (avoid.every(o => Math.hypot(o.x - x, o.z - z) > o.r + clear)) {
          avoid.push({ x, z, r: clear });
          return { x, z };
        }
      }
      return null;
    };
    // tendas do mercador ao lado das casas de loja
    for (const t of BOARD.filter(b => b.type === 'loja')) {
      const d = Math.hypot(t.x, t.z) || 1;
      const tent = marketTent('#8e2430');
      tent.position.set(t.x + (t.x / d) * 1.7, 0, t.z + (t.z / d) * 1.7);
      tent.lookAt(t.x, 0, t.z);
      tent.scale.setScalar(0.8);
      this.scene.add(tent);
      avoid.push({ x: tent.position.x, z: tent.position.z, r: 1.2 });
    }
    // estandartes na largada
    const start = BOARD[0];
    for (const sx of [-1, 1]) {
      const b = bannerPole(sx < 0 ? '#8e2430' : '#2f5a8f');
      b.position.set(start.x + sx * 1.1, 0, start.z + 0.9);
      this.scene.add(b);
      avoid.push({ x: b.position.x, z: b.position.z, r: 0.4 });
    }
    // vila
    const roofs = ['#8a6a3a', '#7a5333', '#6f5a3a', '#8e2430'];
    for (let i = 0; i < 7; i++) {
      const s = free(8.2, 9.4, 1.0);
      if (!s) continue;
      const h = house(i % 3 === 0 ? '#cdbb95' : '#d9c9a3', roofs[i % roofs.length]);
      h.position.set(s.x, 0, s.z);
      h.lookAt(0, 0, 0);
      h.scale.setScalar(0.75);
      this.scene.add(h);
    }
    for (let i = 0; i < 14; i++) {
      const s = free(i < 10 ? 8.0 : 1.4, i < 10 ? 9.7 : 3.2, 0.55);
      if (!s) continue;
      const tr = i % 3 === 0 ? oakTree(0.75 + rand() * 0.3) : pineTree(0.8 + rand() * 0.4);
      tr.position.set(s.x, 0, s.z);
      this.scene.add(tr);
    }
    for (let i = 0; i < 18; i++) {
      const s = free(1.2, 9.6, 0.3);
      if (!s) continue;
      const piece = i % 2 ? bush() : rock(0.6 + rand() * 0.6);
      piece.position.x = s.x;
      piece.position.z = s.z;
      piece.rotation.y = rand() * 3;
      this.scene.add(piece);
    }
  }

  /* =============== entrar / sair =============== */

  enter(): void {
    document.body.dataset.scene = 'board';
    $('board').hidden = false;
    for (const p of this.pieces.values()) p.tag.hidden = false;
    this.ctx.input.setEnabled(false);
    const net = this.ctx.net;
    this.unsub.push(
      net.on<RollMsg>(MSG.boardRoll, m => this.onRoll(m)),
      net.on<MoveMsg>(MSG.boardMove, m => this.piece(m.pid)?.queue.push(...m.path.map(tile => ({ kind: 'hop' as const, tile })))),
      net.on<TeleportMsg>(MSG.boardTeleport, m => this.piece(m.pid)?.queue.push({ kind: 'tp', tile: m.tile })),
      net.on<CoinsMsg>(MSG.boardCoins, m => this.onCoins(m)),
      net.on<CrownMsg>(MSG.boardCrown, m => this.onCrown(m)),
      net.on<NoteMsg>(MSG.boardNote, m => {
        toast(m.text, m.tone);
        if (m.tone === 'bad') sound.play('lose');
      }),
      net.on<DuelMsg>(MSG.boardDuel, m => this.onDuel(m)),
    );
    const canvas = this.ctx.stage.canvas;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    $('bHelp').onclick = () => { this.hud.legend.hidden = !this.hud.legend.hidden; };
  }

  exit(): void {
    $('board').hidden = true;
    for (const el of [this.hud.shop, this.hud.order, this.hud.duel, this.hud.legend]) el.hidden = true;
    this.hud.dock.innerHTML = '';
    delete this.hud.dock.dataset.html;
    this.unsub.forEach(u => u());
    this.unsub = [];
    const canvas = this.ctx.stage.canvas;
    canvas.removeEventListener('pointerdown', this.onDown);
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerup', this.onUp);
    canvas.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    this.bubbles.clearAll();
    // o tabuleiro é reaproveitado depois do minijogo: só esconde os nomes
    for (const p of this.pieces.values()) p.tag.hidden = true;
  }

  private onDown = (e: PointerEvent) => { this.drag = { id: e.pointerId, x: e.clientX, az: this.az }; };
  private onMove = (e: PointerEvent) => { if (this.drag?.id === e.pointerId) this.az = this.drag.az - (e.clientX - this.drag.x) * 0.008; };
  private onUp = (e: PointerEvent) => { if (this.drag?.id === e.pointerId) this.drag = null; };
  private onKey = (e: KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter') && this.myTurnStep() === 'roll' && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      this.roll();
    }
  };

  said(from: string, text: string, emote: boolean): void {
    const p = this.pieces.get(from);
    if (p) this.bubbles.show(from, p.critter.root, 1.55, text, emote);
  }

  /* =============== peões =============== */

  private piece(id: string): Piece | undefined {
    return this.pieces.get(id);
  }

  private slotPos(p: Piece, tile: number, out = new THREE.Vector3()): THREE.Vector3 {
    const t = BOARD[tile];
    const o = SLOT[p.seat % 4];
    return out.set(t.x + o[0], TILE_TOP, t.z + o[1]);
  }

  private syncPieces(s: NetState): void {
    const seen = new Set<string>();
    for (const p of playersBySeat(s)) {
      seen.add(p.id);
      let piece = this.pieces.get(p.id);
      if (piece && piece.character !== p.character) {
        this.scene.remove(piece.critter.root);
        this.ctx.stage.removeTag(piece.tag);
        this.pieces.delete(p.id);
        piece = undefined;
      }
      if (!piece) {
        const critter = makeCritter(p.character);
        critter.root.scale.setScalar(SCALE);
        this.scene.add(critter.root);
        const tag = this.ctx.stage.addTag(critter.root, 1.32, '', p.id === this.ctx.net.me ? 'tag me' : 'tag');
        piece = { id: p.id, critter, tag, seat: p.seat, tile: p.tile, queue: [], anim: null, character: p.character };
        this.slotPos(piece, p.tile, critter.root.position);
        this.pieces.set(p.id, piece);
      }
      piece.tag.el.innerHTML = `${escapeHtml(p.name)}${p.id === this.ctx.net.me ? ' <small>você</small>' : ''}${p.away ? ' <small>bot</small>' : ''}`;
      // sem animação pendente e fora do lugar (ex.: voltou de uma queda de conexão): encaixa
      if (!piece.anim && !piece.queue.length && piece.tile !== p.tile && s.board.step !== 'moving') {
        piece.tile = p.tile;
        this.slotPos(piece, p.tile, piece.critter.root.position);
      }
    }
    for (const [id, piece] of this.pieces) {
      if (!seen.has(id)) {
        this.scene.remove(piece.critter.root);
        this.ctx.stage.removeTag(piece.tag);
        this.pieces.delete(id);
      }
    }
  }

  /* =============== mensagens =============== */

  private onRoll(m: RollMsg): void {
    this.diceAnim = { pid: m.pid, values: m.dice, t: 0 };
    sound.play('dice');
  }

  private onCoins(m: CoinsMsg): void {
    const p = this.pieces.get(m.pid);
    if (!p) return;
    const at = p.critter.root.position.clone();
    at.y += 1.3;
    this.ctx.stage.pop(at, `${m.delta > 0 ? '+' : '−'}${Math.abs(m.delta)}`, m.delta > 0 ? 'gain' : 'loss');
    if (m.delta > 0) sound.play('coin');
  }

  private onCrown(m: CrownMsg): void {
    const p = this.pieces.get(m.pid);
    sound.play('crown');
    this.ctx.stage.banner('+1 👑');
    if (p) {
      const at = p.critter.root.position.clone();
      at.y += 1;
      this.ctx.stage.burst(at, 30, 1.3);
    }
  }

  private onDuel(m: DuelMsg): void {
    const s = this.state;
    if (!s) return;
    const a = s.players.get(m.a);
    const b = s.players.get(m.b);
    if (!a || !b) return;
    sound.play('dice');
    const side = (p: NetPlayer, v: number, win: boolean) => `
      <div class="duel-side">${avatar(p.name, p.character)}<b>${escapeHtml(p.name)}</b>
      <div class="die rolling" data-v="${v}" data-win="${win}">?</div></div>`;
    this.hud.duel.innerHTML = `<div class="card duel-card"><h3>Duelo!</h3>
      <div class="duel-row">${side(a, m.ra, m.winner === m.a)}<b style="align-self:center;font-family:var(--display);font-size:28px">VS</b>${side(b, m.rb, m.winner === m.b)}</div>
      <p class="hint" id="duelText">Quem tirar mais leva até ${5} moedas.</p></div>`;
    this.hud.duel.hidden = false;
    window.setTimeout(() => {
      this.hud.duel.querySelectorAll<HTMLElement>('.die').forEach(d => {
        d.classList.remove('rolling');
        d.textContent = d.dataset.v ?? '?';
        if (d.dataset.win === 'true') d.classList.add('win');
      });
      const txt = document.getElementById('duelText');
      const w = m.winner ? s.players.get(m.winner) : null;
      if (txt) txt.textContent = w ? `${w.name} venceu e leva ${m.amount} moedas!` : 'Empate! Ninguém perde nada.';
      sound.play(w ? 'win' : 'pop');
    }, 1300);
    window.setTimeout(() => { this.hud.duel.hidden = true; }, 3400);
  }

  /* =============== ações do jogador =============== */

  private myTurnStep(): string | null {
    const s = this.state;
    if (!s || s.phase !== 'board') return null;
    return s.board.order[s.board.turn] === this.ctx.net.me ? s.board.step : null;
  }

  private roll(): void {
    sound.play('click');
    this.ctx.net.send(MSG.roll);
  }

  /* =============== estado → tela =============== */

  onState(s: NetState): void {
    const first = !this.state;
    this.state = s;
    this.syncPieces(s);
    const b = s.board;

    if (first) {
      this.crownTile = b.crownTile;
      this.placeCrown(b.crownTile);
    } else if (b.crownTile !== this.crownTile && !this.crownMove) {
      this.crownMove = { t: 0, from: this.crownTile, to: b.crownTile };
      this.crownTile = b.crownTile;
    }

    // bombas escondidas nas casas
    const bombKeys = new Set<string>();
    b.bombs.forEach((_owner, tile) => {
      bombKeys.add(tile);
      if (!this.bombMeshes.has(tile)) {
        const bomb = makeBomb(0.7);
        const t = BOARD[Number(tile)];
        bomb.position.set(t.x, TILE_TOP + 0.3, t.z);
        this.scene.add(bomb);
        this.bombMeshes.set(tile, bomb);
      }
    });
    for (const [k, m] of this.bombMeshes) {
      if (!bombKeys.has(k)) { this.scene.remove(m); this.bombMeshes.delete(k); }
    }

    this.renderHud(s);
  }

  private placeCrown(tile: number): void {
    const t = BOARD[tile];
    if (t) this.crownGroup.position.set(t.x, 0, t.z);
  }

  private renderHud(s: NetState): void {
    const me = this.ctx.net.me;
    const b = s.board;
    const current = b.order[b.turn];
    const turnPlayer = current ? s.players.get(current) : undefined;

    // placar
    const ranked = ranking(s);
    setHtml(this.hud.players, ranked.map((p, i) => {
      const items = [...Array.from({ length: p.items.length }, (_, k) => ITEMS[p.items[k] as ItemId]?.icon ?? '')].join('') + (p.shield ? '🛡️' : '');
      const cls = `pcard${p.id === current && s.phase === 'board' ? ' turn' : ''}${p.away ? ' away' : ''}`;
      return `<li class="${cls}"><span class="place">${i + 1}º</span>${avatar(p.name, p.character)}
        <span class="pname">${escapeHtml(p.name)}${p.id === me ? ' ★' : ''}</span>
        <span class="coins num"><i class="coin-i"></i>${p.coins}</span>
        <span class="crowns num">👑${p.crowns}</span>
        <span class="items" aria-label="Itens">${items}</span></li>`;
    }).join(''));

    this.hud.round.textContent = s.phase === 'order' ? 'Sorteio' : `Rodada ${b.round} de ${s.rounds}`;

    // faixa do turno
    let text = '';
    const mine = current === me;
    if (s.phase === 'order') text = 'Quem começa? Todo mundo rola!';
    else if (s.phase !== 'board') text = '';
    else if (mine) {
      text = { roll: 'Sua vez! Use um item ou role o dado.', choose: 'Escolha o caminho', shop: 'Loja: quer comprar algo?', moving: 'Andando…', busy: 'Sua vez', idle: 'Sua vez' }[b.step] ?? 'Sua vez';
    } else if (turnPlayer) {
      text = `Vez de ${turnPlayer.name}${turnPlayer.bot || turnPlayer.away ? ' (bot)' : ''}`;
    }
    this.hud.turn.textContent = text;
    this.hud.turn.hidden = !text;

    // contagem regressiva das decisões
    const deciding = (s.phase === 'order' && !b.orderRolls.has(me)) || (mine && ['roll', 'choose', 'shop'].includes(b.step));
    if (deciding && b.deadline !== this.timerStart.deadline) this.timerStart = { deadline: b.deadline, at: this.ctx.net.serverNow() };
    this.hud.timer.hidden = !deciding;

    // botões de ação
    let dock = '';
    if (s.phase === 'board' && mine && b.step === 'roll') {
      const p = s.players.get(me)!;
      for (let i = 0; i < p.items.length; i++) {
        const def = ITEMS[p.items[i] as ItemId];
        if (!def || def.passive) continue;
        dock += `<button type="button" class="btn item-btn" data-item="${i}" title="${def.name}: ${def.desc}" aria-label="Usar ${def.name}">${def.icon}<small>usar</small></button>`;
      }
      dock += '<button type="button" class="btn roll pink" data-act="roll">Rolar dado</button>';
    } else if (s.phase === 'board' && mine && b.step === 'choose') {
      const from = this.pieces.get(me)?.tile ?? s.players.get(me)!.tile;
      for (let i = 0; i < b.choices.length; i++) {
        const c = b.choices[i];
        dock += `<button type="button" class="btn fork-btn" data-tile="${c}">${forkLabel(from, c)}</button>`;
      }
    }
    setHtml(this.hud.dock, dock);
    this.hud.dock.onclick = e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!btn) return;
      if (btn.dataset.act === 'roll') this.roll();
      else if (btn.dataset.item) { sound.play('click'); this.ctx.net.send(MSG.useItem, { index: Number(btn.dataset.item) }); }
      else if (btn.dataset.tile) { sound.play('click'); this.ctx.net.send(MSG.choose, { tile: Number(btn.dataset.tile) }); }
    };

    // loja
    const shopping = s.phase === 'board' && mine && b.step === 'shop';
    this.hud.shop.hidden = !shopping;
    if (shopping) {
      const p = s.players.get(me)!;
      const full = p.items.length >= 3;
      const cards = Array.from({ length: b.shopOffer.length }, (_, i) => b.shopOffer[i] as ItemId).map(id => {
        const def = ITEMS[id];
        const cant = p.coins < def.price || (full && !def.passive);
        return `<button type="button" class="shop-item" data-buy="${id}" ${cant ? 'disabled' : ''}>
          <span class="ico">${def.icon}</span><span><b>${def.name}</b><br>${def.desc}<br>
          <span class="price"><i class="coin-i"></i>${def.price}</span></span></button>`;
      }).join('');
      setHtml(this.hud.shop, `<div class="card shop-card"><h3>Tenda do Mercador</h3>
        <p class="hint">Você tem ${p.coins} moedas${full ? ' e a bolsa está cheia' : ''}.</p>
        <div class="shop-items">${cards}</div>
        <button type="button" class="btn ghost" data-buy="">Agora não</button></div>`);
      this.hud.shop.onclick = e => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-buy]');
        if (!btn || btn.disabled) return;
        sound.play(btn.dataset.buy ? 'buy' : 'click');
        this.ctx.net.send(MSG.shop, { item: btn.dataset.buy || null });
      };
    }

    // sorteio de quem começa
    this.hud.order.hidden = s.phase !== 'order';
    if (s.phase === 'order') {
      const slots = playersBySeat(s).map(p => {
        const v = b.orderRolls.get(p.id);
        return `<div class="order-slot">${avatar(p.name, p.character)}<b>${escapeHtml(p.name)}</b><div class="die${v === undefined ? ' rolling' : ''}">${v ?? '?'}</div></div>`;
      }).join('');
      const rolled = b.orderRolls.has(me);
      setHtml(this.hud.order, `<div class="card order-card"><h3>Quem começa?</h3>
        <p class="hint">Quem tirar o maior número joga primeiro.</p>
        <div class="order-list">${slots}</div>
        ${rolled ? '<p class="hint">Esperando os outros…</p>' : '<button type="button" class="btn big pink" data-order="1">Rolar!</button>'}</div>`);
      this.hud.order.onclick = e => {
        if ((e.target as HTMLElement).closest('[data-order]')) { sound.play('dice'); this.ctx.net.send(MSG.orderRoll); }
      };
    }
  }

  /* =============== quadro a quadro =============== */

  update(dt: number, t: number): void {
    this.sea(dt, t);
    const s = this.state;

    // peões: animações de pulo e teletransporte
    for (const p of this.pieces.values()) {
      const root = p.critter.root;
      if (!p.anim && p.queue.length) {
        const a = p.queue.shift()!;
        p.anim = { a, t: 0, from: root.position.clone(), to: this.slotPos(p, a.tile) };
        if (a.kind === 'hop') {
          root.rotation.y = Math.atan2(p.anim.to.x - p.anim.from.x, p.anim.to.z - p.anim.from.z);
          sound.play('hop');
        } else {
          this.ctx.stage.burst(root.position.clone().setY(1), 16);
          sound.play('pass');
        }
      }
      if (p.anim) {
        const dur = p.anim.a.kind === 'hop' ? HOP_MS / 1000 : 0.6;
        p.anim.t += dt / dur;
        const k = Math.min(1, p.anim.t);
        if (p.anim.a.kind === 'hop') {
          root.position.lerpVectors(p.anim.from, p.anim.to, k);
          root.position.y = TILE_TOP + Math.sin(k * Math.PI) * 0.75;
          const sq = Math.sin(k * Math.PI) * 0.15;
          p.critter.body.scale.set(1 - sq * 0.4, 1 + sq, 1 - sq * 0.4);
        } else {
          root.scale.setScalar(SCALE * Math.abs(Math.cos(k * Math.PI)));
          if (k >= 0.5) root.position.copy(p.anim.to);
        }
        if (k >= 1) {
          p.tile = p.anim.a.tile;
          root.position.copy(p.anim.to);
          root.scale.setScalar(SCALE);
          p.critter.body.scale.set(1, 1, 1);
          p.anim = null;
        }
      } else {
        animateCritter(p.critter, t, { speed: 0, punching: false, stunned: false, falling: false });
        const cam = this.ctx.stage.camera.position;
        const yaw = Math.atan2(cam.x - root.position.x, cam.z - root.position.z);
        root.rotation.y = lerpAngle(root.rotation.y, yaw, 1 - Math.exp(-4 * dt));
      }
    }

    // dados
    if (this.diceAnim) {
      const d = this.diceAnim;
      d.t += dt;
      const p = this.pieces.get(d.pid);
      const base = p ? p.critter.root.position : new THREE.Vector3();
      d.values.forEach((_v, i) => {
        const die = this.dice[i];
        die.visible = d.t < 1.0;
        die.position.set(base.x + (d.values.length > 1 ? (i - 0.5) * 0.8 : 0), base.y + 1.9 + Math.sin(Math.min(1, d.t) * Math.PI) * 0.4, base.z);
        die.rotation.set(d.t * 11 + i, d.t * 7, d.t * 3);
      });
      if (d.t >= 1.0) {
        this.dice.forEach(die => { die.visible = false; });
        const total = d.values.reduce((a, v) => a + v, 0);
        const at = base.clone();
        at.y += 2;
        this.ctx.stage.pop(at, d.values.length > 1 ? `${d.values.join('+')}=${total}` : String(total), 'big');
        sound.play('pop');
        this.diceAnim = null;
      }
    }

    // coroa
    this.crown.rotation.y += dt * 1.2;
    this.crown.position.y = 1.7 + (reduceMotion ? 0 : Math.sin(t * 2) * 0.12);
    if (this.crownMove) {
      const m = this.crownMove;
      m.t += dt / 1.2;
      const k = Math.min(1, m.t);
      if (k < 0.5) this.crown.scale.setScalar(1.35 * (1 - k * 2));
      else {
        this.placeCrown(m.to);
        this.crown.scale.setScalar(1.35 * (k - 0.5) * 2);
      }
      if (k >= 1) { this.crown.scale.setScalar(1.35); this.crownMove = null; }
    }
    for (const bomb of this.bombMeshes.values()) {
      const spark = bomb.getObjectByName('spark');
      if (spark) spark.scale.setScalar(0.8 + Math.sin(t * 20) * 0.3);
    }

    // barra de tempo
    if (s && !this.hud.timer.hidden) {
      const total = Math.max(1, this.timerStart.deadline - this.timerStart.at);
      const left = Math.max(0, this.timerStart.deadline - this.ctx.net.serverNow());
      (this.hud.timer.firstElementChild as HTMLElement).style.transform = `scaleX(${left / total})`;
    }

    // câmera: segue quem está jogando; arrastar gira
    let focus: THREE.Vector3 | null = null;
    if (s && s.phase === 'board') {
      const cur = this.pieces.get(s.board.order[s.board.turn]);
      if (cur) focus = cur.critter.root.position;
    }
    const portrait = this.ctx.stage.portrait;
    const want = focus ? new THREE.Vector3(focus.x * (portrait ? 0.75 : 0.35), 0, focus.z * (portrait ? 0.75 : 0.35)) : new THREE.Vector3();
    this.target.lerp(want, 1 - Math.exp(-2.5 * dt));
    const dist = portrait ? 19 : 18;
    const el = portrait ? 0.95 : 0.8;
    const az = this.az + (reduceMotion || this.drag ? 0 : Math.sin(t * 0.12) * 0.1);
    const cam = this.ctx.stage.camera;
    cam.position.set(
      this.target.x + Math.sin(az) * Math.cos(el) * dist,
      this.target.y + Math.sin(el) * dist,
      this.target.z + Math.cos(az) * Math.cos(el) * dist,
    );
    cam.lookAt(this.target);
    for (const g of this.iconGroups) g.rotation.y = az;
  }
}

/* =============== texturas =============== */

const ICON_FONT = '"Cinzel","Trajan Pro","Times New Roman",serif';

function iconTexture(type: TileType) {
  return canvasTexture(128, 128, g => {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = '#22170e';
    g.fillStyle = '#f4e6c3';
    const label = TILE_INFO[type].short;
    if (label === 'loja') {
      // bolsa de moedas
      g.lineWidth = 9;
      g.beginPath();
      g.ellipse(64, 78, 28, 26, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(48, 50); g.lineTo(80, 50); g.lineTo(72, 40); g.lineTo(56, 40); g.closePath();
      g.fill();
      g.stroke();
      g.font = `700 34px ${ICON_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#22170e';
      g.fillText('$', 64, 82);
      return;
    }
    if (label === 'VS') {
      // espadas cruzadas
      for (const s of [-1, 1]) {
        g.save();
        g.translate(64, 64);
        g.rotate(s * Math.PI / 4);
        g.lineWidth = 9;
        g.beginPath(); g.moveTo(0, -40); g.lineTo(0, 30); g.stroke();
        g.lineWidth = 5;
        g.strokeStyle = '#f4e6c3';
        g.beginPath(); g.moveTo(0, -40); g.lineTo(0, 30); g.stroke();
        g.strokeStyle = '#22170e';
        g.lineWidth = 9;
        g.beginPath(); g.moveTo(-14, 26); g.lineTo(14, 26); g.stroke();
        g.restore();
      }
      return;
    }
    g.font = `700 ${label.length === 1 ? 82 : 58}px ${ICON_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeText(label, 64, 68);
    g.fillText(label, 64, 68);
  });
}

function pipTexture(n: number) {
  const P: Record<number, number[][]> = {
    1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]],
    4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]],
    6: [[36, 32], [92, 32], [36, 64], [92, 64], [36, 96], [92, 96]],
  };
  return canvasTexture(128, 128, g => {
    g.fillStyle = '#efe3c6';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#4a2a1a';
    for (const [x, y] of P[n]) { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill(); }
  });
}
