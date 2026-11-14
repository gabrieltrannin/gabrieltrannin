function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Stage 6: the loading screen when travelling by boat or going down the mine (docs: "Viagem pelo barco do
 * píer, com tela de carregamento"). A cream card with a little boat bobbing on waves (or a lantern for the
 * mine) and where you are going.
 */
export class LoadingScreen {
  private readonly screen: HTMLElement;
  private readonly text: HTMLElement;
  private readonly icon: HTMLElement;

  constructor(root: HTMLElement) {
    this.screen = el('div', 'loading');
    this.screen.hidden = true;
    this.screen.setAttribute('role', 'status');
    const card = el('div', 'loading__card');
    this.icon = el('div', 'loading__icon', '⛵');
    this.text = el('div', 'loading__text');
    const waves = el('div', 'loading__waves', '〰〰〰');
    card.append(this.icon, waves, this.text);
    this.screen.append(card);
    root.append(this.screen);
  }

  /**
   * Shows the screen, runs `work` while it is up (building the next scene), and keeps it a moment
   * so the trip feels like one.
   */
  async run(text: string, icon: string, work: () => void, minMs = 900): Promise<void> {
    this.text.textContent = text;
    this.icon.textContent = icon;
    this.screen.hidden = false;
    this.screen.classList.remove('loading--out');
    const started = performance.now();
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
    work();
    const left = minMs - (performance.now() - started);
    if (left > 0) await new Promise(r => setTimeout(r, left));
    this.screen.classList.add('loading--out');
    await new Promise(r => setTimeout(r, 260));
    this.screen.hidden = true;
  }

  get visible(): boolean {
    return !this.screen.hidden;
  }
}
