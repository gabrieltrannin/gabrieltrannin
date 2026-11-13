import * as THREE from 'three';
import { CHARACTERS, type CharacterDef } from '@fuzue/shared';
import { ball, glow, metal as metalMat, paint, shared, INK } from './materials';

/**
 * Bichinhos low-poly com roupa medieval, montados só com primitivas facetadas.
 * A origem do grupo fica nos pés; o corpo tem ~1,65 m de altura em escala 1
 * (chapéus e plumas vão além).
 */
export interface Critter {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  arms: THREE.Group[];
  feet: THREE.Mesh[];
  /** Peças que balançam (orelhas, pluma, pontas do chapéu do bobo). */
  ears: THREE.Object3D[];
  def: CharacterDef;
  phase: number;
}

const SMILE = shared(new THREE.TorusGeometry(0.07, 0.022, 6, 16, Math.PI));
const EAR_CONE = shared(new THREE.ConeGeometry(0.17, 0.36, 4));
const BEAK = shared(new THREE.ConeGeometry(0.09, 0.2, 10));
/** Parte de baixo de uma esfera: vira túnica por cima do corpo. */
const TUNIC = shared(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 1.0, Math.PI - 1.0));
const DOME = shared(new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2));
const HOOD = shared(new THREE.SphereGeometry(1, 14, 9, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, 2.05));
const ROBE = shared(new THREE.CylinderGeometry(0.44, 0.56, 0.72, 12));
const BOX = shared(new THREE.BoxGeometry(1, 1, 1));
const CONE = shared(new THREE.ConeGeometry(1, 1, 9));
const CYL = shared(new THREE.CylinderGeometry(1, 1, 1, 10));
const BELT = shared(new THREE.TorusGeometry(1, 0.085, 5, 18));

const LEATHER = '#4a3322';
const METAL = '#a7adb3';
const DARK_METAL = '#6f757c';
const WOOD = '#6a4628';
const GOLD = '#c9a227';

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(w, h, d);
  return m;
}
function cyl(r: number, h: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(CYL, mat);
  m.scale.set(r, h, r);
  return m;
}
function cone(r: number, h: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(CONE, mat);
  m.scale.set(r, h, r);
  return m;
}
function belt(mat: THREE.Material, r: number, y: number): THREE.Mesh {
  const m = new THREE.Mesh(BELT, mat);
  m.scale.set(r, r, r * 0.6);
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  return m;
}

