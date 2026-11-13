import * as THREE from 'three';
import type { SeasonId } from '../data/calendar';
import { SEASON_PALETTES } from '../data/seasonPalettes';
import type { WeatherId } from '../data/weather';
import { dotTexture, rainbowTexture, seededRandom } from './textures';

const AREA = 24;
const RAIN_DROPS = 900;
const STORM_DROPS = 900;
/** Rainbow size and where it sits in the view: distance ahead of the camera and drop below the view center. */
const RAINBOW = { radius: 80, tube: 4.5, distance: 170, drop: 40 } as const;
const _forward = new THREE.Vector3();
const _up = new THREE.Vector3();

export interface WeatherFxFrame {
  /** The rainbow is placed in the far background of this camera's view. */
  camera: THREE.Camera;
  /** 0 = day, 1 = night. */
  night: number;
  cameraYaw: number;
  cloudColor: THREE.Color;
  /** "Chuva, neve e pétalas" setting. */
  particles: boolean;
  reducedMotion: boolean;
}

function points(count: number, material: THREE.PointsMaterial, fill: (a: Float32Array, i: number) => void): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) fill(positions, i);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const p = new THREE.Points(geometry, material);
  p.frustumCulled = false;
  return p;
}

/**
 * Weather and sky effects: rain, storms with lightning, snow, spring petals and autumn leaves,
 * a rainbow, drifting clouds, stars and fireflies. Purely visual (Math.random is fine here).
 */
export class WeatherFx {
  readonly root = new THREE.Group();
  private weather: WeatherId = 'sun';
  private season: SeasonId = 'spring';
  private readonly rain: THREE.LineSegments;
  private readonly rainPositions: Float32Array;
  private readonly snow: THREE.Points;
  private readonly drift: THREE.Points;
  private readonly fireflies: THREE.Points;
  private readonly fireflyBase: number[][] = [];
  private readonly stars: THREE.Points;
  private readonly rainbow: THREE.Mesh;
  private readonly clouds: { group: THREE.Group; material: THREE.MeshLambertMaterial; angle: number; radius: number; y: number; speed: number }[] = [];
  private flashLevel = 0;
  private nextFlash = 3;

