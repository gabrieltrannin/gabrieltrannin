import * as THREE from 'three';
import { setMaxAnisotropy } from './textures';

export interface RendererOptions {
  /** Phones get a lower cap to keep the frame rate smooth. */
  maxPixelRatio?: number;
}

/** Creates the WebGL renderer with the soft-shadow, sRGB setup the art direction asks for. Throws if WebGL is missing. */
export function createRenderer(canvas: HTMLCanvasElement, opts: RendererOptions = {}): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxPixelRatio ?? 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
  return renderer;
}

/** Keeps the canvas and camera matched to the window size. */
export function fitToWindow(renderer: THREE.WebGLRenderer, onResize: (w: number, h: number) => void): () => void {
  const apply = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    onResize(w, h);
  };
  apply();
  window.addEventListener('resize', apply);
  return () => window.removeEventListener('resize', apply);
}
