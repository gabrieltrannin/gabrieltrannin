import * as THREE from 'three';
import type { Game } from '../core/game';
import { TensionGame, zoneSize } from '../core/fishingGame';
import { levelOf } from '../core/rules';
import type { Actor } from '../core/types';
import { FISH, type FishSpot } from '../data/fish';
import { CREEK, CREEK_BEACH, CREEK_WIDTH, LEVELS, PIER, POND, SEA_LEVEL } from '../data/map';
import { t } from '../i18n';
import type { InputFrame } from '../input/input';
import { groundHeight } from '../world/terrain';

/** Where a cast from (x, z) facing `facing` lands, and what kind of water it is. */
export function waterAhead(x: number, z: number, facing: number): { spot: FishSpot; point: THREE.Vector3 } | null {
  const fx = Math.sin(facing), fz = Math.cos(facing);
  const onPier = x > PIER.x0 - 0.3 && x < PIER.x1 + 0.3 && z > PIER.z0 - 0.3;
  for (let d = 1.2; d <= 3.4; d += 0.4) {
    const px = x + fx * d, pz = z + fz * d;
    const inPond = ((px - POND.x) / POND.rx) ** 2 + ((pz - POND.z) / POND.rz) ** 2 <= 0.85;
    const inCreek = CREEK.some(([cx, cz]) => Math.hypot(px - cx, pz - cz) <= CREEK_WIDTH * 0.6) || (Math.abs(px - CREEK_BEACH.x) < CREEK_WIDTH / 2 && pz > CREEK_BEACH.z0 && pz < CREEK_BEACH.z1);
    if (inPond || inCreek) return { spot: 'river', point: new THREE.Vector3(px, (inPond || pz < CREEK_BEACH.z0 ? LEVELS.main.top : LEVELS.beach.top) + 0.05, pz) };
    if (groundHeight(px, pz) === null) {
      const here = groundHeight(x, z);
      if (!onPier && (here === null || here > 0.5)) return null;
      return { spot: onPier ? 'pier' : 'beach', point: new THREE.Vector3(px, SEA_LEVEL + 0.05, pz) };
    }
  }
  return null;
}

type Phase = 'idle' | 'waiting' | 'bite' | 'reeling' | 'nothing';

/**
 * One fishing trip: cast (the command rolls the fish), wait for the bite, press to hook it, then the
 * tension minigame. The bobber and line are drawn in the scene; the meter is an overlay.
 */
