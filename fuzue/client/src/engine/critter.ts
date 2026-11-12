import * as THREE from 'three';
import { CHARACTERS, type CharacterDef } from '@fuzue/shared';
import { ball, outline, shared, toon, INK } from './materials';

/**
 * Bonecos montados só com primitivas (esferas e cones) + material toon.
 * A origem do grupo fica nos pés; o corpo tem ~1,65 m de altura em escala 1.
 */
export interface Critter {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  arms: THREE.Group[];
  feet: THREE.Mesh[];
  ears: THREE.Object3D[];
  def: CharacterDef;
  phase: number;
}

const SMILE = shared(new THREE.TorusGeometry(0.07, 0.022, 6, 16, Math.PI));
const EAR_CONE = shared(new THREE.ConeGeometry(0.17, 0.36, 4));
const BEAK = shared(new THREE.ConeGeometry(0.09, 0.2, 10));

export function makeCritter(characterIndex: number): Critter {
  const def = CHARACTERS[characterIndex] ?? CHARACTERS[0];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const main = toon(def.color);
  const belly = toon(def.belly);
  const ink = toon(INK);
  const white = toon('#ffffff');
  const blush = toon('#ff7aa0');
  const ears: THREE.Object3D[] = [];

  // Na ovelha o corpo é de lã (cor clara) e a cabeça leva a cor principal.
  const torsoMat = def.kind === 'ovelha' ? belly : main;
  const torso = ball(0.48, torsoMat, 1, 0.92, 0.95);
  torso.position.y = 0.52;
  torso.castShadow = true;
  outline(torso);
  body.add(torso);

  if (def.kind === 'pinguim') {
    const tummy = ball(0.36, belly, 1, 1.1, 0.6);
    tummy.position.set(0, 0.48, 0.2);
    body.add(tummy);
  } else if (def.kind === 'ovelha') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const puff = ball(0.17, belly);
      puff.position.set(Math.cos(a) * 0.42, 0.55 + (i % 2) * 0.16, Math.sin(a) * 0.4);
      body.add(puff);
    }
  } else {
    const tummy = ball(0.3, belly, 1, 1.05, 0.5);
    tummy.position.set(0, 0.47, 0.29);
    body.add(tummy);
  }

  const head = new THREE.Group();
  head.position.y = 1.14;
  body.add(head);
  const skull = ball(0.47, main, 1.06, 0.95, 1);
  skull.castShadow = true;
  outline(skull);
  head.add(skull);

  if (def.kind === 'pinguim') {
    const mask = ball(0.34, belly, 1.15, 0.9, 0.55);
    mask.position.set(0, -0.04, 0.24);
    head.add(mask);
  }

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
    const cheek = ball(0.075, blush, 1, 0.6, 0.4);
    cheek.position.set(s * 0.31, -0.1, 0.35);
    head.add(cheek);
  }

  switch (def.kind) {
    case 'urso': {
      const muzzle = ball(0.16, belly, 1.2, 0.85, 0.7);
      muzzle.position.set(0, -0.1, 0.4);
      head.add(muzzle);
      const nose = ball(0.05, ink, 1.2, 0.9, 0.8);
      nose.position.set(0, -0.05, 0.51);
      head.add(nose);
      addSmile(head, ink, -0.15, 0.5, 0.8);
      for (const s of [-1, 1]) {
        const ear = ball(0.16, main, 1, 1, 0.7);
        ear.position.set(s * 0.34, 0.34, -0.02);
        outline(ear);
        head.add(ear);
        ears.push(ear);
        const inner = ball(0.085, belly, 1, 1, 0.5);
        inner.position.set(s * 0.34, 0.34, 0.08);
        head.add(inner);
      }
      break;
    }
    case 'coelho': {
      addSmile(head, ink);
      for (const s of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(s * 0.17, 0.36, -0.04);
        g.rotation.z = -s * 0.18;
        const ear = ball(0.12, main, 0.95, 2.9, 0.7);
        ear.position.y = 0.3;
        outline(ear);
        g.add(ear);
        const inner = ball(0.06, blush, 0.9, 2.5, 0.5);
        inner.position.set(0, 0.3, 0.06);
        g.add(inner);
        head.add(g);
        ears.push(g);
      }
      const tail = ball(0.13, belly);
      tail.position.set(0, 0.35, -0.47);
      body.add(tail);
      break;
    }
    case 'gato': {
      addSmile(head, ink);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(EAR_CONE, main);
        ear.position.set(s * 0.28, 0.43, 0);
        ear.rotation.set(0, Math.PI / 4, -s * 0.38);
        outline(ear, 1.12);
        head.add(ear);
        ears.push(ear);
      }
      const tail = new THREE.Group();
      tail.position.set(0, 0.3, -0.42);
      body.add(tail);
      for (let k = 0; k < 5; k++) {
        const seg = ball(0.085 - k * 0.004, main);
        seg.position.set(0, k * 0.1, -Math.sin(k * 0.5) * 0.14 - k * 0.02);
        tail.add(seg);
      }
      break;
    }
    case 'axolote': {
      addSmile(head, ink);
      const frill = toon('#ff7aa8');
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const ang = (k - 1) * 0.55;
          const base = 1.15 + ang;
          const f = ball(0.075, frill, 1, 2.6, 0.7);
          f.position.set(s * (0.42 + Math.sin(base) * 0.17), 0.1 - ang * 0.25 + Math.cos(base) * 0.17, -0.05);
          f.rotation.z = -s * base;
          outline(f, 1.14);
          head.add(f);
          ears.push(f);
        }
      }
      break;
    }
    case 'pinguim': {
      const beak = new THREE.Mesh(BEAK, toon('#ffb13c'));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, -0.08, 0.52);
      outline(beak, 1.15);
      head.add(beak);
      for (let k = 0; k < 3; k++) {
        const tuft = ball(0.07, main, 1, 1.8, 1);
        tuft.position.set((k - 1) * 0.07, 0.48, 0);
        tuft.rotation.z = (1 - k) * 0.5;
        head.add(tuft);
        ears.push(tuft);
      }
      break;
    }
    case 'ovelha': {
      addSmile(head, ink);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const wool = ball(0.15, belly);
        wool.position.set(Math.cos(a) * 0.22, 0.38 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.2 - 0.05);
        head.add(wool);
      }
      for (const s of [-1, 1]) {
        const ear = ball(0.09, main, 1.9, 0.8, 0.7);
        ear.position.set(s * 0.5, 0.08, -0.02);
        ear.rotation.z = s * 0.4;
        outline(ear, 1.12);
        head.add(ear);
        ears.push(ear);
      }
      break;
    }
  }

  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.44, 0.68, 0.04);
    pivot.rotation.z = s * 0.35;
    const flat = def.kind === 'pinguim' ? 0.55 : 0.85;
    const arm = ball(0.13, main, flat, 1.35, 0.85);
    arm.position.y = -0.14;
    outline(arm, 1.1);
    pivot.add(arm);
    body.add(pivot);
    arms.push(pivot);
  }

  const footMat = def.kind === 'pinguim' ? toon('#ffb13c') : main;
  const feet: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const foot = ball(0.16, footMat, 1, 0.55, 1.35);
    foot.position.set(s * 0.21, 0.08, 0.07);
    outline(foot, 1.08);
    root.add(foot);
    feet.push(foot);
  }

  return { root, body, head, arms, feet, ears, def, phase: Math.random() * Math.PI * 2 };
}

function addSmile(head: THREE.Group, ink: THREE.Material, y = -0.12, z = 0.45, scale = 1): void {
  const smile = new THREE.Mesh(SMILE, ink);
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
    // braços para frente (rotação negativa em x leva o braço para +z)
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
  if (c.def.kind === 'coelho' && c.ears.length === 2) {
    c.ears[0].rotation.z = 0.18 + Math.sin(ph * 3) * 0.08;
    c.ears[1].rotation.z = -0.18 - Math.sin(ph * 3 + 0.6) * 0.08;
  }
}
