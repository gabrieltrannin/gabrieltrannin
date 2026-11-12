import * as THREE from 'three';
import { BOT_LEVELS, CHARACTERS, MAX_PLAYERS, MSG, ROUND_OPTIONS, seeded } from '@fuzue/shared';
import { sound } from '../audio/sound';
import { animateCritter, makeCritter, type Critter } from '../engine/critter';
import { ball, outline, toon } from '../engine/materials';
import { addLights } from '../engine/scenery';
import { reduceMotion, type Tag } from '../engine/Stage';
import { playersBySeat, type NetPlayer, type NetState } from '../net/types';
import { $, avatar, copyText, escapeHtml, setHtml } from '../ui/dom';
import { toast } from '../ui/toast';
import { Bubbles, type Ctx, type RoomView } from './types';

const SEAT_X = [-2.55, -0.85, 0.85, 2.55];
const SEAT_Z = [-0.25, 0.2, 0.2, -0.25];

interface Seat { critter: Critter | null; character: number; id: string; tag: Tag; pedestal: THREE.Mesh }

/** Lobby: pedestais com os bonecos + painel da sala. */
export class LobbyView implements RoomView {
  readonly scene = new THREE.Scene();
  private seats: Seat[] = [];
  private balloons: { g: THREE.Group; y: number; ph: number }[] = [];
  private bubbles: Bubbles;
  private state: NetState | null = null;
  private panel = $('lobby');

