import * as THREE from 'three';
import { MSG, type BonusMsg } from '@fuzue/shared';
import { sound } from '../audio/sound';
import { animateCritter, makeCritter, type Critter } from '../engine/critter';
import { canvasTexture, outline, toon, toonMap } from '../engine/materials';
import { addHorizon, addLights, addSea, bannerPole, cobbleTexture, flicker, makeCrown, torch } from '../engine/scenery';
import { reduceMotion } from '../engine/Stage';
import { playersBySeat, type NetState } from '../net/types';
import { $, avatar, escapeHtml, setHtml } from '../ui/dom';
import { Bubbles, type Ctx, type RoomView } from './types';

const SPOTS: Record<number, { x: number; h: number }> = { 1: { x: 0, h: 1.6 }, 2: { x: -2.1, h: 1.1 }, 3: { x: 2.1, h: 0.7 } };

/** Prêmios surpresa e pódio. */
export class FinalView implements RoomView {
  readonly scene = new THREE.Scene();
  private critters = new Map<string, { critter: Critter; place: number }>();
  private state: NetState | null = null;
  private unsub: (() => void)[] = [];
  private bubbles: Bubbles;
  private sea: (dt: number, t: number) => void;
  private confetti: { mesh: THREE.Mesh; vy: number; spin: number }[] = [];
  private announced = false;

