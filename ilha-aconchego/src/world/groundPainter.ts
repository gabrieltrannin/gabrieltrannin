import * as THREE from 'three';
import { BEDS, CLEARINGS, GROUND_AREA, PATHS, PLAZA, STEPPING_STONES, TALL_GRASS } from '../data/map';
import type { SeasonPalette } from '../data/seasonPalettes';
import { seededRandom } from '../render/textures';

/** Pixels per tile on the ground canvas. */
const PX = 2048 / (GROUND_AREA.x1 - GROUND_AREA.x0);
const W = Math.round((GROUND_AREA.x1 - GROUND_AREA.x0) * PX);
const H = Math.round((GROUND_AREA.z1 - GROUND_AREA.z0) * PX);

const gx = (x: number) => (x - GROUND_AREA.x0) * PX;
const gz = (z: number) => (z - GROUND_AREA.z0) * PX;

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Paints the top of the island on one big canvas: grass, dirt paths with soft dark edges,
 * tilled beds, the cobbled square and stepping stones. Repainted when the season changes.
 * The texture is mapped in world units (u = x, v = -z), which is how the extruded island caps are laid out.
 */
export class GroundPainter {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pathCtx: CanvasRenderingContext2D;
  private readonly pathCanvas: HTMLCanvasElement;

  constructor(maxAnisotropy = 8) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    this.pathCanvas = document.createElement('canvas');
    this.pathCanvas.width = W;
    this.pathCanvas.height = H;
    const ctx = canvas.getContext('2d');
    const pathCtx = this.pathCanvas.getContext('2d');
    if (!ctx || !pathCtx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.pathCtx = pathCtx;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = maxAnisotropy;
    const width = GROUND_AREA.x1 - GROUND_AREA.x0, depth = GROUND_AREA.z1 - GROUND_AREA.z0;
    this.texture.repeat.set(1 / width, 1 / depth);
    this.texture.offset.set(-GROUND_AREA.x0 / width, GROUND_AREA.z1 / depth);
  }

  paint(p: SeasonPalette): void {
    const ctx = this.ctx;
    const rnd = seededRandom(101);
    const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)] as T;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = p.grass;
    ctx.fillRect(0, 0, W, H);

    // Grass: thousands of tiny leaf triangles.
    for (let i = 0; i < 26000; i++) {
      ctx.fillStyle = pick(p.grassBlades);
      ctx.globalAlpha = 0.45 + rnd() * 0.45;
      const x = rnd() * W, y = rnd() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2.5, y - 6);
      ctx.lineTo(x + 5, y);
      ctx.fill();
    }
    if (p.grassSpecks) {
      for (let i = 0; i < 420; i++) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = pick(p.grassSpecks);
        const x = rnd() * W, y = rnd() * H;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(x + Math.cos(k * 2.1) * 3, y + Math.sin(k * 2.1) * 3, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;

    // Darker ground under the tall grass.
    ctx.fillStyle = 'rgba(30,60,20,.18)';
    ctx.beginPath();
    ctx.ellipse(gx((TALL_GRASS.x0 + TALL_GRASS.x1) / 2), gz((TALL_GRASS.z0 + TALL_GRASS.z1) / 2), 3.6 * PX, 2 * PX, 0, 0, Math.PI * 2);
    ctx.fill();

    this.paintPaths(p, pick, rnd);
    this.paintBeds(p);
    this.paintPlaza(p, pick);

    for (const [x, z] of STEPPING_STONES) {
      ctx.fillStyle = 'rgba(80,70,60,.35)';
      ctx.beginPath();
      ctx.ellipse(gx(x), gz(z) + 3, 0.36 * PX, 0.26 * PX, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.stone;
      ctx.beginPath();
      ctx.ellipse(gx(x), gz(z), 0.34 * PX, 0.24 * PX, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    this.texture.needsUpdate = true;
  }

  /** Paths go on their own layer first, get speckles, then are stamped with a soft dark shadow as the edge. */
  private paintPaths(p: SeasonPalette, pick: <T>(l: readonly T[]) => T, rnd: () => number): void {
    const c = this.pathCtx;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.clearRect(0, 0, W, H);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = '#000';
    c.fillStyle = '#000';
    for (const path of PATHS) {
      c.lineWidth = path.width * PX;
      c.beginPath();
      path.points.forEach(([x, z], i) => (i ? c.lineTo(gx(x), gz(z)) : c.moveTo(gx(x), gz(z))));
      c.stroke();
    }
    for (const [x, z, rx, rz] of CLEARINGS) {
      c.beginPath();
      c.ellipse(gx(x), gz(z), rx * PX, rz * PX, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = p.path;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 16000; i++) {
      c.fillStyle = pick(p.pathSpecks);
      c.globalAlpha = 0.7;
      c.beginPath();
      c.arc(rnd() * W, rnd() * H, 1 + rnd() * 2.6, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = p.pathEdge;
    ctx.shadowBlur = 7;
    ctx.drawImage(this.pathCanvas, 0, 0);
    ctx.restore();
  }

  private paintBeds(p: SeasonPalette): void {
    const ctx = this.ctx;
    for (const b of BEDS) {
      const x = gx(b.x0), z = gz(b.z0), w = (b.x1 - b.x0) * PX, h = (b.z1 - b.z0) * PX;
      ctx.fillStyle = p.soilEdge;
      roundRectPath(ctx, x - 7, z - 7, w + 14, h + 14, 16);
      ctx.fill();
      ctx.fillStyle = p.soil;
      roundRectPath(ctx, x, z, w, h, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.14)';
      ctx.lineWidth = 3;
      for (let zz = b.z0 + 0.27; zz < b.z1; zz += 0.53) {
        ctx.beginPath();
        ctx.moveTo(x + 8, gz(zz));
        ctx.lineTo(x + w - 8, gz(zz));
        ctx.stroke();
      }
    }
  }

  private paintPlaza(p: SeasonPalette, pick: <T>(l: readonly T[]) => T): void {
    const ctx = this.ctx;
    const x0 = gx(PLAZA.x0), z0 = gz(PLAZA.z0), w = (PLAZA.x1 - PLAZA.x0) * PX, h = (PLAZA.z1 - PLAZA.z0) * PX;
    const r = (typeof PLAZA.r === 'number' ? PLAZA.r : 0.8) * PX;
    ctx.save();
    roundRectPath(ctx, x0, z0, w, h, r);
    ctx.clip();
    ctx.fillStyle = p.mortar;
    ctx.fillRect(x0, z0, w, h);
    const rowH = 0.46 * PX;
    let row = 0;
    for (let y = z0; y < z0 + h; y += rowH, row++) {
      let x = x0 - (row % 2 ? 0.3 * PX : 0);
      while (x < x0 + w) {
        const sw = (0.5 + ((row * 7 + Math.floor(x)) % 7) * 0.05) * PX;
        ctx.fillStyle = pick(p.stones);
        roundRectPath(ctx, x + 2, y + 2, sw - 4, rowH - 4, 6);
        ctx.fill();
        x += sw;
      }
    }
    ctx.restore();
    ctx.strokeStyle = p.curb;
    ctx.lineWidth = 9;
    roundRectPath(ctx, x0, z0, w, h, r);
    ctx.stroke();
  }
}
