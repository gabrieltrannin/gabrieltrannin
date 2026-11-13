import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { createTiltShiftShader } from './tiltShiftShader';

/** Blur step at the top and bottom edges, in screen pixels (the 9 taps spread about 4x this). */
const BLUR_PX = 2.5;

/**
 * Diorama look: a wide sharp band in the middle, blur fading in toward the top and bottom
 * (tilt-shift), and a soft vignette. OutputPass applies tone mapping and sRGB at the end.
 */
export class PostFx {
  private readonly composer: EffectComposer;
  private readonly hBlur: ShaderPass;
  private readonly vBlur: ShaderPass;

  constructor(private readonly renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, samples = 4) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.hBlur = new ShaderPass(createTiltShiftShader());
    this.vBlur = new ShaderPass(createTiltShiftShader());
    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms.offset!.value = 0.75;
    vignette.uniforms.darkness!.value = 1.0;
    this.composer.addPass(this.hBlur);
    this.composer.addPass(this.vBlur);
    this.composer.addPass(vignette);
    this.composer.addPass(new OutputPass());
  }

  setSize(width: number, height: number): void {
    const ratio = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    // Same blur in screen pixels whatever the resolution.
    (this.hBlur.uniforms.delta!.value as THREE.Vector2).set(BLUR_PX / width, 0);
    (this.vBlur.uniforms.delta!.value as THREE.Vector2).set(0, BLUR_PX / height);
  }

  /** "Desfoque nas bordas (efeito maquete)" option. */
  setTiltShift(enabled: boolean): void {
    this.hBlur.enabled = enabled;
    this.vBlur.enabled = enabled;
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}
