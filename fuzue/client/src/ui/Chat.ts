import { EMOTES, MSG, QUICK_CHAT } from '@fuzue/shared';
import { sound } from '../audio/sound';
import type { Net } from '../net/Net';
import { $ } from './dom';

/** Mensagens rápidas e emotes (aparecem em balão sobre o personagem). */
export class Chat {
  private root = $('chat');
  private panel = $('chatPanel');
  private net: Net | null = null;

  constructor() {
    this.panel.innerHTML = `
      <div class="chat-row emotes">${EMOTES.map((e, i) => `<button type="button" data-kind="emote" data-i="${i}" aria-label="Emote ${e}">${e}</button>`).join('')}</div>
      <div class="chat-row">${QUICK_CHAT.map((q, i) => `<button type="button" data-kind="quick" data-i="${i}">${q}</button>`).join('')}</div>`;
    $('chatToggle').addEventListener('click', () => {
      sound.play('click');
      this.panel.hidden = !this.panel.hidden;
    });
    this.panel.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-kind]');
      if (!b || !this.net) return;
      sound.play('pop');
      this.net.send(MSG.chat, { kind: b.dataset.kind, index: Number(b.dataset.i) });
      this.panel.hidden = true;
    });
  }

  attach(net: Net | null): void {
    this.net = net;
  }

  setVisible(on: boolean): void {
    this.root.hidden = !on;
    if (!on) this.panel.hidden = true;
  }
}
