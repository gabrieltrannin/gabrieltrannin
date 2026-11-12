import * as THREE from 'three';
import { seeded } from '@fuzue/shared';
import { isTouch, reduceMotion } from './Stage';
import { ball, outline, shared, stripeTexture, toon, toonMap } from './materials';

/** Peças de cenário reaproveitadas pelas telas. */

export function addLights(scene: THREE.Scene, size = 12): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight('#ffffff', '#c7b2ff', 1.95));
  const sun = new THREE.DirectionalLight('#fff4e2', 1.95);
  sun.position.set(6, 18, 10);
  sun.castShadow = true;
  const res = isTouch ? 1024 : 2048;
  sun.shadow.mapSize.set(res, res);
  const c = sun.shadow.camera;
  c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 1; c.far = 70;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

export const SEA_Y = -3;

/** Mar de morango com rosquinhas boiando. Retorna a função de animação. */
export function addSea(scene: THREE.Scene, seed = 11, y = SEA_Y): (dt: number, t: number) => void {
  const sea = new THREE.Mesh(new THREE.CircleGeometry(160, 64), toon('#ff9ecb'));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = y;
  scene.add(sea);
  const rand = seeded(seed);
  const torus = new THREE.TorusGeometry(0.7, 0.32, 12, 24);
  const icings = ['#ff5fa2', '#a77bff', '#3fd6b0', '#ffffff', '#ffc93c'];
  const donuts: { g: THREE.Group; ph: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    const dough = new THREE.Mesh(torus, toon('#e8a765'));
    dough.rotation.x = Math.PI / 2;
    outline(dough, 1.05);
    g.add(dough);
    const icing = new THREE.Mesh(torus, toon(icings[i % icings.length]));
    icing.rotation.x = Math.PI / 2;
    icing.position.y = 0.12;
    icing.scale.set(0.98, 0.98, 0.7);
    g.add(icing);
    const a = (i / 10) * Math.PI * 2 + rand() * 0.4;
    const r = 15 + rand() * 9;
    g.position.set(Math.cos(a) * r, y + 0.05, Math.sin(a) * r);
    g.rotation.y = rand() * Math.PI * 2;
    scene.add(g);
    donuts.push({ g, ph: rand() * Math.PI * 2 });
  }
  return (dt, t) => {
    if (reduceMotion) return;
    for (const d of donuts) {
      d.g.position.y = y + 0.05 + Math.sin(t * 1.4 + d.ph) * 0.12;
      d.g.rotation.y += dt * 0.15;
    }
  };
}

/** Postes de bala e nuvens no horizonte. */
export function addHorizon(scene: THREE.Scene, radius = 30, seed = 5): void {
  const rand = seeded(seed);
  const tallTex = stripeTexture('#ffffff', '#ff5fa2');
  tallTex.repeat.set(3, 5);
  const icings = ['#ff5fa2', '#a77bff', '#3fd6b0', '#ffffff', '#ffc93c'];
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI / 2 + (i - 5) * 0.3;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 14, 16), toonMap(tallTex));
    p.position.set(Math.cos(a) * radius, SEA_Y + 7, Math.sin(a) * radius);
    scene.add(p);
    const top = ball(1.2, toon(icings[i % icings.length]));
    top.position.set(p.position.x, SEA_Y + 14.6, p.position.z);
    outline(top, 1.05);
    scene.add(top);
  }
  const cloudMat = toon('#ffffff');
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const b = ball(0.8 + rand() * 0.7, cloudMat, 1, 0.72, 1);
      b.position.set((k - (n - 1) / 2) * 1.1, rand() * 0.4, rand() * 0.6);
      g.add(b);
    }
    const a = -Math.PI / 2 + (rand() - 0.5) * 2.8;
    g.position.set(Math.cos(a) * (radius + 14), 8 + rand() * 10, Math.sin(a) * (radius + 14));
    g.scale.setScalar(2.6);
    scene.add(g);
  }
}

/** Pirulito decorativo. */
export function lollipop(color: string): THREE.Group {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), toon('#ffffff'));
  stick.position.y = 0.75;
  g.add(stick);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 24), toon(color));
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 1.6;
  disc.castShadow = true;
  outline(disc, 1.07);
  g.add(disc);
  for (const z of [0.085, -0.085]) {
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.05, 6, 24), toon('#ffffff'));
    sw.position.set(0, 1.6, z);
    g.add(sw);
  }
  return g;
}

/** Árvore de algodão-doce. */
export function cottonTree(color: string): THREE.Group {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 8), toon('#fff3d6'));
  stick.position.y = 0.55;
  g.add(stick);
  const m = toon(color);
  [[0, 1.35, 0, 0.5], [0.3, 1.15, 0.1, 0.36], [-0.3, 1.2, -0.05, 0.38], [0.05, 1.7, 0, 0.34]].forEach(([x, y, z, r]) => {
    const b = ball(r, m);
    b.position.set(x, y, z);
    b.castShadow = true;
    outline(b, 1.06);
    g.add(b);
  });
  return g;
}

/** Bala de goma (domo). */
const DOME = shared(new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2));
export function gumdrop(color: string): THREE.Mesh {
  const m = new THREE.Mesh(DOME, toon(color));
  m.scale.set(0.36, 0.44, 0.36);
  m.castShadow = true;
  outline(m, 1.08);
  return m;
}

/** Coroa dourada. */
export function makeCrown(): THREE.Group {
  const crown = new THREE.Group();
  const gold = toon('#ffc93c');
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.3, 0.24, 10, 1, true),
    new THREE.MeshToonMaterial({ color: '#ffc93c', side: THREE.DoubleSide }),
  );
  crown.add(band);
  const spike = new THREE.ConeGeometry(0.08, 0.24, 6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = new THREE.Mesh(spike, gold);
    sp.position.set(Math.cos(a) * 0.32, 0.22, Math.sin(a) * 0.32);
    crown.add(sp);
    const jw = ball(0.055, toon(i % 2 ? '#ff4d5a' : '#3fd6b0'));
    jw.position.set(Math.cos(a) * 0.335, 0, Math.sin(a) * 0.335);
    crown.add(jw);
    const tip = ball(0.045, toon('#fff6d0'));
    tip.position.set(Math.cos(a) * 0.32, 0.36, Math.sin(a) * 0.32);
    crown.add(tip);
  }
  return crown;
}

/** Bombinha preta com pavio. */
export function makeBomb(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const body = ball(0.35 * scale, toon('#3a2f52'));
  body.castShadow = true;
  outline(body, 1.08);
  g.add(body);
  const shine = ball(0.08 * scale, toon('#8f84b0'));
  shine.position.set(-0.12 * scale, 0.14 * scale, 0.22 * scale);
  g.add(shine);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.12 * scale, 0.12 * scale, 10), toon('#6b5c96'));
  cap.position.y = 0.36 * scale;
  g.add(cap);
  const spark = ball(0.09 * scale, new THREE.MeshBasicMaterial({ color: '#ffc93c' }));
  spark.position.y = 0.5 * scale;
  spark.name = 'spark';
  g.add(spark);
  return g;
}

/** Moeda dourada. */
export function makeCoin(value = 1): THREE.Mesh {
  const r = value > 1 ? 0.42 : 0.32;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 20), toon(value > 1 ? '#ffe066' : '#ffc93c'));
  m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  outline(m, 1.08);
  return m;
}

/** Sombra redonda no chão (onde algo vai cair). */
export function makeShadowMarker(color = '#2a1d45', r = 0.6): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}
