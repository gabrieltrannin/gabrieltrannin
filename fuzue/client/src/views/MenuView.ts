import * as THREE from 'three';
import { animateCritter, makeCritter, type Critter } from '../engine/critter';
import { paint } from '../engine/materials';
import {
  addHorizon, addMotes, addSea, bannerPole, flicker, oakTree, pineTree, scatterGrass, setupWorld, SKIES, stoneFloor, torch,
} from '../engine/scenery';
import type { View } from '../engine/Stage';

/** Tela inicial: o personagem escolhido acenando num pátio do castelo. */
export class MenuView implements View {
  readonly scene = new THREE.Scene();
  private critter: Critter | null = null;
  private sea: (dt: number, t: number) => void;
  private sky: (dt: number, t: number) => void;
  private readonly spot = new THREE.Vector3(0, 0, 6.2);

  constructor(private camera: THREE.PerspectiveCamera) {
    setupWorld(this.scene, SKIES.tarde, 12);
    this.sea = addSea(this.scene);
    this.sky = addHorizon(this.scene);
    // pátio de pedra sobre uma ilhota gramada
    const island = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 12.5, 4, 14), paint('#5f8a3c', { facet: 0.12 }));
    island.position.y = -2.05;
    this.scene.add(island);
    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(12.3, 9, 3, 14), paint('#7d7468', { facet: 0.2 }));
    cliff.position.y = -4.5;
    this.scene.add(cliff);
    this.scene.add(stoneFloor({ radius: 8.2 }, { seed: 4 }));
    scatterGrass(this.scene, 260, { radius: 11.3 }, (x, z) => Math.hypot(x, z) > 8.5, 6);
    addMotes(this.scene, 'poeira', 10, 0, 6);
    const colors = ['#8e2430', '#2f5a8f', '#c9a227'];
    [-3, 0, 3].forEach((x, i) => {
      const b = bannerPole(colors[i], 3.4);
      b.position.set(x, 0, 2.2);
      this.scene.add(b);
    });
    for (const x of [-2.2, 2.2]) {
      const t = torch();
      t.position.set(x, 0, 4.6);
      this.scene.add(t);
    }
    for (const [x, z, k] of [[-9.6, 3, 0], [9.8, 2.5, 1], [-8.8, -3, 1], [9, -4, 0], [-4.5, -9, 0], [5, -9.4, 1], [0.5, -10.2, 0]]) {
      const tree = k ? oakTree(1.3) : pineTree(1.4);
      tree.position.set(x, 0, z);
      this.scene.add(tree);
    }
  }

  setCharacter(i: number): void {
    if (this.critter) this.scene.remove(this.critter.root);
    this.critter = makeCritter(i);
    this.critter.root.position.copy(this.spot);
    this.scene.add(this.critter.root);
  }

  viewOffset(w: number, h: number): { x: number; y: number } {
    return w >= 820 ? { x: -w * 0.2, y: 0 } : { x: 0, y: h * 0.25 };
  }

  update(dt: number, t: number): void {
    this.sea(dt, t);
    this.sky(dt, t);
    flicker(this.scene, t);
    if (this.critter) {
      this.critter.root.rotation.y = Math.sin(t * 0.6) * 0.45;
      animateCritter(this.critter, t, { speed: 0, punching: false, stunned: false, falling: false, waving: true });
    }
    const sway = Math.sin(t * 0.25) * 0.3;
    const far = this.camera.aspect < 0.9 ? 1.45 : 1;
    this.camera.position.set(this.spot.x + sway, 2.3 * far, this.spot.z + 6.6 * far);
    this.camera.lookAt(this.spot.x, 1.05, this.spot.z);
  }
}
