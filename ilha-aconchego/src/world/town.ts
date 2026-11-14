import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import type { GameState } from '../core/types';
import type { SeasonPalette } from '../data/seasonPalettes';
import {
  BRIDGE_SIGN, BRIDGES, HOUSE_SPOTS, ISLETS, MUSEUM, NOTICE_BOARD, SEED_SHOP, VILLAGE_LAMPS, VILLAGE_PATHS, VILLAGE_PLAZA, VILLAGE_TREES, WELL,
  WOOD_PATHS, WOOD_TREES, type Islet,
} from '../data/village';
import { materials } from '../render/materials';
import { instantiate } from '../render/instancing';
import { seededRandom, sandTexture } from '../render/textures';
import { cliffMaterial, lip, roundedRectShape, slab } from './island';
import { heightAt } from './terrain';

const PX = 48;

/** Paints an islet's top: grass, soft dirt paths and the cobbled village square. */
function paintIslet(canvas: HTMLCanvasElement, islet: Islet, p: SeasonPalette): void {
  const ctx = canvas.getContext('2d')!;
  const { x0, z0 } = islet.ground;
  const gx = (x: number) => (x - x0) * PX, gz = (z: number) => (z - z0) * PX;
  const rnd = seededRandom(islet.id === 'village' ? 401 : 402);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)] as T;
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.grass;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = pick(p.grassBlades);
    ctx.globalAlpha = 0.45 + rnd() * 0.45;
    const x = rnd() * canvas.width, y = rnd() * canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2.5, y - 6);
    ctx.lineTo(x + 5, y);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const paths = islet.id === 'village' ? VILLAGE_PATHS : WOOD_PATHS;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [color, extra] of [['rgba(90,60,35,.35)', 0.25], [p.path, 0]] as const) {
    ctx.strokeStyle = color;
    for (const path of paths) {
      ctx.lineWidth = (path.width + extra) * PX;
      ctx.beginPath();
      path.points.forEach(([x, z], i) => (i ? ctx.lineTo(gx(x), gz(z)) : ctx.moveTo(gx(x), gz(z))));
      ctx.stroke();
    }
  }
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = 'rgba(120,85,50,.35)';
    const path = pick(paths), a = path.points[Math.floor(rnd() * (path.points.length - 1))]!, b = path.points[path.points.indexOf(a) + 1] ?? a, f = rnd();
    ctx.beginPath();
    ctx.arc(gx(a[0] + (b[0] - a[0]) * f) + (rnd() - 0.5) * path.width * PX * 0.7, gz(a[1] + (b[1] - a[1]) * f) + (rnd() - 0.5) * path.width * PX * 0.7, 1.5 + rnd() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (islet.id === 'village') {
    const r = VILLAGE_PLAZA;
    ctx.fillStyle = p.stone;
    ctx.beginPath();
    ctx.roundRect(gx(r.x0), gz(r.z0), (r.x1 - r.x0) * PX, (r.z1 - r.z0) * PX, 0.8 * PX);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.12)';
    ctx.lineWidth = 2;
    for (let x = r.x0 + 0.4; x < r.x1; x += 0.55) {
      for (let z = r.z0 + 0.3; z < r.z1; z += 0.42) {
        ctx.beginPath();
        ctx.roundRect(gx(x + ((Math.round(z * 3) % 2) * 0.25)) - 11, gz(z) - 8, 22, 16, 5);
        ctx.stroke();
      }
    }
  }
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = pick(['#FFFFFF', '#FFE680', '#F7B6C8', '#B892FF']);
    ctx.beginPath();
    ctx.arc(rnd() * canvas.width, rnd() * canvas.height, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface Town {
  root: THREE.Group;
  setSeason(palette: SeasonPalette): void;
  /** Bridge planks, museum doors (from the community projects). */
  sync(state: Readonly<GameState>): void;
}

/** The village islet and the wood: their land, bridges, houses, museum, shop, board, well, lamps and trees. */
export function buildTown(assets: AssetRegistry): Town {
  const root = new THREE.Group();
  root.name = 'town';
  const m = materials();
  const sand = sandTexture();
  sand.repeat.set(0.22, 0.22);
  const painters: { islet: Islet; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture }[] = [];

  for (const islet of ISLETS) {
    const g = islet.ground;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((g.x1 - g.x0) * PX);
    canvas.height = Math.round((g.z1 - g.z0) * PX);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const width = g.x1 - g.x0, depth = g.z1 - g.z0;
    texture.repeat.set(1 / width, 1 / depth);
    texture.offset.set(-g.x0 / width, g.z1 / depth);
    painters.push({ islet, canvas, texture });
    const mainShape = roundedRectShape(islet.main);
    const b = islet.beach;
    root.add(
      slab(roundedRectShape(b), b.bottom, b.top - b.bottom, new THREE.MeshLambertMaterial({ map: sand }), new THREE.MeshLambertMaterial({ color: 0xd9c08a })),
      slab(mainShape, b.top, islet.main.top - b.top, new THREE.MeshLambertMaterial({ map: texture }), cliffMaterial(islet.main.top - b.top)),
      lip(mainShape, islet.main.top, m.lip),
    );
  }

  // Bridges.
  const newBridge = BRIDGES.find(b => b.id === 'new')!, oldBridge = BRIDGES.find(b => b.id === 'old')!;
  const bridgeA = assets.create('bridge.new');
  bridgeA.position.set(newBridge.x0, newBridge.deck, (newBridge.z0 + newBridge.z1) / 2);
  const bridgeB = assets.create('bridge.old');
  bridgeB.position.set((oldBridge.x0 + oldBridge.x1) / 2, oldBridge.deck, oldBridge.z1);
  bridgeB.rotation.y = Math.PI / 2;
  root.add(bridgeA, bridgeB);

  // Buildings.
  const place = (name: string, x: number, z: number, ry = 0) => {
    const o = assets.create(name);
    o.position.set(x, heightAt(x, z), z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };
  for (const h of HOUSE_SPOTS) place(`house.${h.npc}`, h.x, h.z);
  const museum = place('museum', MUSEUM.x, MUSEUM.z);
  place('shop.seeds', SEED_SHOP.x, SEED_SHOP.z);
  place('board.notices', NOTICE_BOARD[0], NOTICE_BOARD[1]);
  place('well', WELL[0], WELL[1]);
  const sign = place('bridge.sign', BRIDGE_SIGN[0], BRIDGE_SIGN[1]);
  root.add(instantiate(assets.create('lamp.globe'), VILLAGE_LAMPS.map(([x, z]) => ({ x, y: heightAt(x, z), z }))));
  const rnd = seededRandom(77);
  const byAsset = new Map<string, { x: number; y: number; z: number; s: number; ry: number }[]>();
  for (const [x, z, s, asset] of [...VILLAGE_TREES, ...WOOD_TREES]) {
    const list = byAsset.get(asset) ?? [];
    list.push({ x, y: heightAt(x, z), z, s, ry: rnd() * 6 });
    byAsset.set(asset, list);
  }
  for (const [asset, list] of byAsset) root.add(instantiate(assets.create(asset), list));
  const bushes = [[27.6, 4.6], [43.2, -6.4], [31.0, -11.6], [37.6, 13.0], [40.4, -20.2], [29.6, -21.6]].map(([x, z]) => ({ x: x!, y: heightAt(x!, z!), z: z!, ry: rnd() * 6 }));
  root.add(instantiate(assets.create('bush.flower'), bushes));

  return {
    root,
    setSeason(palette) {
      for (const p of painters) {
        paintIslet(p.canvas, p.islet, palette);
        p.texture.needsUpdate = true;
      }
    },
    sync(state) {
      const fixed = state.projects.bridge.done;
      bridgeB.traverse(o => {
        if (o.name === 'only:fixed') o.visible = fixed;
      });
      sign.visible = !fixed;
      const open = state.projects.museum.done;
      museum.traverse(o => {
        if (o.name === 'only:closed') o.visible = !open;
        if (o.name === 'only:open') o.visible = open;
      });
    },
  };
}
