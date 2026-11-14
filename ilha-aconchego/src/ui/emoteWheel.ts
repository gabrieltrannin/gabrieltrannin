import { EMOTE_ICONS, EMOTES, type EmoteId } from '../data/emotes';
import { t } from '../i18n';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Stage 5: emotes on the F key (docs/GAME_DESIGN.md, "Emotes para reagir com moradores e amigos").
 * A small card with eight emotes: click one, or press 1 to 8 while it is open.
 */
export class EmoteWheel {
  private readonly card: HTMLElement;

  constructor(root: HTMLElement, private readonly onChoose: (emote: EmoteId) => void) {
    this.card = el('div', 'emote-wheel');
    this.card.hidden = true;
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-label', t('emote.title'));
    this.card.append(el('div', 'emote-wheel__title', t('emote.title')));
    const grid = el('div', 'emote-wheel__grid');
    EMOTES.forEach((id, i) => {
      const b = el('button', 'emote');
      b.type = 'button';
      b.append(el('span', 'emote__icon', EMOTE_ICONS[id]), el('span', 'emote__label', t(`emote.${id}`)), el('kbd', 'emote__key', String(i + 1)));
      b.addEventListener('click', () => this.choose(i));
      grid.append(b);
    });
    this.card.append(grid);
    root.append(this.card);
  }

  get isOpen(): boolean {
    return !this.card.hidden;
  }

  toggle(): void {
    this.card.hidden = !this.card.hidden;
    if (!this.card.hidden) (this.card.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  close(): void {
    this.card.hidden = true;
  }

  choose(index: number): void {
    const id = EMOTES[index];
    if (!id) return;
    this.close();
    this.onChoose(id);
  }
}
