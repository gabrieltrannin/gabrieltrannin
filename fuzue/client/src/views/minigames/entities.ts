import * as THREE from 'three';
import { BARDO_COLORS, MOINHO, RACE, SOCCER, TEAMS } from '@fuzue/shared';
import { animateCritter, makeCritter } from '../../engine/critter';
import { canvasTexture, chunk, glow, metal, paint, paintMap } from '../../engine/materials';
import { bannerPole, makeCoin, makeCrown, makeFireball, makeShadowMarker } from '../../engine/scenery';
import type { NetEntity } from '../../net/types';

/**
 * Objetos dos minijogos que vêm do servidor (mg.entities): como cada tipo
 * aparece e se mexe. `data` é o próprio objeto sincronizado: os valores
 * mudam sozinhos a cada atualização do servidor.
 */
export interface EntityView {
  kind: string;
  obj: THREE.Object3D;
  shadow: THREE.Mesh | null;
  target: THREE.Vector3;
  last: THREE.Vector3;
  data: NetEntity;
  /** Posição controlada pelo próprio tipo (não desliza até `target`). */
  fixed?: boolean;
  tick?(v: EntityView, dt: number, t: number): void;
}

const SHADOWLESS = (o: THREE.Object3D) => o.traverse(c => { c.userData.noCast = true; });

export function createEntity(e: NetEntity): EntityView {
  const v: EntityView = {
    kind: e.kind, obj: new THREE.Object3D(), shadow: null, data: e,
    target: new THREE.Vector3(e.x, e.y, e.z), last: new THREE.Vector3(e.x, e.y, e.z),
  };
  const build = BUILDERS[e.kind];
  if (build) build(v, e);
  v.obj.position.set(e.x, e.y, e.z);
  return v;
}

type Builder = (v: EntityView, e: NetEntity) => void;

