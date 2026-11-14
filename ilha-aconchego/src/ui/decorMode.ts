import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { decorCenter, decorList, DECOR_REACH, placementError, spaceOf, tilesOf, type DecorSpace } from '../core/decor';
import type { Game } from '../core/game';
import type { Actor, PlacedDecor, PlayerState } from '../core/types';
import { decorAsset, footprintSize, isDecorItem, type DecorItem } from '../data/decor';
import { ITEMS } from '../data/items';
import type { InputFrame } from '../input/input';
import { t } from '../i18n';
import { decorRotation } from '../world/decorLayer';

export interface DecorModeDeps {
  game: Game;
  actor: Actor;
  assets: AssetRegistry;
  uiRoot: HTMLElement;
  canvas: HTMLCanvasElement;
  camera(): THREE.Camera;
  /** The scene of the space the player is in (island or house). */
  parent(): THREE.Object3D;
  /** Ground height in that space. */
  height(x: number, z: number): number;
  player(): { x: number; z: number; facing: number };
  toast(text: string): void;
  errorText(error: string): string;
  setPrompt(text: string | null): void;
  /** Writes the walked position into the game state first (reach is checked there). */
  commitMove(): void;
  onClose(): void;
}

type Selection = { kind: 'new'; item: DecorItem } | { kind: 'move'; id: number; item: DecorItem } | null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Stage 5: decoration mode (docs/GAME_DESIGN.md, "Colocar móveis e enfeites em qualquer lugar, dentro e fora
 * de casa"). A see-through copy of the piece follows the mouse (or stands in front of the player) on the grid,
 * green where it fits and red where it does not. E places or picks up, G turns, X puts away, Esc leaves.
 */
export class DecorMode {
  active = false;
  private selection: Selection = null;
  private rot = 0;
  private ghost: THREE.Object3D | null = null;
  private ghostItem: DecorItem | null = null;
  private readonly tiles = new THREE.Group();
  private readonly okMat = new THREE.MeshBasicMaterial({ color: 0x7fe08a, transparent: true, opacity: 0.5, depthWrite: false });
  private readonly badMat = new THREE.MeshBasicMaterial({ color: 0xf06b6b, transparent: true, opacity: 0.5, depthWrite: false });
  private readonly pickMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.55, depthWrite: false });
  private readonly tileGeo = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
  private pointer: { x: number; z: number; time: number } | null = null;
  private target = { x: 0, z: 0 };
  private hovered: PlacedDecor | null = null;
  private readonly bar: HTMLElement;
  private readonly label: HTMLElement;
  private readonly picker: HTMLElement;
  private readonly raycaster = new THREE.Raycaster();

  constructor(private readonly deps: DecorModeDeps) {
    this.tiles.name = 'decor-tiles';
    this.bar = el('div', 'decor-bar');
    this.bar.hidden = true;
    this.bar.setAttribute('role', 'toolbar');
    this.bar.setAttribute('aria-label', t('decor.title'));
    this.label = el('div', 'decor-bar__label');
    this.picker = el('div', 'decor-bar__picker');
    const buttons = el('div', 'decor-bar__buttons');
    const add = (text: string, run: () => void, primary = false) => {
      const b = el('button', `ui-btn ui-btn--small${primary ? ' ui-btn--primary' : ''}`, text);
      b.type = 'button';
      b.addEventListener('click', run);
      buttons.append(b);
    };
    add(t('decor.rotate'), () => this.rotate());
    add(t('decor.act'), () => this.act(), true);
    add(t('decor.store'), () => this.store());
    add(t('decor.exit'), () => this.close());
    this.bar.append(el('div', 'decor-bar__title', `🛋️ ${t('decor.title')}`), this.label, this.picker, buttons);
    deps.uiRoot.append(this.bar);

    const toTile = (e: PointerEvent) => {
      if (!this.active) return;
      const rect = deps.canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, deps.camera());
      const p = deps.player();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -deps.height(p.x, p.z));
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, hit)) this.pointer = { x: hit.x, z: hit.z, time: performance.now() };
    };
    deps.canvas.addEventListener('pointermove', toTile);
    deps.canvas.addEventListener('pointerdown', toTile);
  }

  private me(): PlayerState {
    return this.deps.game.state.players[this.deps.actor.id]!;
  }

  private space(): DecorSpace {
    return spaceOf(this.me());
  }

  /** Enters decoration mode, optionally holding the decoration in a backpack slot. */
  open(slot?: number): void {
    this.active = true;
    this.bar.hidden = false;
    this.pointer = null;
    const item = slot !== undefined ? this.me().inventory[slot]?.item : undefined;
    this.selection = item && isDecorItem(item) ? { kind: 'new', item } : null;
    this.rot = 0;
    this.deps.parent().add(this.tiles);
    this.refreshPicker();
  }

  close(): void {
    if (!this.active) return;
    this.active = false;
    this.bar.hidden = true;
    this.selection = null;
    this.setGhost(null);
    this.tiles.parent?.remove(this.tiles);
    this.deps.setPrompt(null);
    this.deps.onClose();
  }

  /** The decoration items in the backpack, as buttons to pick from. */
  refreshPicker(): void {
    if (!this.active) return;
    this.picker.replaceChildren();
    const seen = new Map<DecorItem, number>();
    for (const stack of this.me().inventory) if (stack && isDecorItem(stack.item)) seen.set(stack.item, (seen.get(stack.item) ?? 0) + stack.qty);
    if (!seen.size) this.picker.append(el('span', 'decor-bar__empty', t('decor.noItems')));
    for (const [item, qty] of seen) {
      const b = el('button', 'chip', `${ITEMS[item].icon} ${t(`item.${item}`)} ×${qty}`);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(this.selection?.kind === 'new' && this.selection.item === item));
      b.addEventListener('click', () => {
        this.selection = this.selection?.kind === 'new' && this.selection.item === item ? null : { kind: 'new', item };
        this.refreshPicker();
      });
      this.picker.append(b);
    }
  }

  private setGhost(item: DecorItem | null): void {
    if (item === this.ghostItem) return;
    if (this.ghost) this.ghost.parent?.remove(this.ghost);
    this.ghost = null;
    this.ghostItem = item;
    if (!item) return;
    const g = this.deps.assets.create(decorAsset(item));
    g.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.material = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: !!o.geometry.attributes.color, transparent: true, opacity: 0.6, depthWrite: false });
        o.castShadow = false;
      }
    });
    this.ghost = g;
    this.deps.parent().add(g);
  }

  rotate(): void {
    if (this.selection) this.rot = (this.rot + 1) % 4;
    else if (this.hovered) this.send({ type: 'decor.move', id: this.hovered.id, x: this.hovered.x, z: this.hovered.z, rot: (this.hovered.rot + 1) % 4 });
  }

  store(): void {
    const id = this.selection?.kind === 'move' ? this.selection.id : this.hovered?.id;
    if (id === undefined) return;
    if (this.send({ type: 'decor.store', id })) {
      this.selection = null;
      this.deps.toast(t('decor.stored'));
    }
  }

  act(): void {
    const sel = this.selection;
    const { x, z } = this.target;
    if (sel?.kind === 'new') {
      const slot = this.me().inventory.findIndex(s => s?.item === sel.item);
      if (slot >= 0 && this.send({ type: 'decor.place', slot, x, z, rot: this.rot })) {
        // Keep holding the same piece while there are more of it.
        if (!this.me().inventory.some(s => s?.item === sel.item)) this.selection = null;
      }
    } else if (sel?.kind === 'move') {
      if (this.send({ type: 'decor.move', id: sel.id, x, z, rot: this.rot })) this.selection = null;
    } else if (this.hovered && isDecorItem(this.hovered.item)) {
      this.selection = { kind: 'move', id: this.hovered.id, item: this.hovered.item };
      this.rot = this.hovered.rot;
    }
    this.refreshPicker();
  }

  private send(cmd: Parameters<Game['dispatch']>[0]): boolean {
    this.deps.commitMove();
    const r = this.deps.game.dispatch(cmd, this.deps.actor);
    if (!r.ok) this.deps.toast(this.deps.errorText(r.error));
    return r.ok;
  }

  /** Reads the keys while decorating and moves the ghost. Returns true if it used the frame's keys. */
  update(frame: InputFrame): void {
    if (!this.active) return;
    if (frame.escape) return this.close();
    if (frame.rotate) this.rotate();
    if (frame.store) this.store();
    if (frame.action) this.act();
    if (frame.slot !== null) {
      const stack = this.me().inventory[frame.slot];
      if (stack && isDecorItem(stack.item)) {
        this.selection = { kind: 'new', item: stack.item };
        this.refreshPicker();
      }
    }
    const state = this.deps.game.state;
    const space = this.space();
    const item = this.selection?.item ?? null;
    const p = this.deps.player();
    // Where: under the mouse (if it moved lately), else in front of the player.
    const usePointer = this.pointer && performance.now() - this.pointer.time < 4000;
    const cx = usePointer ? this.pointer!.x : p.x + Math.sin(p.facing) * 1.6;
    const cz = usePointer ? this.pointer!.z : p.z + Math.cos(p.facing) * 1.6;
    const size = item ? footprintSize(item, this.rot) : { w: 1, d: 1 };
    this.target = { x: Math.round(cx - size.w / 2), z: Math.round(cz - size.d / 2) };
    const { x, z } = this.target;

    // Hovering a placed piece (when not holding one).
    this.hovered = null;
    if (!item || this.selection?.kind !== 'new') {
      const list = decorList(state, space);
      this.hovered = list.find(d => isDecorItem(d.item) && tilesOf(d.item, d.x, d.z, d.rot).some(([tx, tz]) => tx === Math.floor(cx) && tz === Math.floor(cz))) ?? null;
      if (this.selection?.kind === 'move') this.hovered = null;
    }

    // Ghost and tiles.
    this.tiles.clear();
    const parent = this.deps.parent();
    if (this.tiles.parent !== parent) parent.add(this.tiles);
    if (item) {
      this.setGhost(item);
      const ignore = this.selection?.kind === 'move' ? this.selection.id : -1;
      const center = decorCenter({ item, x, z, rot: this.rot });
      const far = !this.me().inside && Math.hypot(center[0] - p.x, center[1] - p.z) > DECOR_REACH;
      const ok = !far && placementError(state, space, item, x, z, this.rot, ignore) === null;
      for (const [tx, tz] of tilesOf(item, x, z, this.rot)) {
        const m = new THREE.Mesh(this.tileGeo, ok ? this.okMat : this.badMat);
        m.position.set(tx + 0.5, this.deps.height(tx + 0.5, tz + 0.5) + 0.03, tz + 0.5);
        this.tiles.add(m);
      }
      if (this.ghost) {
        if (this.ghost.parent !== parent) parent.add(this.ghost);
        this.ghost.position.set(center[0], this.deps.height(center[0], center[1]) + 0.02, center[1]);
        this.ghost.rotation.y = decorRotation(this.rot);
      }
      const name = t(`item.${item}`);
      this.label.textContent = this.selection?.kind === 'move' ? t('decor.moving', { item: name }) : t('decor.holding', { item: name });
      this.deps.setPrompt(this.selection?.kind === 'move' ? t('decor.promptMove', { item: name }) : t('decor.promptPlace', { item: name }));
    } else {
      this.setGhost(null);
      if (this.hovered && isDecorItem(this.hovered.item)) {
        for (const [tx, tz] of tilesOf(this.hovered.item, this.hovered.x, this.hovered.z, this.hovered.rot)) {
          const m = new THREE.Mesh(this.tileGeo, this.pickMat);
          m.position.set(tx + 0.5, this.deps.height(tx + 0.5, tz + 0.5) + 0.03, tz + 0.5);
          this.tiles.add(m);
        }
        const name = t(`item.${this.hovered.item}`);
        this.label.textContent = t('decor.pointing', { item: name });
        this.deps.setPrompt(t('decor.promptPick', { item: name }));
      } else {
        this.label.textContent = t('decor.hint');
        this.deps.setPrompt(null);
      }
    }
  }
}
