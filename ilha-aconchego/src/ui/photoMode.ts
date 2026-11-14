import { PHOTO_FILTERS, PHOTO_FRAMES, PHOTO_POSES, type PhotoFilter, type PhotoFrame } from '../data/emotes';
import { t, type MessageKey } from '../i18n';

export interface PhotoModeDeps {
  uiRoot: HTMLElement;
  /** The game's WebGL canvas. */
  canvas: HTMLCanvasElement;
  /** Follow distance of the camera (zoom). */
  getZoom(): number;
  setZoom(scale: number): void;
  /** Holds a pose (or none). */
  setPose(pose: string | null): void;
  /** Text written under a polaroid ("Ilha Aconchego · Primavera, dia 3"). */
  caption(): string;
  onShot(): void;
  onOpen(): void;
  onClose(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const FRAME_EMOJI: Partial<Record<PhotoFrame, string[]>> = {
  flowers: ['🌸', '🌼', '🌷', '🌿'],
  shells: ['🐚', '🐠', '⭐', '🌊'],
  stars: ['⭐', '✨', '🌟', '💫'],
  hearts: ['💗', '💕', '💖', '💞'],
};

/** Draws a frame over a picture of size w × h (the same drawing is the live preview and the saved photo). */
export function drawFrame(ctx: CanvasRenderingContext2D, frame: PhotoFrame, w: number, h: number, caption: string): void {
  const s = Math.min(w, h);
  if (frame === 'polaroid') {
    const side = s * 0.045, bottom = s * 0.16;
    ctx.fillStyle = '#FFFDF7';
    ctx.fillRect(0, 0, w, side);
    ctx.fillRect(0, 0, side, h);
    ctx.fillRect(w - side, 0, side, h);
    ctx.fillRect(0, h - bottom, w, bottom);
    ctx.fillStyle = '#5b4636';
    ctx.font = `600 ${Math.round(bottom * 0.3)}px Fredoka, Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(caption, w / 2, h - bottom / 2);
    return;
  }
  const emoji = FRAME_EMOJI[frame];
  if (!emoji) return;
  const size = Math.round(s * 0.065);
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const stepX = Math.max(size * 1.4, w / Math.max(6, Math.round(w / (size * 1.6))));
  const stepY = Math.max(size * 1.4, h / Math.max(4, Math.round(h / (size * 1.6))));
  let i = 0;
  for (let x = size * 0.7; x < w; x += stepX) {
    ctx.fillText(emoji[i++ % emoji.length]!, x, size * 0.7);
    ctx.fillText(emoji[i++ % emoji.length]!, x, h - size * 0.7);
  }
  for (let y = size * 0.7 + stepY; y < h - stepY / 2; y += stepY) {
    ctx.fillText(emoji[i++ % emoji.length]!, size * 0.7, y);
    ctx.fillText(emoji[i++ % emoji.length]!, w - size * 0.7, y);
  }
}

/**
 * Stage 5: the photo mode (docs/GAME_DESIGN.md, "Modo foto com filtros, poses e molduras"). The interface
 * hides, the camera can be dragged and zoomed, and the picture is saved with its filter and frame.
 */
export class PhotoMode {
  active = false;
  private filter: PhotoFilter = 'natural';
  private frame: PhotoFrame = 'none';
  private pose = 'none';
  private pending = false;
  private zoomBefore = 1;
  private readonly ui: HTMLElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly controls: HTMLElement;
  private readonly preview: HTMLElement;

  constructor(private readonly deps: PhotoModeDeps) {
    this.overlay = el('canvas', 'photo-overlay');
    this.ui = el('div', 'photo-ui');
    this.ui.hidden = true;
    this.overlay.hidden = true;
    this.controls = el('div', 'photo-ui__card');
    this.preview = el('div', 'photo-preview');
    this.preview.hidden = true;
    this.ui.append(this.controls);
    deps.uiRoot.append(this.overlay, this.ui, this.preview);
    window.addEventListener('resize', () => this.drawOverlay());
  }

  open(): void {
    if (this.active) return;
    this.active = true;
    this.zoomBefore = this.deps.getZoom();
    this.ui.hidden = false;
    this.overlay.hidden = false;
    this.deps.onOpen();
    this.render();
    this.drawOverlay();
  }

  close(): void {
    if (!this.active) return;
    this.active = false;
    this.ui.hidden = true;
    this.overlay.hidden = true;
    this.preview.hidden = true;
    this.deps.canvas.style.filter = '';
    this.deps.setZoom(this.zoomBefore);
    this.deps.setPose(null);
    this.pose = 'none';
    this.deps.onClose();
  }

  /** Esc leaves; the photo itself is taken after the next frame is drawn. */
  update(frame: { escape: boolean; photo: boolean }): void {
    if (!this.active) return;
    if (frame.escape) {
      if (!this.preview.hidden) this.preview.hidden = true;
      else this.close();
    }
  }

  /** Call right after the scene was drawn: grabs the picture if one was asked for. */
  afterRender(): void {
    if (!this.pending) return;
    this.pending = false;
    const src = this.deps.canvas;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.filter = PHOTO_FILTERS[this.filter];
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';
    drawFrame(ctx, this.frame, out.width, out.height, this.deps.caption());
    const url = out.toDataURL('image/png');
    this.preview.replaceChildren();
    const card = el('div', 'photo-preview__card');
    const img = el('img', 'photo-preview__img');
    img.src = url;
    img.alt = t('photo.alt');
    const save = el('a', 'ui-btn ui-btn--primary', t('photo.download'));
    save.href = url;
    save.download = `ilha-aconchego-${Date.now()}.png`;
    const back = el('button', 'ui-btn', t('photo.again'));
    back.type = 'button';
    back.addEventListener('click', () => (this.preview.hidden = true));
    const actions = el('div', 'photo-preview__actions');
    actions.append(back, save);
    card.append(el('h2', 'bag__title', t('photo.saved')), img, actions);
    this.preview.append(card);
    this.preview.hidden = false;
    this.deps.onShot();
  }

  private drawOverlay(): void {
    if (!this.active) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.overlay.width = w;
    this.overlay.height = h;
    const ctx = this.overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    drawFrame(ctx, this.frame, w, h, this.deps.caption());
  }

  private render(): void {
    const c = this.controls;
    c.replaceChildren();
    const group = (label: string, items: readonly string[], current: string, name: (v: string) => string, pick: (v: string) => void) => {
      const wrap = el('div', 'photo-ui__group');
      wrap.append(el('span', 'photo-ui__label', label));
      const row = el('div', 'chips');
      for (const v of items) {
        const b = el('button', 'chip', name(v));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(v === current));
        b.addEventListener('click', () => {
          pick(v);
          this.render();
          this.drawOverlay();
        });
        row.append(b);
      }
      wrap.append(row);
      return wrap;
    };
    c.append(el('div', 'photo-ui__title', `📷 ${t('photo.title')}`));
    c.append(group(t('photo.filters'), Object.keys(PHOTO_FILTERS), this.filter, v => t(`photo.filter.${v}` as MessageKey), v => {
      this.filter = v as PhotoFilter;
      this.deps.canvas.style.filter = PHOTO_FILTERS[this.filter] === 'none' ? '' : PHOTO_FILTERS[this.filter];
    }));
    c.append(group(t('photo.frames'), PHOTO_FRAMES, this.frame, v => t(`photo.frame.${v}` as MessageKey), v => (this.frame = v as PhotoFrame)));
    c.append(group(t('photo.poses'), PHOTO_POSES, this.pose, v => (v === 'none' ? t('pose.none') : t(`emote.${v}` as MessageKey)), v => {
      this.pose = v;
      this.deps.setPose(v === 'none' ? null : v);
    }));
    const zoom = el('label', 'photo-ui__zoom');
    const range = el('input');
    range.type = 'range';
    range.min = '0.35';
    range.max = '1.6';
    range.step = '0.05';
    range.value = String(this.deps.getZoom());
    range.addEventListener('input', () => this.deps.setZoom(Number(range.value)));
    zoom.append(el('span', 'photo-ui__label', t('photo.zoom')), range);
    c.append(zoom, el('p', 'photo-ui__hint', t('photo.hint')));
    const actions = el('div', 'photo-ui__actions');
    const shoot = el('button', 'ui-btn ui-btn--primary', t('photo.shoot'));
    shoot.type = 'button';
    shoot.addEventListener('click', () => (this.pending = true));
    const exit = el('button', 'ui-btn', t('photo.exit'));
    exit.type = 'button';
    exit.addEventListener('click', () => this.close());
    actions.append(exit, shoot);
    c.append(actions);
  }
}
