import * as THREE from 'three';

/**
 * One direction of a tilt-shift blur. A band around the middle of the screen stays fully sharp,
 * then the blur fades in smoothly toward the top and bottom edges (9-tap gaussian).
 * Run it twice: once with a horizontal `delta`, once with a vertical one.
 */
export function createTiltShiftShader() {
  return {
    name: 'TiltShiftShader',
    uniforms: {
      tDiffuse: { value: null as THREE.Texture | null },
      /** Step between samples at full blur, in UV units. */
      delta: { value: new THREE.Vector2(1 / 512, 0) },
      /** Vertical center of the sharp band (0 bottom, 1 top). */
      focus: { value: 0.5 },
      /** Half height of the sharp band. */
      band: { value: 0.16 },
      /** Distance over which the blur fades in after the band. */
      ramp: { value: 0.24 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 delta;
      uniform float focus;
      uniform float band;
      uniform float ramp;
      varying vec2 vUv;
      void main() {
        float amount = smoothstep(band, band + ramp, abs(vUv.y - focus));
        vec2 o = delta * amount;
        vec4 sum = texture2D(tDiffuse, vUv) * 0.1633;
        sum += (texture2D(tDiffuse, vUv - o) + texture2D(tDiffuse, vUv + o)) * 0.1531;
        sum += (texture2D(tDiffuse, vUv - 2.0 * o) + texture2D(tDiffuse, vUv + 2.0 * o)) * 0.12245;
        sum += (texture2D(tDiffuse, vUv - 3.0 * o) + texture2D(tDiffuse, vUv + 3.0 * o)) * 0.0918;
        sum += (texture2D(tDiffuse, vUv - 4.0 * o) + texture2D(tDiffuse, vUv + 4.0 * o)) * 0.051;
        gl_FragColor = sum;
      }`,
  };
}
