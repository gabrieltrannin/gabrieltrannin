import type { SeasonId } from '../data/calendar';
import { BEDS, HOUSE, LEVELS, PIER, PLAZA, TOUR_PLACES, type RoundedRect } from '../data/map';
import { SEASON_PALETTES } from '../data/seasonPalettes';
import type { Area } from '../data/areas';
import { BRIDGES, HOUSE_SIZE, HOUSE_SPOTS, ISLETS, MUSEUM, SEED_SHOP } from '../data/village';

export interface MinimapFrame {
  season: SeasonId;
  night: boolean;
  player: { x: number; z: number; facing: number };
  pet: { x: number; z: number };
  /** Tour places not visited yet (shown as stars). */
  pendingPlaces: readonly string[];
  /** The part of the world to show (main island, village or wood). */
  area: Area;
  /** Villagers outside, as little dots. */
  villagers: readonly { x: number; z: number }[];
}

/** Small round map in the corner, north up. Clicking it toggles the whole-island camera. */
export function createMinimap(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const size = canvas.width;
  let scale = 1, ox = 0, oz = 0;
  const px = (x: number) => ox + x * scale, pz = (z: number) => oz + z * scale;
  const frame = (a: Area) => {
    scale = size / (Math.max(a.width, a.depth) + 3);
    ox = size / 2 - a.x * scale;
    oz = size / 2 - a.z * scale;
  };
  const rect = (r: RoundedRect, fill: string) => {
    const radius = (typeof r.r === 'number' ? r.r : r.r[0]) * scale;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(px(r.x0), pz(r.z0), (r.x1 - r.x0) * scale, (r.z1 - r.z0) * scale, radius);
    ctx.fill();
  };

  return {
    draw(f: MinimapFrame): void {
      frame(f.area);
      ctx.fillStyle = f.night ? '#2E5480' : '#7CC8D2';
      ctx.fillRect(0, 0, size, size);
      for (const islet of ISLETS) {
        rect(islet.beach, '#EBD9A8');
        rect(islet.main, SEASON_PALETTES[f.season].map);
      }
      for (const b of BRIDGES) rect({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, r: 0.2 }, '#B8875A');
      for (const h of HOUSE_SPOTS) rect({ x0: h.x - HOUSE_SIZE.w / 2, z0: h.z - HOUSE_SIZE.d / 2, x1: h.x + HOUSE_SIZE.w / 2, z1: h.z + HOUSE_SIZE.d / 2, r: 0.3 }, '#C9955A');
      rect({ x0: MUSEUM.x - MUSEUM.w / 2, z0: MUSEUM.z - MUSEUM.d / 2, x1: MUSEUM.x + MUSEUM.w / 2, z1: MUSEUM.z + MUSEUM.d / 2, r: 0.3 }, '#E9E2D0');
      rect({ x0: SEED_SHOP.x - SEED_SHOP.w / 2, z0: SEED_SHOP.z - SEED_SHOP.d / 2, x1: SEED_SHOP.x + SEED_SHOP.w / 2, z1: SEED_SHOP.z + SEED_SHOP.d / 2, r: 0.3 }, '#7CC35A');
      rect(LEVELS.beach, '#EBD9A8');
      rect(LEVELS.main, SEASON_PALETTES[f.season].map);
      rect(LEVELS.upper, 'rgba(0,0,0,.12)');
      rect(PLAZA, '#B9B3A6');
      for (const b of BEDS) rect({ ...b, r: 0.3 }, '#7A5236');
      rect({ x0: PIER.x0, z0: PIER.z0, x1: PIER.x1, z1: PIER.z1, r: 0.2 }, '#B8875A');
      ctx.fillStyle = '#C9955A';
      ctx.beginPath();
      ctx.arc(px(HOUSE.x), pz(HOUSE.z), 2.4 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `${Math.round(size * 0.09)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#F2B33D';
      for (const place of TOUR_PLACES) if (f.pendingPlaces.includes(place.id)) ctx.fillText('★', px(place.at[0]), pz(place.at[1]));

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(px(f.pet.x), pz(f.pet.z), size * 0.022, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F2B33D';
      for (const v of f.villagers) {
        ctx.beginPath();
        ctx.arc(px(v.x), pz(v.z), size * 0.02, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player arrow, pointing where the character faces.
      const x = px(f.player.x), z = pz(f.player.z), a = f.player.facing, r = size * 0.05;
      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(-a);
      ctx.beginPath();
      ctx.moveTo(0, r * 1.2);
      ctx.lineTo(r * 0.8, -r * 0.7);
      ctx.lineTo(-r * 0.8, -r * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#D9537D';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = size * 0.012;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },
  };
}