const BUILDERS: Record<string, Builder> = {
  /* ---------------- clássicos ---------------- */
  coin(v, e) {
    v.obj = makeCoin(e.s);
    v.shadow = makeShadowMarker('#ffc93c', 0.45);
    v.tick = (w, dt) => { w.obj.rotation.z += dt * 4; };
  },
  bomb(v) {
    v.obj = makeFireball();
    v.shadow = makeShadowMarker('#c0391b', 1.2);
    v.tick = (w, _dt, t) => { const sp = w.obj.getObjectByName('spark'); if (sp) sp.scale.setScalar(0.8 + Math.sin(t * 25) * 0.4); };
  },
  ball(v) {
    const tex = canvasTexture(512, 256, (g, w, h) => {
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#8a5a32' : '#9c6a3c'; g.fillRect((i * w) / 6, 0, w / 6 + 1, h); }
      g.strokeStyle = '#efe3c6';
      g.lineWidth = 4;
      g.setLineDash([10, 8]);
      for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo((i * w) / 6, 0); g.lineTo((i * w) / 6, h); g.stroke(); }
    });
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(SOCCER.ballR, 2), paintMap(tex, { rough: 0.7 }));
    (m.material as THREE.MeshStandardMaterial).flatShading = true;
    v.obj = m;
    const roll = new THREE.Quaternion();
    v.tick = w => {
      const dx = w.obj.position.x - w.last.x;
      const dz = w.obj.position.z - w.last.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1e-4) {
        roll.setFromAxisAngle(new THREE.Vector3(dz / dist, 0, -dx / dist), dist / SOCCER.ballR);
        w.obj.quaternion.premultiply(roll);
      }
    };
  },
  sweeper(v) {
    const g = new THREE.Group();
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, RACE.sweeperLength * 2, 8), paint('#6a4628', { facet: 0.14 }));
    log.rotation.z = Math.PI / 2;
    g.add(log);
    const spike = new THREE.ConeGeometry(0.1, 0.32, 4);
    for (let k = 0; k < 10; k++) {
      const x = -RACE.sweeperLength + 0.4 + (k * (RACE.sweeperLength * 2 - 0.8)) / 9;
      const sp = new THREE.Mesh(spike, metal('#8a9097', 0.4));
      const a = k * 1.7;
      sp.position.set(x, Math.cos(a) * 0.38, Math.sin(a) * 0.38);
      sp.rotation.x = a;
      g.add(sp);
    }
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 8), metal('#4a4d52', 0.45));
      cap.rotation.z = Math.PI / 2;
      cap.position.x = sx * RACE.sweeperLength;
      g.add(cap);
    }
    v.obj = g;
    v.tick = w => { w.obj.rotation.y = -w.data.a; };
  },

  /* ---------------- Coroa Roubada ---------------- */
  crown(v) {
    const g = new THREE.Group();
    const c = makeCrown();
    c.scale.setScalar(1.5);
    c.position.y = 0.35;
    g.add(c);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 24), glow('#ffd36b', 1.6, { opacity: 0.6 }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.4;
    g.add(halo);
    SHADOWLESS(halo);
    v.obj = g;
    v.tick = (w, _dt, t) => {
      w.obj.visible = w.data.y > -10;
      c.rotation.y = t * 1.6;
      c.position.y = 0.35 + Math.sin(t * 3) * 0.1;
    };
  },

  /* ---------------- Trono Disputado ---------------- */
  zone(v, e) {
    const g = new THREE.Group();
    const r = e.s || 2.3;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.18, r, 40), glow('#ffd36b', 1.8, { opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    g.add(ring);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(r - 0.18, 40), glow('#c9a227', 0.6, { opacity: 0.18 }));
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.05;
    g.add(fill);
    // o trono no meio do círculo
    const throne = new THREE.Group();
    const wood = paint('#6a3a26', { facet: 0.14 });
    const red = paint('#8e2430', { facet: 0.1 });
    const gold = metal('#e0b33a', 0.25);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.8), wood);
    seat.position.y = 0.22;
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.7), red);
    cushion.position.y = 0.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.15), wood);
    back.position.set(0, 0.95, -0.35);
    const backRed = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.05), red);
    backRed.position.set(0, 0.95, -0.26);
    throne.add(seat, cushion, back, backRed);
    for (const x of [-0.42, 0, 0.42]) {
      const knob = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), gold);
      knob.position.set(x, 1.68, -0.35);
      throne.add(knob);
    }
    throne.position.z = -r * 0.55;
    throne.scale.setScalar(0.8);
    g.add(throne);
    SHADOWLESS(ring);
    SHADOWLESS(fill);
    v.obj = g;
    v.tick = (w, _dt, t) => {
      // pisca quando vai mudar de lugar
      const left = w.data.a;
      const blink = left < 2.2 ? (Math.sin(t * 18) > 0 ? 1 : 0.35) : 1;
      ring.scale.setScalar(1 + Math.sin(t * 3) * 0.03);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * blink;
    };
  },

  /* ---------------- Quebra-Potes ---------------- */
  pot(v, e) {
    const kind = Math.round(e.s);
    const pts: THREE.Vector2[] = [[0, 0], [0.32, 0.02], [0.44, 0.25], [0.42, 0.5], [0.26, 0.72], [0.24, 0.82], [0.3, 0.88]].map(([x, y]) => new THREE.Vector2(x, y));
    const mat = kind === 1 ? metal('#e0b33a', 0.25) : paint(kind === 2 ? '#3d3530' : '#b5653a', { facet: 0.16 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 7), mat);
    g.add(body);
    if (kind === 2) {
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 4), paint('#2b1d12'));
      fuse.position.y = 1.0;
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), glow('#ffcf6b', 4));
      spark.position.y = 1.15;
      spark.name = 'spark';
      g.add(fuse, spark);
      const skull = new THREE.Mesh(new THREE.CircleGeometry(0.12, 6), paint('#efe3c6'));
      skull.position.set(0, 0.42, 0.44);
      g.add(skull);
    } else {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 4, 12), kind === 1 ? glow('#fff0b0', 1.4) : paint('#7a3f22'));
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.35;
      g.add(band);
    }
    g.rotation.y = e.a;
    g.scale.setScalar(1.15);
    v.obj = g;
    v.tick = (w, _dt, t) => {
      const sp = w.obj.getObjectByName('spark');
      if (sp) sp.scale.setScalar(0.7 + Math.sin(t * 22) * 0.4);
      if (kind === 1) w.obj.rotation.y = w.data.a + Math.sin(t * 2) * 0.3;
    };
  },

  /* ---------------- Colheita ---------------- */
  pumpkin(v, e) {
    const gold = e.s > 0.5;
    const g = new THREE.Group();
    const body = chunk(0.42, gold ? metal('#e0b33a', 0.3) : paint('#d9741f', { facet: 0.18 }), 1.15, 0.8, 1.15);
    g.add(body);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.22, 5), paint('#4f6b35'));
    stem.position.y = 0.38;
    stem.rotation.z = 0.2;
    g.add(stem);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.05, 3), paint('#5f8a3c'));
    leaf.position.set(0.12, 0.38, 0);
    g.add(leaf);
    g.rotation.y = e.a;
    v.obj = g;
  },

  /* ---------------- Moinho Maluco ---------------- */
  mill(v) {
    const g = new THREE.Group();
    const wood = paint('#7a5333', { facet: 0.16 });
    const arms: THREE.Group[] = [];
    for (let k = 0; k < 2; k++) {
      const arm = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.BoxGeometry(MOINHO.armLen - MOINHO.hubR, 0.32, 0.32), wood);
      beam.position.set((MOINHO.armLen + MOINHO.hubR) / 2, 0.42, 0);
      arm.add(beam);
      const bale = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), paint('#d9b45a', { facet: 0.2 }));
      bale.position.set(MOINHO.armLen - 0.3, 0.42, 0);
      arm.add(bale);
      for (let i = 1; i < 5; i++) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.36), metal('#4a4d52', 0.45));
        strap.position.set(MOINHO.hubR + i * ((MOINHO.armLen - MOINHO.hubR) / 5), 0.42, 0);
        arm.add(strap);
      }
      arm.rotation.y = k * Math.PI;
      g.add(arm);
      arms.push(arm);
    }
    // pás grandes lá em cima, girando junto
    const sails = new THREE.Group();
    sails.position.set(0, 7.6, 0.95);
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Group();
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.6, 0.1), wood);
      spar.position.y = 1.8;
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.8, 0.04), paint('#efe3c6', { facet: 0.1 }));
      cloth.position.set(0.55, 2.0, 0);
      s.add(spar, cloth);
      s.rotation.z = (k * Math.PI) / 2;
      sails.add(s);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 8), metal('#4a4d52', 0.45));
    hub.rotation.x = Math.PI / 2;
    sails.add(hub);
    g.add(sails);
    v.obj = g;
    v.fixed = true;
    v.tick = (w) => {
      const a = w.data.a;
      arms[0].rotation.y = -a;
      arms[1].rotation.y = -a - Math.PI;
      arms[1].visible = w.data.s > 1.5;
      sails.rotation.z = a * 1.5;
      w.obj.position.set(0, 0, 0);
    };
  },

  /* ---------------- Chuva de Flechas ---------------- */
  arrow(v) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 4), paint('#8a6a3a'));
    shaft.position.y = 0.65;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 4), metal('#8a9097', 0.35));
    head.rotation.x = Math.PI;
    head.position.y = -0.1;
    g.add(shaft, head);
    for (let k = 0; k < 3; k++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.16), paint('#a3242f'));
      fin.position.set(Math.cos((k * Math.PI * 2) / 3) * 0.06, 1.2, Math.sin((k * Math.PI * 2) / 3) * 0.06);
      fin.rotation.y = (k * Math.PI * 2) / 3;
      g.add(fin);
    }
    g.rotation.z = 0.12;
    v.obj = g;
    v.shadow = makeShadowMarker('#8e2430', 0.85);
  },

  /* ---------------- Fúria do Javali ---------------- */
  boar(v) {
    const g = new THREE.Group();
    const fur = paint('#5a3d2b', { facet: 0.18 });
    const dark = paint('#3a271c', { facet: 0.14 });
    const body = chunk(0.75, fur, 1, 0.75, 1.3);
    body.position.y = 0.75;
    g.add(body);
    const mane = chunk(0.4, dark, 0.6, 0.6, 1.4);
    mane.position.set(0, 1.25, -0.1);
    g.add(mane);
    const head = chunk(0.45, fur, 0.95, 0.85, 1.1);
    head.position.set(0, 0.8, 0.95);
    g.add(head);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.25, 6), paint('#c98f7a'));
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.7, 1.42);
    g.add(snout);
    for (const s of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), paint('#f1ead8'));
      tusk.position.set(s * 0.2, 0.68, 1.38);
      tusk.rotation.set(-0.6, 0, s * 0.4);
      g.add(tusk);
      const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), glow('#ff4020', 1.5));
      eye.position.set(s * 0.22, 0.98, 1.3);
      eye.name = 'eye';
      g.add(eye);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), dark);
      ear.position.set(s * 0.28, 1.2, 0.85);
      g.add(ear);
    }
    const legs: THREE.Mesh[] = [];
    for (const [x, z] of [[-0.35, 0.5], [0.35, 0.5], [-0.35, -0.55], [0.35, -0.55]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.5, 5), dark);
      leg.position.set(x, 0.25, z);
      g.add(leg);
      legs.push(leg);
    }
    g.scale.setScalar(1.05);
    v.obj = g;
    v.tick = (w, _dt, t) => {
      const state = Math.round(w.data.s);
      w.obj.rotation.y = w.data.a;
      // mirando: cava o chão; correndo: galope
      const speed = state === 1 ? 22 : state === 0 ? 10 : 3;
      legs.forEach((l, i) => { l.rotation.x = Math.sin(t * speed + i * 1.6) * (state === 2 ? 0.1 : 0.6); });
      body.position.y = 0.75 + (state === 1 ? Math.abs(Math.sin(t * speed)) * 0.15 : 0);
      w.obj.rotation.z = state === 0 ? Math.sin(t * 30) * 0.03 : 0;
      for (const c of w.obj.children) if (c.name === 'eye') c.scale.setScalar(state === 0 ? 1.4 + Math.sin(t * 20) * 0.4 : 1);
    };
  },

  /* ---------------- Cerco ao Castelo ---------------- */
  boulder(v, e) {
    const g = new THREE.Group();
    const rock = chunk(0.75, paint('#7d7468', { facet: 0.22 }), 1, 0.9, 1);
    g.add(rock);
    g.rotation.set(e.a, e.a * 2, 0);
    v.obj = g;
    v.shadow = makeShadowMarker('#5a1010', 1.0);
    v.tick = (_w, dt) => { rock.rotation.x += dt * 4; rock.rotation.z += dt * 3; };
  },

  /* ---------------- O Bardo Manda ---------------- */
  bard(v) {
    const g = new THREE.Group();
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.6, 8), paint('#6a4628', { facet: 0.16 }));
    stage.position.y = -0.3;
    g.add(stage);
    const bard = makeCritter(3);
    bard.root.scale.setScalar(1.1);
    bard.root.rotation.y = 0;
    g.add(bard.root);
    // estandarte com a cor cantada
    const pole = bannerPole('#ffffff', 2.6);
    pole.position.set(0.9, 0, 0.2);
    g.add(pole);
    const cloth = pole.getObjectByName('cloth') as THREE.Mesh;
    const mats = BARDO_COLORS.map(c => paint(c, { side: THREE.DoubleSide }));
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), glow('#ffffff', 1.6));
    gem.position.set(0, 3.1, 0);
    g.add(gem);
    const gemMats = BARDO_COLORS.map(c => glow(c, 2.2));
    v.obj = g;
    v.fixed = true;
    v.tick = (w, _dt, t) => {
      const color = Math.round(w.data.s);
      const calling = w.data.a >= 0;
      if (color >= 0) {
        cloth.material = mats[color];
        gem.material = gemMats[color];
      }
      gem.visible = color >= 0;
      gem.rotation.y = t * 2;
      gem.position.y = 3.1 + Math.sin(t * 3) * 0.12;
      gem.scale.setScalar(calling && w.data.a < 1 ? 1 + Math.sin(t * 20) * 0.2 : 1);
      animateCritter(bard, t, { speed: 0, punching: false, stunned: false, falling: false, waving: calling, celebrate: !calling });
      w.obj.position.set(w.data.x, 0, w.data.z);
    };
  },

  /* ---------------- Tinta do Reino ---------------- */
  bucket(v) {
    const g = new THREE.Group();
    const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.5, 8, 1, true), paint('#7a5333', { facet: 0.16, side: THREE.DoubleSide }));
    pail.position.y = 0.25;
    g.add(pail);
    const paintTop = new THREE.Mesh(new THREE.CircleGeometry(0.32, 8), glow('#f2c75c', 1.3));
    paintTop.rotation.x = -Math.PI / 2;
    paintTop.position.y = 0.42;
    g.add(paintTop);
    for (const y of [0.1, 0.4]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.025, 4, 10), metal('#4a4d52', 0.45));
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      g.add(band);
    }
    const colors = ['#b8323f', '#2f64a8', '#3f8a3a', '#d9a520'].map(c => glow(c, 1.4));
    v.obj = g;
    v.tick = (w, _dt, t) => {
      w.obj.rotation.y = t * 1.5;
      w.obj.position.y = Math.abs(Math.sin(t * 3)) * 0.25;
      paintTop.material = colors[Math.floor(t * 3) % colors.length];
    };
  },

  /* ---------------- Ladeira dos Barris ---------------- */
  barrel(v) {
    const g = new THREE.Group();
    const r = 0.55;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.1, 9), paint('#7a5333', { facet: 0.18 }));
    barrel.rotation.z = Math.PI / 2;
    const spin = new THREE.Group();
    spin.add(barrel);
    for (const x of [-0.38, 0.38]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, 0.04, 4, 9), metal('#3a3a3a', 0.5));
      band.rotation.y = Math.PI / 2;
      band.position.x = x;
      spin.add(band);
    }
    g.add(spin);
    v.obj = g;
    v.tick = w => { spin.rotation.x = w.data.a; };
  },

  /* ---------------- Corredor dos Machados ---------------- */
  axe(v) {
    const L = 4.6;
    const g = new THREE.Group();
    const swing = new THREE.Group();
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, L, 4), paint('#5a3d24'));
    rope.position.y = -L / 2;
    swing.add(rope);
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 10, 1, false, 0, Math.PI), metal('#9aa0a6', 0.3));
    blade.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    blade.position.y = -L - 0.1;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), metal('#4a4d52', 0.45));
    back.position.y = -L + 0.1;
    swing.add(blade, back);
    g.add(swing);
    v.obj = g;
    v.fixed = true;
    const topY = L + 0.6;
    v.tick = w => {
      const x = Math.max(-L * 0.95, Math.min(L * 0.95, w.data.x));
      swing.rotation.z = Math.asin(x / L);
      w.obj.position.set(0, topY, w.data.z);
    };
  },

  /* ---------------- Pastoreio ---------------- */
  sheep(v) {
    const g = new THREE.Group();
    const wool = paint('#f1ece0', { facet: 0.2 });
    const black = paint('#2a2622', { facet: 0.1 });
    const body = new THREE.Group();
    for (const [x, y, z, r] of [[0, 0.62, 0, 0.42], [0, 0.66, 0.28, 0.34], [0, 0.64, -0.3, 0.36], [0.2, 0.75, 0, 0.3], [-0.2, 0.75, 0, 0.3]]) {
      const puff = chunk(r, wool);
      puff.position.set(x, y, z);
      body.add(puff);
    }
    g.add(body);
    const head = chunk(0.22, black, 0.9, 1, 1.2);
    head.position.set(0, 0.78, 0.6);
    g.add(head);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.1), black);
      ear.position.set(s * 0.22, 0.86, 0.55);
      g.add(ear);
    }
    const legs: THREE.Mesh[] = [];
    for (const [x, z] of [[-0.2, 0.25], [0.2, 0.25], [-0.2, -0.25], [0.2, -0.25]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 4), black);
      leg.position.set(x, 0.2, z);
      g.add(leg);
      legs.push(leg);
    }
    v.obj = g;
    v.tick = (w, dt, t) => {
      const moving = w.obj.position.distanceTo(w.last) / Math.max(dt, 1e-3);
      w.obj.rotation.y = w.data.a;
      const k = Math.min(1, moving / 3);
      legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 16 + i * 1.7) * 0.6 * k; });
      body.position.y = w.data.s > 0.3 ? Math.abs(Math.sin(t * 14)) * 0.15 : 0;
    };
  },

  /* ---------------- Captura do Estandarte ---------------- */
  flag(v, e) {
    const team = Math.round(e.s);
    const g = new THREE.Group();
    const pole = bannerPole(TEAMS.colors[team] ?? '#ffffff', 2.4);
    g.add(pole);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 24), glow(TEAMS.colors[team] ?? '#ffffff', 1.6, { opacity: 0.7 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    SHADOWLESS(ring);
    g.add(ring);
    v.obj = g;
    v.tick = (w, _dt, t) => {
      const state = Math.round(w.data.a);
      // carregado: inclinado nas costas; caído: deitado no chão
      pole.rotation.z = state === 2 ? 1.2 : state === 1 ? 0.25 : 0;
      pole.position.y = state === 2 ? 0.3 : 0;
      ring.visible = state !== 1;
      ring.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    };
  },
};
