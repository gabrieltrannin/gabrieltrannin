import * as THREE from 'three';
import { RING } from '@fuzue/shared';
import { animateCritter, makeCritter, type Critter } from '../engine/critter';
import { canvasTexture, outline, stripeTexture, toon, toonMap } from '../engine/materials';
import { addHorizon, addLights, addSea } from '../engine/scenery';
import type { View } from '../engine/Stage';

/** Tela inicial: o personagem escolhido acenando na beira do ringue. */
export class MenuView implements View {
  readonly scene = new THREE.Scene();
  private critter: Critter | null = null;
  private sea: (dt: number, t: number) => void;
  private readonly spot = new THREE.Vector3(0, 0, 6.2);

  constructor(private camera: THREE.PerspectiveCamera) {
    addLights(this.scene, 12);
    this.sea = addSea(this.scene);
    addHorizon(this.scene);
    const R = RING.startRadius;
    const ringTex = canvasTexture(512, 512, (g, w) => {
      g.fillStyle = '#d4f1ff';
      g.fillRect(0, 0, w, w);
      for (let i = 8; i > 0; i--) {
        g.beginPath();
        g.arc(w / 2, w / 2, i * 30, 0, Math.PI * 2);
        g.fillStyle = i % 2 ? '#c2eaff' : '#e4f7ff';
        g.fill();
      }
    });
    const side = stripeTexture('#ffffff', '#ff5fa2');
    side.repeat.set(12, 1);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1, 72), [toonMap(side), toonMap(ringTex), toon('#9fd8f5')]);
    platform.position.y = -0.5;
    platform.receiveShadow = true;
    outline(platform, 1.006, 1.04);
    this.scene.add(platform);
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
    if (this.critter) {
      this.critter.root.rotation.y = Math.sin(t * 0.6) * 0.45;
      animateCritter(this.critter, t, { speed: 0, punching: false, stunned: false, falling: false, waving: true });
    }
    const sway = Math.sin(t * 0.25) * 0.3;
    this.camera.position.set(this.spot.x + sway, 2.1, this.spot.z + 6.4);
    this.camera.lookAt(this.spot.x, 0.95, this.spot.z);
  }
}
