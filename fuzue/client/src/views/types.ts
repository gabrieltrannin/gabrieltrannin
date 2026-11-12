import * as THREE from 'three';
import type { Input } from '../engine/Input';
import type { Stage, Tag, View } from '../engine/Stage';
import type { Net } from '../net/Net';
import type { NetState } from '../net/types';

export interface Ctx {
  stage: Stage;
  net: Net;
  input: Input;
}

/** Tela dentro de uma sala (lobby, tabuleiro, minijogo, final). */
export interface RoomView extends View {
  enter(): void;
  exit(): void;
  onState(s: NetState): void;
  /** Alguém mandou mensagem rápida ou emote. */
  said?(from: string, text: string, emote: boolean): void;
}

/** Balões de fala sobre os personagens. */
export class Bubbles {
  private active = new Map<string, { tag: Tag; timer: number }>();
  constructor(private stage: Stage) {}

  show(key: string, obj: THREE.Object3D, y: number, text: string, emote: boolean): void {
    this.clear(key);
    const tag = this.stage.addTag(obj, y, '', emote ? 'tag bubble emote' : 'tag bubble');
    tag.el.textContent = text;
    const timer = window.setTimeout(() => this.clear(key), 2600);
    this.active.set(key, { tag, timer });
  }

  clear(key: string): void {
    const a = this.active.get(key);
    if (!a) return;
    window.clearTimeout(a.timer);
    this.stage.removeTag(a.tag);
    this.active.delete(key);
  }

  clearAll(): void {
    for (const k of [...this.active.keys()]) this.clear(k);
  }
}
