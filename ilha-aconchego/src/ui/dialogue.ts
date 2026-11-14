import type { ItemStack } from '../core/types';
import { ITEMS } from '../data/items';
import { t } from '../i18n';
import { itemName } from './itemText';

/**
 * Cute babble instead of voices (docs/GAME_DESIGN.md, "Moradores"): short soft blips, pitched per
 * villager, made with the Web Audio API. Quiet by default; the sound options arrive in stage 8.
 */
class Babble {
  private ctx: AudioContext | null = null;

  blip(pitch: number): void {
    try {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 260 * pitch * (0.9 + Math.random() * 0.25);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // No audio (blocked or unsupported): stay silent.
    }
  }
}

export interface DialogueChoice {
  label: string;
  run(): void;
}

export interface Speaker {
  name: string;
  icon: string;
  pitch: number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * The dialogue box at the bottom of the screen: the speaker's name tag, the line being "typed"
 * with babble, then simple choices (buttons, or 1 to 4 on the keyboard). E / Ação / click goes on.
 */
export class DialogueBox {
  private readonly box: HTMLElement;
  private readonly name: HTMLElement;
  private readonly text: HTMLElement;
  private readonly choicesEl: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly babble = new Babble();
  private speaker: Speaker | null = null;
  private queue: string[] = [];
  private line = '';
  private shown = 0;
  private timer = 0;
  private choices: (() => DialogueChoice[] | null) | null = null;
  private onClose: (() => void) | null = null;
  private waitingChoice = false;

  constructor(root: HTMLElement) {
    this.box = el('div', 'dialogue');
    this.box.hidden = true;
    this.box.setAttribute('role', 'dialog');
    this.box.setAttribute('aria-live', 'polite');
    this.name = el('div', 'dialogue__name');
    this.text = el('p', 'dialogue__text');
    this.choicesEl = el('div', 'dialogue__choices');
    this.hint = el('div', 'dialogue__hint', '▼');
    this.box.append(this.name, this.text, this.choicesEl, this.hint);
    root.append(this.box);
    this.box.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('button')) return;
      this.advance();
    });
  }

  get isOpen(): boolean {
    return !this.box.hidden;
  }

  /** Says some lines; then shows the choices (if any) or closes. */
  say(speaker: Speaker, lines: readonly string[], choices: (() => DialogueChoice[] | null) | null = null, onClose: (() => void) | null = null): void {
    this.speaker = speaker;
    this.queue = [...lines];
    this.choices = choices;
    if (onClose) this.onClose = onClose;
    this.box.hidden = false;
    this.name.textContent = `${speaker.icon} ${speaker.name}`;
    this.next();
  }

  /** Replaces the choices with a list of items to pick (for gifts). */
  pickItem(prompt: string, stacks: readonly { stack: ItemStack; slot: number }[], onPick: (slot: number) => void, onBack: () => void): void {
    this.waitingChoice = true;
    this.text.textContent = prompt;
    this.choicesEl.replaceChildren();
    this.hint.hidden = true;
    const grid = el('div', 'dialogue__items');
    for (const { stack, slot } of stacks) {
      const b = el('button', 'slot');
      b.type = 'button';
      b.title = itemName(stack);
      b.setAttribute('aria-label', `${itemName(stack)} ×${stack.qty}`);
      b.append(el('span', 'slot__icon', ITEMS[stack.item].icon));
      if (stack.qty > 1) b.append(el('span', 'slot__qty', String(stack.qty)));
      b.addEventListener('click', () => onPick(slot));
      grid.append(b);
    }
    const back = el('button', 'ui-btn ui-btn--small', t('dialogue.back'));
    back.type = 'button';
    back.addEventListener('click', onBack);
    this.choicesEl.append(grid, back);
    (grid.querySelector('button') ?? back).focus({ preventScroll: true });
  }

  close(): void {
    if (this.box.hidden) return;
    this.box.hidden = true;
    this.choicesEl.replaceChildren();
    const done = this.onClose;
    this.onClose = null;
    this.waitingChoice = false;
    done?.();
  }

  private next(): void {
    this.choicesEl.replaceChildren();
    this.waitingChoice = false;
    const line = this.queue.shift();
    if (line === undefined) {
      const choices = this.choices?.() ?? null;
      this.choices = null;
      if (!choices?.length) return this.close();
      this.showChoices(choices);
      return;
    }
    this.line = line;
    this.shown = 0;
    this.timer = 0;
    this.text.textContent = '';
    this.hint.hidden = true;
  }

  private showChoices(choices: DialogueChoice[]): void {
    this.waitingChoice = true;
    this.hint.hidden = true;
    choices.forEach((c, i) => {
      const b = el('button', 'ui-btn ui-btn--small', `${i + 1}. ${c.label}`);
      b.type = 'button';
      b.addEventListener('click', () => c.run());
      this.choicesEl.append(b);
    });
    (this.choicesEl.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  /** E / Ação: finish typing the line, or go to the next one. */
  advance(): void {
    if (!this.isOpen || this.waitingChoice) return;
    if (this.shown < this.line.length) {
      this.shown = this.line.length;
      this.text.textContent = this.line;
      this.hint.hidden = false;
      return;
    }
    this.next();
  }

  /** Number keys pick a choice. */
  choose(index: number): void {
    const buttons = this.choicesEl.querySelectorAll<HTMLButtonElement>(':scope > button');
    buttons[index]?.click();
  }

  update(dt: number): void {
    if (!this.isOpen || this.shown >= this.line.length) return;
    this.timer += dt;
    const before = this.shown;
    this.shown = Math.min(this.line.length, Math.floor(this.timer * 45));
    if (this.shown !== before) {
      this.text.textContent = this.line.slice(0, this.shown);
      if (Math.floor(this.shown / 3) !== Math.floor(before / 3) && /\p{L}/u.test(this.line[this.shown - 1] ?? '')) this.babble.blip(this.speaker?.pitch ?? 1);
      if (this.shown >= this.line.length) this.hint.hidden = false;
    }
  }
}