  constructor() {
    this.root.name = 'weather';
    const rnd = seededRandom(61);
    const dot = dotTexture();

    const drops = RAIN_DROPS + STORM_DROPS;
    this.rainPositions = new Float32Array(drops * 6);
    for (let i = 0; i < drops; i++) {
      const x = (rnd() * 2 - 1) * AREA, y = rnd() * 24, z = (rnd() * 2 - 1) * AREA;
      this.rainPositions.set([x + 0.12, y + 0.7, z, x, y, z], i * 6);
    }
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: 0xd6e8f7, transparent: true, opacity: 0.55 }));
    this.rain.frustumCulled = false;

    this.snow = points(1000, new THREE.PointsMaterial({ color: 0xffffff, size: 0.24, map: dot, transparent: true, depthWrite: false }), (a, i) => {
      a.set([(rnd() * 2 - 1) * AREA, rnd() * 24, (rnd() * 2 - 1) * AREA], i * 3);
    });
    this.drift = points(160, new THREE.PointsMaterial({ color: 0xf7a8c4, size: 0.32, map: dot, transparent: true, depthWrite: false }), (a, i) => {
      a.set([(rnd() * 2 - 1) * 20, 2 + rnd() * 12, (rnd() * 2 - 1) * 16], i * 3);
    });
    this.fireflies = points(60, new THREE.PointsMaterial({ color: 0xefff8a, size: 0.45, map: dot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), (a, i) => {
      const p = [-15 + rnd() * 30, 2 + rnd() * 2.2, -5 + rnd() * 18];
      a.set(p, i * 3);
      this.fireflyBase.push([...p, rnd() * 6]);
    });
    this.stars = points(500, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }), (a, i) => {
      const th = rnd() * Math.PI * 2, ph = rnd() * 1.2;
      a.set([Math.cos(th) * Math.sin(ph) * 220, Math.cos(ph) * 220 + 10, Math.sin(th) * Math.sin(ph) * 220], i * 3);
    });

    // Rainbow: a half ring kept in the far background of the view. The diorama camera looks down,
    // so a rainbow fixed in the sky would never be seen; the island still hides the parts behind it.
    this.rainbow = new THREE.Mesh(
      new THREE.TorusGeometry(RAINBOW.radius, RAINBOW.tube, 8, 64, Math.PI),
      // Drawn right after the sea and before the island (render order), added on top of the water.
      new THREE.MeshBasicMaterial({ map: rainbowTexture(), blending: THREE.AdditiveBlending, opacity: 0, depthTest: false, depthWrite: false, fog: false }),
    );
    this.rainbow.renderOrder = -0.7;
    this.rainbow.frustumCulled = false;
    this.rainbow.visible = false;

    const puff = new THREE.SphereGeometry(1, 14, 10);
    for (let i = 0; i < 6; i++) {
      const group = new THREE.Group(), material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.96 });
      const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(puff, material);
        m.position.set((k - n / 2) * 1.2, Math.sin(k * 1.7) * 0.3, Math.cos(k * 2.1) * 0.5);
        m.scale.set(1.1 + (k % 2) * 0.4, 0.7, 1);
        group.add(m);
      }
      group.scale.setScalar(1.4 + rnd() * 0.6);
      this.clouds.push({ group, material, angle: i * 1.05 + rnd(), radius: 30 + rnd() * 10, y: 7 + rnd() * 2.5, speed: 0.012 + rnd() * 0.015 });
      this.root.add(group);
    }
    this.root.add(this.rain, this.snow, this.drift, this.fireflies, this.stars, this.rainbow);
  }

  setWeather(weather: WeatherId): void {
    this.weather = weather;
  }

  setSeason(season: SeasonId): void {
    this.season = season;
    const drift = SEASON_PALETTES[season].drift;
    if (drift !== null) (this.drift.material as THREE.PointsMaterial).color.setHex(drift);
  }

  /** Lightning brightness for this frame (0 to 1). */
  get flash(): number {
    return this.flashLevel;
  }

  update(dt: number, elapsed: number, f: WeatherFxFrame): void {
    const w = this.weather;
    const wet = w === 'rain' || w === 'storm';
    const drops = w === 'storm' ? RAIN_DROPS + STORM_DROPS : RAIN_DROPS;

    this.rain.visible = f.particles && wet;
    if (this.rain.visible) {
      const a = this.rainPositions, speed = w === 'storm' ? 34 : 26;
      for (let i = 0; i < drops; i++) {
        const o = i * 6;
        let y = a[o + 4]! - speed * dt;
        if (y < 0.4) y += 24;
        a[o + 1] = y + 0.7;
        a[o + 4] = y;
        a[o] = a[o + 3]! + (w === 'storm' ? 0.35 : 0.12);
      }
      this.rain.geometry.setDrawRange(0, drops * 2);
      this.rain.geometry.attributes.position!.needsUpdate = true;
    }

    this.snow.visible = f.particles && w === 'snow';
    if (this.snow.visible) {
      const a = this.snow.geometry.attributes.position!.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) {
        a[i + 1]! -= 1.7 * dt;
        a[i]! += Math.sin(elapsed + i) * 0.25 * dt;
        if (a[i + 1]! < 0.5) a[i + 1]! += 24;
      }
      this.snow.geometry.attributes.position!.needsUpdate = true;
    }

    const driftColor = SEASON_PALETTES[this.season].drift;
    this.drift.visible = f.particles && (w === 'sun' || w === 'rainbow') && driftColor !== null && f.night < 0.5;
    if (this.drift.visible) {
      const a = this.drift.geometry.attributes.position!.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) {
        a[i]! += (0.7 + Math.sin(elapsed + i) * 0.3) * dt;
        a[i + 1]! -= 0.55 * dt;
        a[i + 2]! += Math.cos(elapsed * 0.7 + i) * 0.2 * dt;
        if (a[i + 1]! < 1.5 || a[i]! > 20) {
          a[i] = -20 + Math.random() * 6;
          a[i + 1] = 5 + Math.random() * 9;
        }
      }
      this.drift.geometry.attributes.position!.needsUpdate = true;
    }

    const fireflyMaterial = this.fireflies.material as THREE.PointsMaterial;
    fireflyMaterial.opacity = this.season === 'winter' || wet || w === 'snow' ? 0 : f.night * 0.95;
    this.fireflies.visible = fireflyMaterial.opacity > 0.01;
    if (this.fireflies.visible && !f.reducedMotion) {
      const a = this.fireflies.geometry.attributes.position!.array as Float32Array;
      this.fireflyBase.forEach((b, i) => {
        a[i * 3] = b[0]! + Math.sin(elapsed * 0.6 + b[3]!) * 0.6;
        a[i * 3 + 1] = b[1]! + Math.sin(elapsed * 1.3 + b[3]!) * 0.3;
        a[i * 3 + 2] = b[2]! + Math.cos(elapsed * 0.5 + b[3]!) * 0.6;
      });
      this.fireflies.geometry.attributes.position!.needsUpdate = true;
    }

    (this.stars.material as THREE.PointsMaterial).opacity = f.night;
    this.stars.visible = f.night > 0.01;

    const rainbowMaterial = this.rainbow.material as THREE.MeshBasicMaterial;
    rainbowMaterial.opacity += ((w === 'rainbow' ? 0.65 * (1 - f.night) : 0) - rainbowMaterial.opacity) * Math.min(1, dt * 2);
    this.rainbow.visible = rainbowMaterial.opacity > 0.01;
    if (this.rainbow.visible) {
      f.camera.getWorldDirection(_forward);
      _up.set(0, 1, 0).applyQuaternion(f.camera.quaternion);
      this.rainbow.position.copy(f.camera.position).addScaledVector(_forward, RAINBOW.distance).addScaledVector(_up, -RAINBOW.drop);
      this.rainbow.quaternion.copy(f.camera.quaternion);
    }

    // Clouds drift around the island and fade out when they pass between the camera and the island.
    for (const c of this.clouds) {
      if (!f.reducedMotion) c.angle += c.speed * dt;
      c.group.position.set(Math.cos(c.angle) * c.radius, c.y, Math.sin(c.angle) * c.radius);
      let d = Math.abs(Math.atan2(c.group.position.x, c.group.position.z) - f.cameraYaw) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      c.material.opacity = Math.min(1, Math.max(0, (d - 0.8) / 0.6)) * 0.96;
      c.material.color.copy(f.cloudColor);
      c.group.visible = c.material.opacity > 0.01;
    }

    // Lightning during storms.
    this.flashLevel = Math.max(0, this.flashLevel - dt * 4);
    if (w === 'storm' && !f.reducedMotion) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.flashLevel = 1;
        this.nextFlash = 4 + Math.random() * 6;
      }
    }
  }
}