  constructor(private ctx: Ctx) {
    this.bubbles = new Bubbles(ctx.stage);
    addLights(this.scene, 8);
    this.sea = addSea(this.scene, 21);
    addHorizon(this.scene, 30);
    const cobble = cobbleTexture('#8c857a', '#9e968a', '#5f594f', 12);
    cobble.repeat.set(4, 4);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.3, 0.5, 48), [toon('#6f685e'), toonMap(cobble), toon('#6f685e')]);
    floor.position.y = -0.25;
    floor.receiveShadow = true;
    outline(floor, 1.01, 1.1);
    this.scene.add(floor);
    for (const [place, spot] of Object.entries(SPOTS)) {
      const stone = toon('#9a9286');
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.8, spot.h, 1.6), [
        stone, stone, stone, stone,
        new THREE.MeshToonMaterial({ map: canvasTexture(128, 128, g => {
          g.fillStyle = '#9a9286';
          g.fillRect(0, 0, 128, 128);
          g.fillStyle = place === '1' ? '#d4af37' : place === '2' ? '#b9bec4' : '#b07a45';
          g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.fill();
          g.lineWidth = 6; g.strokeStyle = '#22170e'; g.stroke();
          g.font = '700 64px "Cinzel","Times New Roman",serif';
          g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#22170e';
          g.fillText(['I', 'II', 'III'][Number(place) - 1], 64, 68);
        }) }),
        stone,
      ]);
      block.position.set(spot.x, spot.h / 2, 0);
      block.castShadow = true;
      block.receiveShadow = true;
      outline(block, 1.03);
      this.scene.add(block);
    }
    for (const [x, c] of [[-4.2, '#8e2430'], [4.2, '#2f5a8f']] as const) {
      const b = bannerPole(c, 3.6);
      b.position.set(x, 0, -1.5);
      this.scene.add(b);
      const t = torch();
      t.position.set(x * 0.75, 0, 1.6);
      this.scene.add(t);
    }
    // moedas de ouro e pétalas caindo
    const colors = ['#d4af37', '#d4af37', '#8e2430', '#efe3c6', '#c98f97'];
    const geo = new THREE.PlaneGeometry(0.13, 0.13);
    for (let i = 0; i < (reduceMotion ? 0 : 110); i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }));
      mesh.position.set((Math.random() - 0.5) * 12, Math.random() * 9, (Math.random() - 0.5) * 6 - 1);
      this.scene.add(mesh);
      this.confetti.push({ mesh, vy: 0.6 + Math.random(), spin: (Math.random() - 0.5) * 6 });
    }
  }

  enter(): void {
    document.body.dataset.scene = 'podium';
    $('final').hidden = false;
    this.ctx.input.setEnabled(false);
    this.unsub.push(this.ctx.net.on<BonusMsg>(MSG.bonus, m => void this.showBonuses(m)));
    $('podium').onclick = e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
      if (!b) return;
      sound.play('click');
      if (b.dataset.act === 'again') this.ctx.net.send(MSG.again);
      if (b.dataset.act === 'leave') document.getElementById('leaveBtn')?.click();
    };
  }

  exit(): void {
    $('final').hidden = true;
    $('bonus').hidden = true;
    $('podium').hidden = true;
    this.unsub.forEach(u => u());
    this.unsub = [];
    this.bubbles.clearAll();
  }

  said(from: string, text: string, emote: boolean): void {
    const c = this.critters.get(from);
    if (c) this.bubbles.show(from, c.critter.root, 2, text, emote);
  }

  private async showBonuses(m: BonusMsg): Promise<void> {
    const box = $('bonus');
    const s = this.state;
    if (!s) return;
    box.hidden = false;
    box.innerHTML = '<div class="card bonus-card"><h3>Prêmios surpresa!</h3><p class="hint">Cada prêmio vale uma coroa extra…</p></div>';
    sound.play('turn');
    await wait(1800);
    for (const b of m.bonuses) {
      const winners = b.pids.map(id => s.players.get(id)).filter(Boolean)
        .map(p => `<div class="order-slot">${avatar(p!.name, p!.character)}<b>${escapeHtml(p!.name)}</b><span>+1 👑</span></div>`).join('');
      box.innerHTML = `<div class="card bonus-card"><span class="eyebrow">Prêmio surpresa</span><h3>${b.title}</h3>
        <p class="hint">Para quem ${b.desc}</p><div class="winners">${winners}</div></div>`;
      sound.play('crown');
      await wait(3100);
    }
    box.hidden = true;
  }

  onState(s: NetState): void {
    this.state = s;
    if (s.phase !== 'podium') return;
    const players = playersBySeat(s);
    for (const p of players) {
      let c = this.critters.get(p.id);
      if (!c || c.place !== p.place) {
        if (c) this.scene.remove(c.critter.root);
        const critter = makeCritter(p.character);
        const spot = SPOTS[p.place];
        const others = players.filter(o => !SPOTS[o.place]).map(o => o.id);
        if (spot) critter.root.position.set(spot.x, spot.h, 0);
        else critter.root.position.set(-4.5 + others.indexOf(p.id) * 9, 0, 1.5);
        this.scene.add(critter.root);
        if (p.place === 1) {
          const crown = makeCrown();
          crown.position.y = 2.05;
          crown.scale.setScalar(0.9);
          critter.root.add(crown);
        }
        c = { critter, place: p.place };
        this.critters.set(p.id, c);
      }
    }
    if (!this.announced) {
      this.announced = true;
      sound.play('win');
      const champ = players.find(p => p.place === 1);
      if (champ) this.ctx.stage.banner(`${champ.name} venceu!`);
    }
    this.renderPanel(s);
  }

  private renderPanel(s: NetState): void {
    const panel = $('podium');
    panel.hidden = false;
    const me = this.ctx.net.me;
    const rows = playersBySeat(s).sort((a, b) => a.place - b.place).map(p => `
      <li class="${p.place === 1 ? 'first' : ''}"><span class="pos">${p.place}º</span>${avatar(p.name, p.character)}
      <span>${escapeHtml(p.name)}${p.id === me ? ' (você)' : ''}</span>
      <span class="gain num">👑${p.crowns} · <i class="coin-i"></i>${p.coins}</span></li>`).join('');
    const isHost = s.hostId === me;
    setHtml(panel, `<span class="eyebrow">Fim de jogo</span><h2>Classificação</h2>
      <ol class="res-list">${rows}</ol>
      ${isHost ? '<button type="button" class="btn big mint" data-act="again">Jogar de novo</button>' : `<p class="hint">Esperando ${escapeHtml(s.players.get(s.hostId)?.name ?? 'o anfitrião')} começar outra partida.</p>`}
      <button type="button" class="btn ghost" data-act="leave">Sair da sala</button>`);
  }

  update(dt: number, t: number): void {
    this.sea(dt, t);
    flicker(this.scene, t);
    for (const [, c] of this.critters) {
      animateCritter(c.critter, t, { speed: 0, punching: false, stunned: false, falling: false, celebrate: c.place === 1, sad: c.place >= 4, waving: c.place === 2 || c.place === 3 });
    }
    for (const c of this.confetti) {
      c.mesh.position.y -= c.vy * dt;
      c.mesh.rotation.x += c.spin * dt;
      c.mesh.rotation.y += c.spin * 0.7 * dt;
      if (c.mesh.position.y < -0.3) c.mesh.position.y = 9;
    }
    const cam = this.ctx.stage.camera;
    const portrait = this.ctx.stage.portrait;
    cam.position.set(Math.sin(t * 0.2) * 0.6, portrait ? 4 : 3.4, portrait ? 13 : 9.5);
    cam.lookAt(0, 1.6, 0);
  }

  viewOffset(w: number, h: number): { x: number; y: number } {
    return w >= 820 ? { x: w * 0.17, y: 0 } : { x: 0, y: h * 0.26 };
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