  constructor(private ctx: Ctx) {
    this.bubbles = new Bubbles(ctx.stage);
    addLights(this.scene, 9);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.7, 0.5, 56), toon('#ffd3e8'));
    stage.position.y = -0.25;
    stage.receiveShadow = true;
    outline(stage, 1.012, 1.1);
    this.scene.add(stage);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(5.45, 0.09, 8, 90), toon('#ffc93c'));
    rim.rotation.x = Math.PI / 2;
    this.scene.add(rim);

    for (let i = 0; i < MAX_PLAYERS; i++) {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.42, 28), toon('#e9e1fb'));
      ped.position.set(SEAT_X[i], 0.21, SEAT_Z[i]);
      ped.castShadow = true;
      ped.receiveShadow = true;
      outline(ped, 1.05);
      this.scene.add(ped);
      const anchor = new THREE.Object3D();
      anchor.position.set(SEAT_X[i], 0.42, SEAT_Z[i]);
      this.scene.add(anchor);
      const tag = ctx.stage.addTag(anchor, 2.15, '', 'tag');
      this.seats.push({ critter: null, character: -1, id: '', tag, pedestal: ped });
    }

    const rand = seeded(3);
    const colors = ['#ff5fa2', '#ffc93c', '#3fd6b0', '#4aa3ff', '#a77bff', '#ff8a3d'];
    const lineMat = new THREE.LineBasicMaterial({ color: '#2a1d45' });
    for (let i = 0; i < 11; i++) {
      const g = new THREE.Group();
      const col = colors[i % colors.length];
      const b = ball(0.38, toon(col), 1, 1.18, 1);
      outline(b, 1.05);
      g.add(b);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.45, 0), new THREE.Vector3(0.05, -1, 0), new THREE.Vector3(-0.04, -1.6, 0)]), lineMat));
      const y = 2.7 + rand() * 1.8;
      g.position.set(-6 + i * 1.2 + (rand() - 0.5) * 0.6, y, -2.2 - rand() * 2.2);
      this.scene.add(g);
      this.balloons.push({ g, y, ph: rand() * Math.PI * 2 });
    }

    // painel: botões que não dependem do estado
    $('copyLink').addEventListener('click', () => void this.copyLink());
    const share = $('shareLink');
    share.hidden = typeof navigator.share !== 'function';
    share.addEventListener('click', () => {
      navigator.share?.({ title: 'Fuzuê', text: 'Bora jogar Fuzuê? Entra na minha sala:', url: this.link() }).catch(() => {});
    });
    $('lobbyChars').addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-i]');
      if (!b) return;
      sound.play('click');
      ctx.net.send(MSG.character, { character: Number(b.dataset.i) });
    });
    const seg = (id: string, fn: (v: string) => void) => $(id).addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-v]');
      if (!b || b.disabled) return;
      sound.play('click');
      fn(b.dataset.v!);
    });
    seg('setRounds', v => ctx.net.send(MSG.settings, { rounds: Number(v) }));
    seg('setBots', v => ctx.net.send(MSG.settings, { fillBots: v === '1' }));
    seg('setLevel', v => ctx.net.send(MSG.settings, { botLevel: Number(v) }));
    $('lobbyAction').addEventListener('click', () => {
      const s = this.state;
      if (!s) return;
      sound.play('click');
      if (s.hostId === ctx.net.me) ctx.net.send(MSG.start);
      else ctx.net.send(MSG.ready, { ready: !s.players.get(ctx.net.me)?.ready });
    });
  }

  private link(): string {
    return `${location.origin}/sala/${this.ctx.net.code}`;
  }

  private async copyLink(): Promise<void> {
    if (await copyText(this.link())) toast('Link copiado! Agora é só mandar no grupo.', 'good');
    else toast(`Copie este link: ${this.link()}`, 'info', 6000);
  }

  enter(): void {
    document.body.dataset.scene = 'lobby';
    this.panel.hidden = false;
    $('lobbyCode').textContent = this.ctx.net.code;
    this.ctx.input.setEnabled(false);
  }

  exit(): void {
    this.panel.hidden = true;
    this.bubbles.clearAll();
    for (const s of this.seats) this.ctx.stage.removeTag(s.tag);
  }

  viewOffset(w: number, h: number): { x: number; y: number } {
    return w >= 820 ? { x: -w * 0.19, y: 0 } : { x: 0, y: h * 0.3 };
  }

  said(from: string, text: string, emote: boolean): void {
    const seat = this.seats.find(s => s.id === from);
    if (seat?.critter) this.bubbles.show(from, seat.critter.root, 2.6, text, emote);
  }

  onState(s: NetState): void {
    this.state = s;
    const me = this.ctx.net.me;
    const players = playersBySeat(s);
    const bySeat = new Map(players.map(p => [p.seat, p]));

    // bonecos nos pedestais
    this.seats.forEach((seat, i) => {
      const p = bySeat.get(i);
      if (!p) {
        if (seat.critter) { this.scene.remove(seat.critter.root); seat.critter = null; }
        seat.id = '';
        seat.character = -1;
        seat.tag.el.innerHTML = s.fillBots ? '<small>vaga para bot</small>' : '<small>vaga livre</small>';
        seat.pedestal.material = toon('#e9e1fb');
        return;
      }
      if (seat.character !== p.character || seat.id !== p.id) {
        if (seat.critter) this.scene.remove(seat.critter.root);
        seat.critter = makeCritter(p.character);
        seat.critter.root.position.set(SEAT_X[i], 0.42, SEAT_Z[i]);
        seat.critter.root.rotation.y = -SEAT_X[i] * 0.08;
        this.scene.add(seat.critter.root);
        seat.character = p.character;
        seat.id = p.id;
        seat.pedestal.material = toon(CHARACTERS[p.character].color);
      }
      seat.tag.el.innerHTML = `${escapeHtml(p.name)}${p.id === me ? ' <small>você</small>' : ''}${p.ready || p.id === s.hostId ? ' <small>✓</small>' : ''}`;
    });

    this.renderPanel(s, players);
  }

  private renderPanel(s: NetState, players: NetPlayer[]): void {
    const me = this.ctx.net.me;
    const isHost = s.hostId === me;
    const mine = s.players.get(me);

    const seatsHtml = Array.from({ length: MAX_PLAYERS }, (_, i) => {
      const p = players.find(x => x.seat === i);
      if (!p) return `<li class="empty">${s.fillBots ? 'Vaga livre (entra um bot)' : 'Vaga livre: mande o link!'}</li>`;
      const ch = CHARACTERS[p.character];
      const badge = p.id === s.hostId ? '<span class="badge ok">anfitrião</span>' : p.ready ? '<span class="badge ok">pronto</span>' : '<span class="badge wait">esperando</span>';
      return `<li>${avatar(p.name, p.character)}<span class="who"><b>${escapeHtml(p.name)}${p.id === me ? ' (você)' : ''}</b><small>${ch.name} · ${p.ping} ms</small></span>${badge}</li>`;
    }).join('');
    setHtml($('lobbySeats'), seatsHtml);

    setHtml($('lobbyChars'), CHARACTERS.map((c, i) => `
      <button type="button" class="char" data-i="${i}" style="--pc:${c.color};--pb:${c.belly}" aria-pressed="${mine?.character === i}" aria-label="${c.name}" title="${c.name}">
        <span class="swatch" aria-hidden="true"></span><span>${c.name}</span>
      </button>`).join(''));

    const seg = (values: { v: string; label: string }[], current: string) =>
      values.map(o => `<button type="button" data-v="${o.v}" aria-pressed="${o.v === current}" ${isHost ? '' : 'disabled'}>${o.label}</button>`).join('');
    setHtml($('setRounds'), seg(ROUND_OPTIONS.map(r => ({ v: String(r), label: String(r) })), String(s.rounds)));
    setHtml($('setBots'), seg([{ v: '1', label: 'Bots' }, { v: '0', label: 'Ninguém' }], s.fillBots ? '1' : '0'));
    setHtml($('setLevel'), seg(BOT_LEVELS.map((l, i) => ({ v: String(i), label: l })), String(s.botLevel)));
    ($('setLevel').parentElement as HTMLElement).hidden = !s.fillBots;
    // só o anfitrião mexe nas configurações; os outros veem um resumo
    ($('setRounds').closest('.settings') as HTMLElement).hidden = !isHost;
    const summary = $('lobbySummary');
    summary.hidden = isHost;
    summary.textContent = `${s.rounds} rodadas · ${s.fillBots ? `vagas vazias com bots (${BOT_LEVELS[s.botLevel] ?? ''})` : 'sem bots'}`;

    const humans = players.filter(p => !p.bot);
    const waiting = humans.filter(p => !p.ready && p.id !== s.hostId);
    const total = s.fillBots ? MAX_PLAYERS : humans.length;
    const action = $('lobbyAction') as HTMLButtonElement;
    const hint = $('lobbyHint');
    if (isHost) {
      action.textContent = 'Começar partida';
      action.className = 'btn big mint';
      action.disabled = waiting.length > 0 || total < 2;
      hint.textContent = waiting.length ? `Esperando ${waiting.map(p => p.name).join(', ')} apertar Pronto.`
        : total < 2 ? 'Chame alguém pelo link ou ligue os bots para começar.'
        : `${humans.length} ${humans.length === 1 ? 'jogador' : 'jogadores'}${s.fillBots && humans.length < MAX_PLAYERS ? ` + ${MAX_PLAYERS - humans.length} bot${MAX_PLAYERS - humans.length > 1 ? 's' : ''}` : ''}. Tudo pronto!`;
    } else {
      action.disabled = false;
      action.textContent = mine?.ready ? 'Pronto! (toque para cancelar)' : 'Estou pronto!';
      action.className = mine?.ready ? 'btn big ghost' : 'btn big';
      const host = s.players.get(s.hostId);
      hint.textContent = mine?.ready ? `Esperando ${host?.name ?? 'o anfitrião'} começar a partida.` : 'Escolha seu personagem e aperte Pronto.';
    }
  }

  update(_dt: number, t: number): void {
    for (const seat of this.seats) {
      if (seat.critter) animateCritter(seat.critter, t, { speed: 0, punching: false, stunned: false, falling: false, waving: seat.id === this.ctx.net.me });
    }
    for (const b of this.balloons) {
      b.g.position.y = b.y + (reduceMotion ? 0 : Math.sin(t * 1.2 + b.ph) * 0.15);
    }
    const cam = this.ctx.stage.camera;
    const portrait = this.ctx.stage.portrait;
    cam.position.set(Math.sin(t * 0.2) * 0.3, portrait ? 3.2 : 2.5, portrait ? 13 : 7.8);
    cam.lookAt(0, 1, 0);
  }
}
