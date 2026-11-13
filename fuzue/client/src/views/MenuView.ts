import * as THREE from 'three';
import { animateCritter, makeCritter, type Critter } from '../engine/critter';
import { outline, toon, toonMap } from '../engine/materials';
import { addHorizon, addLights, addSea, bannerPole, cobbleTexture, flicker, pineTree, torch } from '../engine/scenery';
import type { View } from '../engine/Stage';

/** Tela inicial: o personagem escolhido acenando num pátio do castelo. */
export class MenuView implements View {
  readonly scene = new THREE.Scene();
  private critter: Critter | null = null;
  private sea: (dt: number, t: number) => void;
  private readonly spot = new THREE.Vector3(0, 0, 6.2);

  constructor(private camera: THREE.PerspectiveCamera) {
    addLights(this.scene, 12, { color: '#b98f6a', near: 25, far: 90 });
    this.sea = addSea(this.scene);
    addHorizon(this.scene);
    const cobble = cobbleTexture();
    cobble.repeat.set(6, 6);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 1, 48), [toon('#6f685e'), toonMap(cobble), toon('#6f685e')]);
    yard.position.y = -0.5;
    yard.receiveShadow = true;
    outline(yard, 1.006, 1.04);
    this.scene.add(yard);
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
    for (const [x, z] of [[-6.5, 3], [6.8, 2.5], [-5.5, -2], [5.8, -3]]) {
      const tree = pineTree(1.2);
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
    flicker(this.scene, t);
    if (this.critter) {
      this.critter.root.rotation.y = Math.sin(t * 0.6) * 0.45;
      animateCritter(this.critter, t, { speed: 0, punching: false, stunned: false, falling: false, waving: true });
    }
    const sway = Math.sin(t * 0.25) * 0.3;
    this.camera.position.set(this.spot.x + sway, 2.3, this.spot.z + 6.6);
    this.camera.lookAt(this.spot.x, 1.05, this.spot.z);
  }
}
