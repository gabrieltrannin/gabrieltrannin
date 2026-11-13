import * as THREE from 'three';
import { paint } from '../../engine/materials';
import { bannerPole, stoneFloor, torch } from '../../engine/scenery';

/** Peças de cenário usadas por várias arenas de minijogo. */

export const GROUT = '#4e4840';
export const WOOD = '#7a5333';

/** Pátio redondo de pedra com ameias, estandartes e tochas. Topo em y = 0. */
export function roundYard(scene: THREE.Scene, radius: number, sideColor: string, seed = 9): void {
  const side = paint(sideColor, { facet: 0.16 });
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.3, radius + 0.6, 3, 24), [side, paint(GROUT), side]);
  yard.position.y = -1.5;
  yard.userData.noCast = true;
  scene.add(yard);
  scene.add(stoneFloor({ radius: radius + 0.2 }, { seed }));
  const merlon = paint('#9a9286', { facet: 0.14 });
  const n = Math.round(radius * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55 + (i % 3) * 0.06, 0.45), merlon);
    m.position.set(Math.cos(a) * (radius + 0.35), 0.27, Math.sin(a) * (radius + 0.35));
    m.rotation.y = -a + Math.PI / 2;
    scene.add(m);
  }
  for (const [x, c] of [[-1, '#8e2430'], [1, '#2f5a8f']] as const) {
    const b = bannerPole(c, 3.4);
    b.position.set(x * (radius + 1.2), 0, -radius * 0.6);
    scene.add(b);
    const t = torch();
    t.position.set(x * (radius + 1.1), 0, radius * 0.3);
    scene.add(t);
  }
}

/**
 * Cerca de madeira reta de (x0, z0) a (x1, z1): mourões e duas travessas.
 * Com `y1`, a cerca sobe de `y` até `y1` (ladeiras).
 */
export function fence(scene: THREE.Scene, x0: number, z0: number, x1: number, z1: number, y = 0, color = WOOD, y1 = y): void {
  const flat = Math.hypot(x1 - x0, z1 - z0);
  if (flat < 0.1) return;
  const len = Math.hypot(flat, y1 - y);
  const g = new THREE.Group();
  const wood = paint(color, { facet: 0.16 });
  const posts = Math.max(2, Math.round(len / 1.6) + 1);
  for (let i = 0; i < posts; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.16), wood);
    p.position.set(-len / 2 + (i * len) / (posts - 1), 0.42, 0);
    g.add(p);
  }
  for (const h of [0.3, 0.62]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.08), wood);
    rail.position.y = h;
    g.add(rail);
  }
  g.position.set((x0 + x1) / 2, (y + y1) / 2, (z0 + z1) / 2);
  // ordem XYZ: primeiro inclina no próprio eixo, depois vira para a direção da cerca
  g.rotation.set(0, -Math.atan2(z1 - z0, x1 - x0), Math.atan2(y1 - y, flat));
  scene.add(g);
}

/** Cerca redonda. */
export function ringFence(scene: THREE.Scene, radius: number, segments = 18, y = 0): void {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    fence(scene, Math.cos(a0) * radius, Math.sin(a0) * radius, Math.cos(a1) * radius, Math.sin(a1) * radius, y);
  }
}

/** Ilha de grama com terra por baixo (topo em y = `top`). */
export function grassIsland(scene: THREE.Scene, radius: number, depth = 4, grass = '#5f8a3c', top = 0): void {
  const lawn = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius - 0.1, 0.5, 24), paint(grass, { facet: 0.08 }));
  lawn.position.y = top - 0.25;
  scene.add(lawn);
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(radius - 0.1, radius * 0.75, depth, 24), paint('#6b4a2f', { facet: 0.16 }));
  dirt.position.y = top - 0.5 - depth / 2;
  scene.add(dirt);
}

/** Torre de pedra com ameias (topo em `h`). */
export function tower(h: number, r = 1.1, roof?: string): THREE.Group {
  const g = new THREE.Group();
  const stone = paint('#a39b8e', { facet: 0.12 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, h, 8), stone);
  body.position.y = h / 2;
  g.add(body);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.05, 0.35, 8), paint('#8a8378', { facet: 0.12 }));
  ring.position.y = h;
  g.add(ring);
  if (roof) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 1.35, r * 1.6, 8), paint(roof, { facet: 0.14 }));
    cone.position.y = h + 0.18 + r * 0.8;
    g.add(cone);
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.3), stone);
      m.position.set(Math.cos(a) * r * 1.05, h + 0.38, Math.sin(a) * r * 1.05);
      m.rotation.y = -a;
      g.add(m);
    }
  }
  return g;
}