export function makeCritter(characterIndex: number): Critter {
  const def = CHARACTERS[characterIndex] ?? CHARACTERS[0];
  const { kind, role } = def;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const fur = paint(def.fur);
  const belly = paint(def.belly);
  const outfit = paint(def.color);
  const trim = paint(def.trim);
  const ink = paint(INK, { smooth: true, rough: 0.4 });
  const white = paint('#f7f1e6', { smooth: true, rough: 0.35 });
  const blush = paint('#d98c8c', { smooth: true });
  const leather = paint(LEATHER);
  const metal = metalMat(METAL);
  const gold = metalMat(GOLD, 0.28);
  const darkMetal = metalMat(DARK_METAL, 0.45);
  const ears: THREE.Object3D[] = [];
  const robe = role === 'bruxa' || role === 'frade';

  /* ---------------- corpo do bichinho ---------------- */
  const torso = ball(0.48, kind === 'ovelha' ? belly : fur, 1, 0.92, 0.95);
  torso.position.y = 0.52;
  torso.castShadow = true;
  body.add(torso);
  if (kind === 'pinguim') {
    const tummy = ball(0.36, belly, 1, 1.1, 0.6);
    tummy.position.set(0, 0.48, 0.2);
    body.add(tummy);
  }

  /* ---------------- roupa ---------------- */
  if (role === 'bobo') {
    // túnica de duas cores
    for (const [i, mat] of [outfit, trim].entries()) {
      const half = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8, i * Math.PI, Math.PI, 1.0, Math.PI - 1.0), mat);
      half.scale.set(0.505, 0.47, 0.5);
      half.position.y = 0.52;
      body.add(half);
    }
  } else {
    const tunic = new THREE.Mesh(TUNIC, role === 'cavaleiro' || role === 'viking' ? outfit : outfit);
    tunic.scale.set(0.505, 0.47, 0.5);
    tunic.position.y = 0.52;
    tunic.castShadow = true;
    body.add(tunic);
  }
  if (robe) {
    const r = new THREE.Mesh(ROBE, outfit);
    r.position.y = 0.36;
    if (role === 'frade') r.scale.set(1.05, 1.04, 1.05);
    r.castShadow = true;
    body.add(r);
  }
  const beltMat = role === 'frade' ? paint('#d8c08a') : role === 'bruxa' ? gold : leather;
  body.add(belt(beltMat, robe ? 0.48 : 0.465, robe ? 0.46 : 0.4));
  if (role !== 'frade') {
    const buckle = box(0.11, 0.09, 0.05, gold);
    buckle.position.set(0, robe ? 0.46 : 0.4, robe ? 0.5 : 0.47);
    body.add(buckle);
  }

  /* ---------------- cabeça ---------------- */
  const head = new THREE.Group();
  head.position.y = 1.14;
  body.add(head);
  const skull = ball(0.47, fur, 1.06, 0.95, 1);
  skull.castShadow = true;
  head.add(skull);

  for (const s of [-1, 1]) {
    const eyeWhite = ball(0.12, white, 1, 1.15, 0.6);
    eyeWhite.position.set(s * 0.17, 0.06, 0.4);
    head.add(eyeWhite);
    const pupil = ball(0.075, ink, 1, 1.2, 0.6);
    pupil.position.set(s * 0.17, 0.05, 0.45);
    head.add(pupil);
    const glint = ball(0.026, white);
    glint.position.set(s * 0.17 + 0.025, 0.1, 0.495);
    head.add(glint);
    if (kind !== 'ovelha') {
      const cheek = ball(0.07, blush, 1, 0.6, 0.4);
      cheek.position.set(s * 0.31, -0.1, 0.35);
      head.add(cheek);
    }
  }

  switch (kind) {
    case 'urso': {
      const muzzle = ball(0.16, belly, 1.2, 0.85, 0.7);
      muzzle.position.set(0, -0.1, 0.4);
      head.add(muzzle);
      const nose = ball(0.05, ink, 1.2, 0.9, 0.8);
      nose.position.set(0, -0.05, 0.51);
      head.add(nose);
      addSmile(head, ink, -0.15, 0.5, 0.8);
      for (const s of [-1, 1]) {
        // um pouco mais para fora: aparecem pelos furos do elmo
        const ear = ball(0.15, fur, 1, 1, 0.7);
        ear.position.set(s * 0.39, 0.4, -0.02);
        head.add(ear);
        const inner = ball(0.08, belly, 1, 1, 0.5);
        inner.position.set(s * 0.39, 0.4, 0.07);
        head.add(inner);
      }
      break;
    }
    case 'coelho': {
      addSmile(head, ink);
      for (const s of [-1, 1]) {
        // saem por baixo da aba do chapéu de bruxa
        const g = new THREE.Group();
        g.position.set(s * 0.3, 0.3, -0.04);
        g.rotation.z = -s * 0.55;
        g.userData.base = g.rotation.z;
        const ear = ball(0.12, fur, 0.95, 2.6, 0.7);
        ear.position.y = 0.3;
        g.add(ear);
        const inner = ball(0.06, blush, 0.9, 2.2, 0.5);
        inner.position.set(0, 0.3, 0.06);
        g.add(inner);
        head.add(g);
        ears.push(g);
      }
      break;
    }
    case 'gato': {
      addSmile(head, ink);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(EAR_CONE, fur);
        ear.position.set(s * 0.29, 0.47, 0);
        ear.rotation.set(0, Math.PI / 4, -s * 0.38);
        head.add(ear);
      }
      break;
    }
    case 'axolote': {
      addSmile(head, ink);
      const frill = paint('#c9707f');
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const ang = (k - 1) * 0.55;
          const base = 1.15 + ang;
          const f = ball(0.075, frill, 1, 2.6, 0.7);
          f.position.set(s * (0.42 + Math.sin(base) * 0.17), 0.1 - ang * 0.25 + Math.cos(base) * 0.17, -0.05);
          f.rotation.z = -s * base;
          head.add(f);
        }
      }
      break;
    }
    case 'pinguim': {
      const mask = ball(0.34, belly, 1.15, 0.9, 0.55);
      mask.position.set(0, -0.04, 0.24);
      head.add(mask);
      const beak = new THREE.Mesh(BEAK, paint('#d98a3d'));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, -0.08, 0.52);
      head.add(beak);
      break;
    }
    case 'ovelha': {
      addSmile(head, paint('#efe3c6'));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const wool = ball(0.15, belly);
        wool.position.set(Math.cos(a) * 0.22, 0.38 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.2 - 0.05);
        head.add(wool);
      }
      for (const s of [-1, 1]) {
        const ear = ball(0.09, fur, 1.9, 0.8, 0.7);
        ear.position.set(s * 0.5, 0.08, -0.02);
        ear.rotation.z = s * 0.4;
        head.add(ear);
      }
      break;
    }
  }

  /* ---------------- braços ---------------- */
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.44, 0.68, 0.04);
    pivot.rotation.z = s * 0.35;
    const sleeve = role === 'cavaleiro' ? metal : role === 'viking' ? fur : role === 'bobo' ? (s < 0 ? outfit : trim) : outfit;
    const arm = ball(0.13, sleeve, kind === 'pinguim' ? 0.6 : 0.85, 1.35, 0.85);
    arm.position.y = -0.14;
    pivot.add(arm);
    const paw = ball(0.08, role === 'cavaleiro' ? darkMetal : fur);
    paw.position.y = -0.3;
    pivot.add(paw);
    body.add(pivot);
    arms.push(pivot);
  }

  /* ---------------- pés ---------------- */
  const footMat = kind === 'pinguim' ? paint('#d98a3d') : role === 'cavaleiro' ? darkMetal : role === 'bobo' ? outfit : leather;
  const feet: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const foot = ball(0.16, footMat, 1, 0.55, 1.35);
    foot.position.set(s * 0.21, 0.08, 0.07);
    root.add(foot);
    feet.push(foot);
  }

  /* ---------------- acessórios de cada papel ---------------- */
  switch (role) {
    case 'cavaleiro': {
      const crossV = box(0.07, 0.26, 0.04, gold);
      crossV.position.set(0, 0.56, 0.47);
      crossV.rotation.x = -0.2;
      const crossH = box(0.22, 0.07, 0.04, gold);
      crossH.position.set(0, 0.6, 0.46);
      crossH.rotation.x = -0.2;
      body.add(crossV, crossH);
      for (const s of [-1, 1]) {
        const pad = ball(0.17, metal, 1, 0.7, 1);
        pad.position.set(s * 0.42, 0.8, 0.02);
        body.add(pad);
      }
      // elmo aberto: o rosto aparece, as orelhas saem pelos lados
      const helm = new THREE.Mesh(DOME, metal);
      helm.scale.set(0.53, 0.42, 0.51);
      helm.position.y = 0.13;
      helm.castShadow = true;
      head.add(helm);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 5, 18), darkMetal);
      rim.scale.set(0.53, 0.51, 0.53);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.14;
      head.add(rim);
      const nasal = box(0.06, 0.24, 0.05, darkMetal);
      nasal.position.set(0, 0.17, 0.48);
      nasal.rotation.x = -0.25;
      head.add(nasal);
      const plume = ball(0.1, paint('#a3242f'), 1, 2.3, 0.6);
      plume.position.set(0, 0.66, -0.08);
      plume.rotation.x = -0.45;
      head.add(plume);
      ears.push(plume);
      // escudo no braço esquerdo
      const shield = new THREE.Group();
      const face = cyl(0.27, 0.05, outfit);
      face.rotation.z = Math.PI / 2;
      shield.add(face);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.03, 4, 14), metal);
      edge.rotation.y = Math.PI / 2;
      shield.add(edge);
      const e1 = box(0.03, 0.28, 0.06, gold);
      e1.position.x = -0.03;
      const e2 = box(0.03, 0.06, 0.22, gold);
      e2.position.set(-0.03, 0.04, 0);
      shield.add(e1, e2);
      shield.position.set(-0.13, -0.18, 0.06);
      arms[0].add(shield);
      break;
    }
    case 'bruxa': {
      const brim = cyl(0.55, 0.035, outfit);
      brim.position.y = 0.36;
      brim.rotation.z = 0.08;
      head.add(brim);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 4, 14), gold);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.41;
      head.add(band);
      const hat = cone(0.34, 0.85, outfit);
      hat.position.set(0.02, 0.8, -0.05);
      hat.rotation.set(-0.22, 0, -0.12);
      head.add(hat);
      const buckle = box(0.12, 0.1, 0.03, gold);
      buckle.position.set(0, 0.42, 0.33);
      head.add(buckle);
      // cajado com orbe
      const staff = cyl(0.035, 1.35, paint(WOOD));
      staff.position.set(0, -0.2, 0.1);
      arms[1].add(staff);
      const orb = ball(0.1, glow('#b9a3ff', 2.6));
      orb.position.set(0, 0.5, 0.1);
      orb.name = 'orb';
      arms[1].add(orb);
      break;
    }
    case 'arqueiro': {
      const hoodMat = paint(def.color, { side: THREE.DoubleSide });
      const hood = new THREE.Mesh(HOOD, hoodMat);
      hood.scale.set(0.53, 0.5, 0.52);
      hood.position.y = 0.01;
      head.add(hood);
      const tip = cone(0.12, 0.34, outfit);
      tip.position.set(0, 0.1, -0.56);
      tip.rotation.x = -1.3;
      head.add(tip);
      const cape = box(0.78, 0.86, 0.05, paint('#2f5230'));
      cape.position.set(0, 0.55, -0.47);
      cape.rotation.x = 0.1;
      body.add(cape);
      const quiver = cyl(0.085, 0.55, leather);
      quiver.position.set(0.22, 0.8, -0.5);
      quiver.rotation.z = -0.35;
      body.add(quiver);
      for (let k = 0; k < 3; k++) {
        const fl = cone(0.035, 0.11, paint(k === 1 ? '#a3242f' : '#efe3c6'));
        fl.position.set(0.32 + k * 0.03, 1.1, -0.5 + (k - 1) * 0.03);
        fl.rotation.z = -0.35;
        body.add(fl);
      }
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 4, 10, Math.PI), paint(WOOD));
      bow.position.set(-0.08, 0.7, -0.54);
      bow.rotation.set(0, 0, -0.9);
      body.add(bow);
      break;
    }
    case 'bobo': {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const point = cone(0.08, 0.2, k % 2 ? trim : outfit);
        point.position.set(Math.cos(a) * 0.32, 0.88, Math.sin(a) * 0.32);
        point.rotation.set(Math.sin(a) * 2.3, 0, -Math.cos(a) * 2.3);
        body.add(point);
      }
      const capBand = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 5, 16), gold);
      capBand.rotation.x = Math.PI / 2;
      capBand.position.y = 0.26;
      capBand.scale.set(1, 0.95, 1);
      head.add(capBand);
      const cap = new THREE.Mesh(DOME, outfit);
      cap.scale.set(0.48, 0.3, 0.46);
      cap.position.y = 0.26;
      head.add(cap);
      [-1, 0, 1].forEach((s, k) => {
        const g = new THREE.Group();
        g.position.set(s * 0.2, 0.46, s === 0 ? -0.06 : 0);
        g.rotation.z = -s * 0.9;
        g.rotation.x = s === 0 ? -0.55 : 0;
        const horn = cone(0.1, 0.5, k % 2 ? trim : outfit);
        horn.position.y = 0.25;
        g.add(horn);
        const bell = ball(0.065, gold);
        bell.position.y = 0.52;
        g.add(bell);
        head.add(g);
        ears.push(g);
      });
      break;
    }
    case 'viking': {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.1, 5, 14), trim);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.88;
      body.add(collar);
      for (const s of [-1, 1]) {
        const pelt = ball(0.18, trim, 1.1, 0.75, 1);
        pelt.position.set(s * 0.4, 0.82, 0);
        body.add(pelt);
      }
      const helm = new THREE.Mesh(DOME, metal);
      helm.scale.set(0.52, 0.4, 0.5);
      helm.position.y = 0.17;
      helm.castShadow = true;
      head.add(helm);
      const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 5, 18), darkMetal);
      band.scale.set(0.52, 0.5, 0.52);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.18;
      head.add(band);
      for (const s of [-1, 1]) {
        const horn = cone(0.08, 0.4, paint('#e8dcc0'));
        horn.position.set(s * 0.52, 0.4, 0);
        horn.rotation.z = -s * 0.95;
        head.add(horn);
      }
      const handle = cyl(0.035, 1.0, paint(WOOD));
      handle.position.set(0.05, 0.62, -0.5);
      handle.rotation.z = 0.6;
      body.add(handle);
      const blade = box(0.3, 0.28, 0.04, metal);
      blade.position.set(-0.22, 0.98, -0.51);
      blade.rotation.z = 0.6;
      body.add(blade);
      break;
    }
    case 'frade': {
      const hoodBack = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 5, 12), outfit);
      hoodBack.rotation.x = Math.PI / 2 - 0.35;
      hoodBack.position.set(0, 0.92, -0.12);
      body.add(hoodBack);
      const rope = cyl(0.03, 0.42, paint('#d8c08a'));
      rope.position.set(0.2, 0.25, 0.5);
      body.add(rope);
      const crossV = box(0.05, 0.2, 0.04, paint(WOOD));
      crossV.position.set(0, 0.66, 0.47);
      crossV.rotation.x = -0.25;
      const crossH = box(0.14, 0.05, 0.04, paint(WOOD));
      crossH.position.set(0, 0.7, 0.46);
      crossH.rotation.x = -0.25;
      body.add(crossV, crossH);
      break;
    }
  }

  return { root, body, head, arms, feet, ears, def, phase: Math.random() * Math.PI * 2 };
}

