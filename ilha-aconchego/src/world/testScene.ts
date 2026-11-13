import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { cliffTexture, grassTexture, rippleTexture, sandTexture, seaGradientTexture } from '../render/textures';

/** Size of the flat test island (the real map arrives in stage 1). */
export const TEST_ISLAND = { width: 40, depth: 32, top: 1.4 };

export interface TestScene {
  update(dt: number, elapsed: number): void;
}

/** Rounded rectangle in the XZ plane, written as a Shape (shape y = -world z). */
function roundedRect(width: number, depth: number, radius: number): THREE.Shape {
  const x0 = -width / 2, x1 = width / 2, y0 = -depth / 2, y1 = depth / 2, r = radius;
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

/** Extrudes a shape upward from y0 to y0 + height. Group 0 = top/bottom caps, group 1 = side walls. */
function slab(shape: THREE.Shape, y0: number, height: number, materials: THREE.Material[]): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  const m = new THREE.Mesh(g, materials);
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}

function skyDome(top: THREE.Color, horizon: THREE.Color): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: top }, horizon: { value: horizon } },
    vertexShader: /* glsl */ `
      varying float vHeight;
      void main() {
        vHeight = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      varying float vHeight;
      void main() {
        gl_FragColor = vec4(mix(horizon, top, smoothstep(-0.05, 0.6, vHeight)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), material);
  dome.renderOrder = -1;
  return dome;
}

/**
 * Stage 0 test scene: sky, sea and a flat island, plus two registry assets to prove the
 * asset pipeline works. Static afternoon light; time of day and seasons arrive in stage 1.
 */
export function buildTestScene(scene: THREE.Scene, assets: AssetRegistry): TestScene {
  const horizon = new THREE.Color('#CDEBF5');
  scene.add(skyDome(new THREE.Color('#7FC6EC'), horizon));
  scene.background = horizon;
  scene.fog = new THREE.Fog(horizon, 110, 300);

  // Light: warm sun with soft shadows plus sky/ground fill.
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x7f9a6a, 1.7));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.0);
  sun.position.set(-18, 34, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 120 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // Sea: one gradient texture over the whole plane, plus a scrolling ripple layer.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshPhongMaterial({ map: seaGradientTexture(), shininess: 90, specular: 0x335566 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0.12;
  sea.receiveShadow = true;
  const ripples = rippleTexture();
  ripples.repeat.set(60, 60);
  const rippleLayer = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ map: ripples, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  rippleLayer.rotation.x = -Math.PI / 2;
  rippleLayer.position.y = 0.14;
  scene.add(sea, rippleLayer);

  // Flat island: sand base and a grass slab with cliff walls. Cap UVs are world units.
  const sand = sandTexture();
  sand.repeat.set(0.22, 0.22);
  const grass = grassTexture();
  grass.repeat.set(0.25, 0.25);
  const cliffHeight = TEST_ISLAND.top - 0.35;
  const cliff = cliffTexture();
  cliff.repeat.set(1 / 4, 1 / cliffHeight);
  cliff.offset.set(0, -(1 - cliffHeight) / cliffHeight);
  scene.add(
    slab(roundedRect(TEST_ISLAND.width + 5, TEST_ISLAND.depth + 5, 4.5), -1.2, 1.55, [
      new THREE.MeshLambertMaterial({ map: sand }),
      new THREE.MeshLambertMaterial({ color: 0xd9c08a }),
    ]),
    slab(roundedRect(TEST_ISLAND.width, TEST_ISLAND.depth, 2.5), 0.35, cliffHeight, [
      new THREE.MeshLambertMaterial({ map: grass }),
      new THREE.MeshLambertMaterial({ map: cliff }),
    ]),
  );

  // Registry check: a few peach trees and a short log fence.
  for (const [x, z, s] of [[-8, -6, 1], [-4, -8, 0.9], [6, -5, 1.05], [10, 4, 0.85]] as const) {
    const tree = assets.create('tree.peach');
    tree.position.set(x, TEST_ISLAND.top, z);
    tree.scale.setScalar(s);
    scene.add(tree);
  }
  for (let i = 0; i < 14; i++) {
    const post = assets.create('fence.log');
    post.position.set(-6 + i * 0.4, TEST_ISLAND.top, 3);
    scene.add(post);
  }

  return {
    update(_dt, elapsed) {
      ripples.offset.set(elapsed * 0.012, elapsed * 0.006);
    },
  };
}