export class FishingSession {
  phase: Phase = 'idle';
  private timer = 0;
  private game3: TensionGame | null = null;
  private readonly bobber: THREE.Mesh;
  private readonly line: THREE.Line;
  private readonly overlay: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly zone: HTMLElement;
  private readonly needle: HTMLElement;
  private readonly progress: HTMLElement;
  private point = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    root: HTMLElement,
    private readonly game: Game,
    private readonly actor: Actor,
    private readonly hand: () => THREE.Vector3,
    private readonly say: (text: string) => void,
    private readonly showBite: (on: boolean) => void,
  ) {
    this.bobber = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe5483b }));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.092, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.bobber.add(cap);
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf4f1ea }));
    this.bobber.visible = this.line.visible = false;
    scene.add(this.bobber, this.line);

    this.overlay = document.createElement('div');
    this.overlay.className = 'fishing';
    this.overlay.hidden = true;
    this.overlay.setAttribute('role', 'status');
    const title = document.createElement('div');
    title.className = 'fishing__title';
    title.textContent = t('fishing.title');
    const meter = document.createElement('div');
    meter.className = 'fishing__meter';
    meter.setAttribute('aria-label', t('fishing.tension'));
    this.zone = document.createElement('div');
    this.zone.className = 'fishing__zone';
    this.fill = document.createElement('div');
    this.fill.className = 'fishing__fill';
    this.needle = document.createElement('div');
    this.needle.className = 'fishing__needle';
    meter.append(this.zone, this.fill, this.needle);
    const bar = document.createElement('div');
    bar.className = 'meter fishing__progress';
    bar.setAttribute('aria-label', t('fishing.progress'));
    this.progress = document.createElement('i');
    bar.append(this.progress);
    const hint = document.createElement('p');
    hint.className = 'fishing__hint';
    hint.textContent = t('fishing.hint');
    this.overlay.append(title, meter, bar, hint);
    root.append(this.overlay);
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  /** Casts toward `point`. Returns false (and says why) if the cast was not allowed. */
  start(spot: FishSpot, point: THREE.Vector3, errorText: (e: string) => string): boolean {
    const r = this.game.dispatch({ type: 'fishing.cast', spot }, this.actor);
    if (!r.ok) {
      this.say(errorText(r.error));
      return false;
    }
    this.point.copy(point);
    this.bobber.position.copy(point);
    this.bobber.visible = this.line.visible = true;
    const fish = this.game.state.players[this.actor.id]!.fishing;
    this.phase = fish ? 'waiting' : 'nothing';
    this.timer = fish ? 1.2 + Math.random() * 2.5 : 2.2;
    return true;
  }

  private end(text: string | null): void {
    this.phase = 'idle';
    this.game3 = null;
    this.bobber.visible = this.line.visible = false;
    this.overlay.hidden = true;
    this.showBite(false);
    if (text) this.say(text);
  }

  /** Cancels a cast (for example when a window opens). */
  cancel(): void {
    if (this.phase === 'idle') return;
    if (this.game.state.players[this.actor.id]?.fishing) this.game.dispatch({ type: 'fishing.finish', caught: false }, this.actor);
    this.end(null);
  }

  /** Runs every frame while fishing; returns the prompt to show (or null). */
  update(dt: number, elapsed: number, frame: InputFrame | null): string | null {
    if (this.phase === 'idle') return null;
    const hand = this.hand();
    const pos = this.line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, hand.x, hand.y, hand.z);
    pos.setXYZ(1, this.bobber.position.x, this.bobber.position.y + 0.05, this.bobber.position.z);
    pos.needsUpdate = true;
    this.timer -= dt;
    const bob = this.phase === 'bite' ? Math.sin(elapsed * 30) * 0.06 - 0.06 : Math.sin(elapsed * 3) * 0.02;
    this.bobber.position.y = this.point.y + bob;

    if (this.phase === 'nothing') {
      if (this.timer <= 0) this.end(t('msg.noFish'));
      return null;
    }
    if (this.phase === 'waiting') {
      if (frame?.escape) {
        this.cancel();
        return null;
      }
      if (this.timer <= 0) {
        this.phase = 'bite';
        this.timer = 1.5;
        this.showBite(true);
      }
      return t('fishing.wait');
    }
    if (this.phase === 'bite') {
      if (frame?.action) {
        const player = this.game.state.players[this.actor.id]!;
        const fish = FISH.find(f => f.item === player.fishing?.item);
        const assisted = false;
        this.game3 = new TensionGame({ difficulty: fish?.difficulty ?? 2, zone: zoneSize(player.toolLevels.fishingRod, levelOf(player, 'fishing'), player.buff === 'fishing', assisted), seed: Math.floor(Math.random() * 1e9) });
        this.phase = 'reeling';
        this.showBite(false);
        this.overlay.hidden = false;
        return null;
      }
      if (this.timer <= 0) {
        this.game.dispatch({ type: 'fishing.finish', caught: false }, this.actor);
        this.end(t('msg.fishEscaped'));
        return null;
      }
      return t('act.reel');
    }
    // Reeling: the minigame runs in small steps for steady results at any frame rate.
    const g = this.game3!;
    let left = dt;
    while (left > 0 && g.result === 'playing') {
      const step = Math.min(0.05, left);
      g.step(step, !!frame?.actionHeld);
      left -= step;
    }
    this.zone.style.bottom = `${g.zoneLow * 100}%`;
    this.zone.style.height = `${(g.zoneHigh - g.zoneLow) * 100}%`;
    this.fill.style.height = `${Math.min(1, g.tension) * 100}%`;
    this.needle.style.bottom = `${Math.min(1, g.tension) * 100}%`;
    this.progress.style.width = `${Math.max(0, g.progress) * 100}%`;
    this.overlay.classList.toggle('fishing--danger', g.tension > g.zoneHigh + 0.1);
    if (g.result === 'playing') return null;
    const caught = g.result === 'caught';
    const item = this.game.state.players[this.actor.id]?.fishing?.item;
    const r = this.game.dispatch({ type: 'fishing.finish', caught }, this.actor);
    if (caught && r.ok && item) this.end(t('msg.fishCaught', { item: t(`item.${item}`) }));
    else if (caught && !r.ok) {
      this.game.dispatch({ type: 'fishing.finish', caught: false }, this.actor);
      this.end(t('msg.inventoryFull'));
    } else this.end(g.result === 'snapped' ? t('msg.lineSnapped') : t('msg.fishEscaped'));
    return null;
  }
}