function addSmile(head: THREE.Group, mat: THREE.Material, y = -0.12, z = 0.45, scale = 1): void {
  const smile = new THREE.Mesh(SMILE, mat);
  smile.scale.setScalar(scale);
  smile.position.set(0, y, z);
  smile.rotation.z = Math.PI;
  head.add(smile);
}

export interface CritterPose {
  /** Velocidade no plano (m/s), para a animação de andar. */
  speed: number;
  /** Está no meio de um empurrão. */
  punching: boolean;
  /** Está atordoado. */
  stunned: boolean;
  /** Está caindo (fora da arena). */
  falling: boolean;
  /** Acenando (tela inicial). */
  waving?: boolean;
  /** Pulando de alegria (pódio, vitória). */
  celebrate?: boolean;
  /** Cabisbaixo (último lugar). */
  sad?: boolean;
}

/** Anima o boneco a partir do estado atual. Chame uma vez por quadro. */
export function animateCritter(c: Critter, t: number, pose: CritterPose): void {
  const ph = t + c.phase;
  const walking = pose.speed > 0.4 && !pose.falling;
  c.body.position.y = 0;
  c.body.rotation.set(0, 0, 0);
  c.root.rotation.x = 0;
  c.root.rotation.z = 0;

  if (walking) {
    const k = Math.min(1, pose.speed / 5);
    const w = t * 14;
    c.body.position.y = Math.abs(Math.sin(w)) * 0.12 * k;
    c.body.rotation.z = Math.sin(w) * 0.07 * k;
    c.body.scale.set(1, 1, 1);
    c.arms[0].rotation.set(Math.sin(w) * 0.9 * k, 0, -0.35);
    c.arms[1].rotation.set(-Math.sin(w) * 0.9 * k, 0, 0.35);
    c.feet[0].position.z = 0.07 + Math.sin(w) * 0.13 * k;
    c.feet[1].position.z = 0.07 - Math.sin(w) * 0.13 * k;
  } else {
    const b = Math.sin(ph * 2.4) * 0.025;
    c.body.scale.set(1 - b * 0.5, 1 + b, 1 - b * 0.5);
    c.arms[0].rotation.set(Math.sin(ph * 2.4) * 0.1, 0, -0.35);
    c.arms[1].rotation.set(Math.sin(ph * 2.4 + 1) * 0.1, 0, 0.35);
    c.feet[0].position.z = 0.07;
    c.feet[1].position.z = 0.07;
  }

  if (pose.waving) {
    c.arms[1].rotation.set(0, 0, 2.5 + Math.sin(t * 8) * 0.35);
  }
  if (pose.celebrate) {
    const hop = Math.abs(Math.sin(ph * 5));
    c.body.position.y = hop * 0.35;
    c.arms[0].rotation.set(0, 0, -2.6 + Math.sin(ph * 10) * 0.25);
    c.arms[1].rotation.set(0, 0, 2.6 - Math.sin(ph * 10) * 0.25);
  }
  if (pose.sad) {
    c.head.rotation.x = 0.35;
    c.arms[0].rotation.set(0.2, 0, -0.15);
    c.arms[1].rotation.set(0.2, 0, 0.15);
    c.body.scale.set(1.03, 0.95, 1.03);
  } else {
    c.head.rotation.x = 0;
  }
  if (pose.punching) {
    c.arms[0].rotation.set(-1.5, 0, -0.2);
    c.arms[1].rotation.set(-1.5, 0, 0.2);
    c.body.rotation.x = 0.25;
  }
  if (pose.stunned) {
    c.root.rotation.z = Math.sin(t * 28) * 0.14;
    c.head.rotation.y = Math.sin(t * 9) * 0.5;
  } else {
    c.head.rotation.y *= 0.85;
  }
  if (pose.falling) {
    c.arms[0].rotation.set(0, 0, -2.6 + Math.sin(t * 20) * 0.3);
    c.arms[1].rotation.set(0, 0, 2.6 - Math.sin(t * 20) * 0.3);
    c.root.rotation.x = Math.sin(t * 6) * 0.4;
  }
  c.head.rotation.z = Math.sin(ph * 1.7) * 0.05;

  // o que balança: orelhas da coelha, pluma do cavaleiro, chapéu do bobo
  if (c.def.kind === 'coelho') {
    c.ears.forEach((e, i) => { e.rotation.z = (e.userData.base ?? 0) + Math.sin(ph * 3 + i * 0.6) * 0.07; });
  } else if (c.def.role === 'bobo') {
    c.ears.forEach((e, i) => { e.rotation.y = Math.sin(ph * 3 + i) * 0.25; });
  } else if (c.def.role === 'cavaleiro' && c.ears[0]) {
    c.ears[0].rotation.z = Math.sin(ph * 2.5) * 0.12;
  }
}
