import * as THREE from 'three';
import type { WeatherId } from '../data/weather';
import { lampMaterials } from './materials';
import { createSample, sampleLight, type LightSample } from './timeOfDay';

/** Where the warm point lights sit at night (farm crossing, market square, house door). */
const NIGHT_LIGHTS: readonly [number, number, number][] = [[-3, 3.6, 0.5], [10.3, 4.2, 3], [-12.4, 3.4, -1.2]];

function skyDome(): { mesh: THREE.Mesh; top: THREE.Color; horizon: THREE.Color } {
  const top = new THREE.Color(), horizon = new THREE.Color();
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
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return { mesh, top, horizon };
}

/**
 * Lighting for the time of day and the weather: sky, fog, sun and fill light, sea tint,
 * lamps that glow at night and a few warm point lights. Changes blend in smoothly.
 */
export class Atmosphere {
  readonly hemi = new THREE.HemisphereLight();
  readonly sun = new THREE.DirectionalLight();
  private readonly sky = skyDome();
  private readonly pointLights: THREE.PointLight[];
  private readonly target = createSample();
  private readonly current = createSample();
  private minute = 13 * 60;
  private weather: WeatherId = 'sun';
  private first = true;

  constructor(private readonly scene: THREE.Scene, shadowMapSize = 2048) {
    scene.add(this.sky.mesh, this.hemi, this.sun, this.sun.target);
    scene.background = new THREE.Color();
    scene.fog = new THREE.Fog(0xffffff, 90, 260);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    Object.assign(this.sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 130 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.sun.target.position.set(0, 0, 3);
    this.pointLights = NIGHT_LIGHTS.map(([x, y, z]) => {
      const light = new THREE.PointLight(0xffc27a, 0, 12, 1.6);
      light.position.set(x, y, z);
      scene.add(light);
      return light;
    });
  }

  setTime(minuteOfDay: number): void {
    this.minute = minuteOfDay;
  }

  setWeather(weather: WeatherId): void {
    this.weather = weather;
  }

  setShadows(enabled: boolean): void {
    this.sun.castShadow = enabled;
  }

  /** Night amount after weather (0 day, 1 night): drives stars and fireflies. */
  get night(): number {
    return this.current.night;
  }

  get cloudColor(): THREE.Color {
    return this.current.cloud;
  }

  get waterTint(): THREE.Color {
    return this.current.water;
  }

  /** `flash` brightens everything for a lightning strike (0 to 1). */
  update(dt: number, flash = 0): LightSample {
    sampleLight(this.minute, this.weather, this.target);
    const c = this.current, t = this.target;
    const k = this.first ? 1 : 1 - Math.exp(-dt * 2.6);
    this.first = false;
    for (const key of ['skyTop', 'skyHorizon', 'hemiSky', 'hemiGround', 'sunColor', 'water', 'cloud'] as const) c[key].lerp(t[key], k);
    for (const key of ['hemiIntensity', 'sunIntensity', 'lamps', 'night'] as const) c[key] += (t[key] - c[key]) * k;
    c.sunDir.lerp(t.sunDir, k).normalize();

    this.sky.top.copy(c.skyTop);
    this.sky.horizon.copy(c.skyHorizon);
    (this.scene.background as THREE.Color).copy(c.skyHorizon);
    (this.scene.fog as THREE.Fog).color.copy(c.skyHorizon);
    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);
    this.hemi.intensity = c.hemiIntensity + flash * 2.5;
    this.sun.color.copy(c.sunColor);
    this.sun.intensity = c.sunIntensity;
    this.sun.position.copy(this.sun.target.position).addScaledVector(c.sunDir, 50);
    for (const [material, strength] of lampMaterials()) material.emissiveIntensity = 0.12 + c.lamps * strength;
    for (const light of this.pointLights) light.intensity = c.lamps * 9;
    return c;
  }

  /** Keeps the fog behind the island however far the camera is. */
  /** Centers the sun's shadow area on the part of the world being shown (the main island or the village). */
  setFocus(x: number, z: number): void {
    this.sun.target.position.set(x, 0, z);
  }

  setViewDistance(distance: number): void {
    const fog = this.scene.fog as THREE.Fog;
    fog.near = distance + 25;
    fog.far = distance + 150;
  }
}
