import * as THREE from 'three';

/** Céu de uma tela: degradê de três cores, sol com brilho e luz do ambiente. */
export interface Sky {
  name: string;
  top: string;
  horizon: string;
  /** Cor de baixo (o "chão" que o mapa de ambiente reflete). */
  bottom: string;
  sun: string;
  sunDir: [number, number, number];
  sunIntensity: number;
  /** Luz que vem do céu e do chão (hemisfério). */
  hemi: number;
  /** Força do reflexo do céu nos materiais. */
  env: number;
  fogNear: number;
  fogFar: number;
}

const base = { sunDir: [0.45, 0.75, 0.5] as [number, number, number], sunIntensity: 2.6, hemi: 0.9, env: 0.55, fogNear: 45, fogFar: 140 };

export const SKIES = {
  dia: { ...base, name: 'dia', top: '#4f7fb4', horizon: '#f0d9ae', bottom: '#8a7a5c', sun: '#fff0d4' },
  tarde: { ...base, name: 'tarde', top: '#5a6f9c', horizon: '#f2bf86', bottom: '#7a5f48', sun: '#ffd9a8', sunDir: [0.55, 0.45, 0.45] },
  crepusculo: {
    ...base, name: 'crepusculo', top: '#2c2c52', horizon: '#e0955e', bottom: '#4a3a33', sun: '#ffd0a0',
    sunDir: [0.5, 0.45, 0.6], sunIntensity: 2.7, hemi: 1.15, env: 0.65, fogNear: 30, fogFar: 95,
  },
  gelo: { ...base, name: 'gelo', top: '#6d9cc8', horizon: '#e6eef2', bottom: '#8fa3b0', sun: '#f4f8ff', sunIntensity: 2.4, env: 0.7 },
  vulcao: {
    ...base, name: 'vulcao', top: '#2a1f30', horizon: '#b4522c', bottom: '#5a1c0c', sun: '#ffe0c0',
    sunDir: [0.4, 0.7, 0.55], sunIntensity: 2.5, hemi: 0.95, env: 0.55, fogNear: 35, fogFar: 110,
  },
  brasa: { ...base, name: 'brasa', top: '#3d3550', horizon: '#e39a5c', bottom: '#5c4033', sun: '#ffcf94', sunDir: [0.5, 0.5, 0.5], sunIntensity: 2.4 },
} satisfies Record<string, Sky>;

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSun;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0
    ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.62, h), 0.8))
    : mix(uHorizon, uBottom, smoothstep(0.0, 0.18, -h));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSun * (pow(s, 6.0) * 0.28 + pow(s, 90.0) * 1.6);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Cúpula do céu (sempre atrás de tudo, sem neblina). */
export function skyDome(sky: Sky): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTop: { value: new THREE.Color(sky.top) },
      uHorizon: { value: new THREE.Color(sky.horizon) },
      uBottom: { value: new THREE.Color(sky.bottom) },
      uSun: { value: new THREE.Color(sky.sun) },
      uSunDir: { value: new THREE.Vector3(...sky.sunDir) },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.userData.noCast = true;
  dome.name = 'sky';
  return dome;
}
