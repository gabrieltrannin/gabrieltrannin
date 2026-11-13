import * as THREE from 'three';
import { nextRandom } from '../core/rng';

/**
 * Textures painted with code on a canvas. They stand in for hand-painted art until
 * real textures exist, and they use a seeded generator so they look the same every time.
 */

export type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) => void;

export interface CanvasTextureOptions {
  /** Tile the texture (RepeatWrapping). */
  repeat?: boolean;
  /** Color textures are sRGB; data textures (masks) are linear. Default true. */
  color?: boolean;
  seed?: number;
}

let maxAnisotropy = 4;
/** Called once by the renderer so textures stay sharp when the camera looks at the ground at an angle. */
export function setMaxAnisotropy(value: number): void {
  maxAnisotropy = Math.max(1, Math.min(8, value));
}

export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    const r = nextRandom(state);
    state = r.state;
    return r.value;
  };
}

export function canvasTexture(w: number, h: number, paint: Painter, opts: CanvasTextureOptions = {}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  paint(ctx, w, h, seededRandom(opts.seed ?? 1));
  const tex = new THREE.CanvasTexture(canvas);
  if (opts.color !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/** Draws a shape 9 times so it wraps across the tile edges (seamless tiling). */
function wrapped(w: number, h: number, draw: (dx: number, dy: number) => void): void {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) draw(dx, dy);
}

const pick = <T>(list: readonly T[], rnd: () => number): T => list[Math.floor(rnd() * list.length)] as T;

/** Grass tile with small triangular blades and a few clover dots. */
export function grassTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h, rnd) => {
    ctx.fillStyle = '#7DC35B';
    ctx.fillRect(0, 0, w, h);
    const greens = ['#6CB64C', '#8ED06A', '#5DA745', '#9DD979', '#74BD54'];
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * w, y = rnd() * h, c = pick(greens, rnd);
      ctx.globalAlpha = 0.45 + rnd() * 0.45;
      ctx.fillStyle = c;
      wrapped(w, h, (dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy);
        ctx.lineTo(x + dx + 2.5, y + dy - 6);
        ctx.lineTo(x + dx + 5, y + dy);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 18; i++) {
      const x = rnd() * w, y = rnd() * h;
      ctx.fillStyle = pick(['#FFFFFF', '#FFE680', '#F7B6C8'], rnd);
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(k * 2.1) * 3, y + Math.sin(k * 2.1) * 3, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }, { repeat: true, seed: 11 });
}

/** Greyish leaf clusters; the material color tints it per season. */
export function leafTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h, rnd) => {
    ctx.fillStyle = '#C4C4C4';
    ctx.fillRect(0, 0, w, h);
    const tones = ['#FFFFFF', '#EBEBEB', '#D9D9D9', '#A9A9A9', '#999999'];
    for (let i = 0; i < 700; i++) {
      const x = rnd() * w, y = rnd() * h, rx = 6 + rnd() * 8, ry = 3.5 + rnd() * 4, rot = rnd() * Math.PI;
      ctx.fillStyle = pick(tones, rnd);
      wrapped(w, h, (dx, dy) => {
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, { repeat: true, seed: 3 });
}

export function sandTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h, rnd) => {
    ctx.fillStyle = '#F2DFB0';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = pick(['#E6CF98', '#F9EECF', '#D9C08A', '#EFD9A2'], rnd);
      ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  }, { repeat: true, seed: 5 });
}

/** Orange and brown cliff bands; the top row of the canvas is the top of the cliff. */
export function cliffTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(256, 128, (ctx, w, h, rnd) => {
    const bands = ['#D69A63', '#C98754', '#BD7A4B', '#CC8B58', '#B06D42', '#C27E4F'];
    let y = 0, i = 0;
    while (y < h) {
      const bh = 16 + rnd() * 18;
      ctx.fillStyle = bands[i++ % bands.length] as string;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 2.5);
      ctx.lineTo(w, y + bh + 3);
      ctx.lineTo(0, y + bh + 3);
      ctx.fill();
      y += bh;
    }
    for (let k = 0; k < 500; k++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,235,200,.35)' : 'rgba(90,50,20,.25)';
      ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 1.5 + rnd() * 2);
    }
  }, { repeat: true, seed: 9 });
  tex.flipY = false;
  return tex;
}

/** Turquoise near the island, deep blue far away. Used once over the whole sea plane. */
export function seaGradientTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#8AE6DD');
    g.addColorStop(0.2, '#6FD6D6');
    g.addColorStop(0.3, '#45AFD2');
    g.addColorStop(0.55, '#2C88C0');
    g.addColorStop(1, '#22679C');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** White ripple arcs on a transparent tile, scrolled slowly over the sea. */
export function rippleTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h, rnd) => {
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = rnd() * h, r = 8 + rnd() * 16;
      ctx.lineWidth = 1.5 + rnd() * 1.5;
      wrapped(w, h, (dx, dy) => {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 1.2 * Math.PI, 1.8 * Math.PI);
        ctx.stroke();
      });
    }
  }, { repeat: true, seed: 13 });
}
