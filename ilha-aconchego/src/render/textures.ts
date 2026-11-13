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

/**
 * Soft clumps of round leaves in greys (the material color tints them per season). Each leaf has a
 * faint shadow below and a light spot on top, so the crowns read as many small leaves without noise.
 */
export function leafTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h, rnd) => {
    ctx.fillStyle = '#C9C9C9';
    ctx.fillRect(0, 0, w, h);
    const circle = (x: number, y: number, rx: number, ry: number) => {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    for (let i = 0; i < 300; i++) {
      const x = rnd() * w, y = rnd() * h, r = 8 + rnd() * 7, tone = Math.round(196 + rnd() * 40);
      wrapped(w, h, (dx, dy) => {
        ctx.fillStyle = 'rgba(40,40,40,0.13)';
        circle(x + dx + 1.5, y + dy + 3, r, r * 0.85);
        ctx.fillStyle = `rgb(${tone},${tone},${tone})`;
        circle(x + dx, y + dy, r, r * 0.85);
        ctx.fillStyle = 'rgba(255,255,255,0.32)';
        circle(x + dx - r * 0.25, y + dy - r * 0.32, r * 0.5, r * 0.3);
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

/** Horizontal wooden planks (pier deck). */
export function woodPlankTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h, rnd) => {
    ctx.fillStyle = '#B98B5C';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      ctx.fillStyle = pick(['#B48556', '#C29464', '#AE8050'], rnd);
      ctx.fillRect(0, y + 2, w, 28);
      ctx.fillStyle = '#7E5A38';
      ctx.fillRect(0, y, w, 3);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = 'rgba(110,70,40,.25)';
        ctx.fillRect(rnd() * w, y + 6 + rnd() * 20, 30 + rnd() * 60, 1.5);
      }
    }
  }, { repeat: true, seed: 21 });
}

/** Straw bands for the thatched roof. */
export function thatchTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h, rnd) => {
    for (let y = 0; y < h; y += 16) {
      ctx.fillStyle = (y / 16) % 2 ? '#C69552' : '#B48345';
      ctx.fillRect(0, y, w, 16);
      for (let k = 0; k < 90; k++) {
        ctx.strokeStyle = rnd() < 0.5 ? 'rgba(240,200,120,.6)' : 'rgba(110,70,30,.45)';
        ctx.lineWidth = 1.5;
        const x = rnd() * w;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rnd() * 3 - 1.5, y + 14);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(90,55,25,.4)';
      ctx.fillRect(0, y + 14, w, 2);
    }
  }, { repeat: true, seed: 23 });
}

/** Ochre vertical boards for the round hut. */
export function hutWallTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#E4BA62';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 21) {
      ctx.fillStyle = '#A9793B';
      ctx.fillRect(x, 0, 3, h);
      ctx.fillStyle = 'rgba(255,240,200,.25)';
      ctx.fillRect(x + 4, 0, 3, h);
    }
  }, { repeat: true });
}

const AWNING_GREEN = '#5E8A4A';
const AWNING_CREAM = '#F4EED9';

/** Green and cream stripes for the market awnings. */
export function awningTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 64, (ctx, _w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? AWNING_CREAM : AWNING_GREEN;
      ctx.fillRect(i * 32, 0, 32, h);
    }
  });
}

/** The scalloped fringe that hangs from the awning (transparent between the scallops). */
export function valanceTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 64, ctx => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? AWNING_CREAM : AWNING_GREEN;
      ctx.fillRect(i * 32, 0, 32, 40);
      ctx.beginPath();
      ctx.arc(i * 32 + 16, 40, 16, 0, Math.PI);
      ctx.fill();
    }
  });
}

export function brickTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h, rnd) => {
    ctx.fillStyle = '#E2C9B0';
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < 16; r++) {
      for (let c = -1; c < 8; c++) {
        ctx.fillStyle = pick(['#B5654A', '#A95B42', '#C0705A', '#9F533C'], rnd);
        ctx.fillRect(c * 32 + (r % 2) * 16 + 2, r * 16 + 2, 28, 12);
      }
    }
  }, { repeat: true, seed: 29 });
}

/** Soft round dot for particles (rain drops, snow, petals, fireflies). */
export function dotTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, ctx => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** Rainbow bands across the width (used along the tube of a half torus). */
export function rainbowTexture(): THREE.CanvasTexture {
  return canvasTexture(8, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const colors = ['rgba(255,80,80,0)', '#FF5A5A', '#FFA347', '#FFE45C', '#7CDB6B', '#5BB8F2', '#8E7CF2', 'rgba(142,124,242,0)'];
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Paints a wooden sign: an icon on top and a label below (crop signs and stall signs). */
export function paintSign(canvas: HTMLCanvasElement, label: string, icon: string, style: 'crop' | 'stall'): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const round = (x: number, y: number, rw: number, rh: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, rw, rh, r);
    ctx.fill();
  };
  const emojiFont = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (style === 'crop') {
    round(0, 0, w, h, 16, '#4E3626');
    round(9, 9, w - 18, h - 18, 12, '#6E4E36');
    ctx.fillStyle = '#FFF4DE';
    ctx.font = `62px ${emojiFont}`;
    ctx.fillText(icon, w / 2, h * 0.4);
    ctx.font = '600 28px Fredoka, Nunito, sans-serif';
    ctx.fillText(label, w / 2, h * 0.8);
  } else {
    round(0, 0, w, h, 14, AWNING_CREAM);
    round(6, 6, w - 12, h - 12, 10, AWNING_GREEN);
    ctx.fillStyle = AWNING_CREAM;
    ctx.font = `44px ${emojiFont}`;
    ctx.fillText(icon, w * 0.2, h / 2 + 2);
    ctx.font = '600 34px Fredoka, Nunito, sans-serif';
    ctx.fillText(label, w * 0.59, h / 2 + 2);
  }
}
