import * as THREE from 'three';
import { LIGHT_KEYS, WEATHER_LIGHT, type LightKey } from '../data/timeOfDay';
import type { WeatherId } from '../data/weather';

/** Light values for one moment of the day, after the weather is applied. */
export interface LightSample {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  sunColor: THREE.Color;
  sunIntensity: number;
  sunDir: THREE.Vector3;
  lamps: number;
  night: number;
  water: THREE.Color;
  /** Cloud color (white on clear days, grey in rain). */
  cloud: THREE.Color;
}

export function createSample(): LightSample {
  return {
    skyTop: new THREE.Color(), skyHorizon: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(),
    hemiIntensity: 0, sunColor: new THREE.Color(), sunIntensity: 0, sunDir: new THREE.Vector3(0, 1, 0),
    lamps: 0, night: 0, water: new THREE.Color(), cloud: new THREE.Color(),
  };
}

const _a = new THREE.Color(), _b = new THREE.Color();
const mixColor = (out: THREE.Color, a: string, b: string, f: number) => out.copy(_a.set(a)).lerp(_b.set(b), f);

/** Finds the two keyframes around `minute` (minutes since midnight of the game day) and how far between them. */
export function keysAround(minute: number): [LightKey, LightKey, number] {
  const keys = LIGHT_KEYS;
  const first = keys[0]!, last = keys[keys.length - 1]!;
  // Before 06:00 (real-time mode, small hours) counts as deep night.
  const m = minute < first.minute ? last.minute : Math.min(minute, last.minute);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!, b = keys[i + 1]!;
    if (m >= a.minute && m <= b.minute) return [a, b, (m - a.minute) / (b.minute - a.minute)];
  }
  return [last, last, 0];
}

/** Light for a minute of the day and a weather. Writes into `out` to avoid allocating every frame. */
export function sampleLight(minute: number, weather: WeatherId, out: LightSample = createSample()): LightSample {
  const [a, b, f] = keysAround(minute);
  const lerp = (x: number, y: number) => x + (y - x) * f;
  mixColor(out.skyTop, a.skyTop, b.skyTop, f);
  mixColor(out.skyHorizon, a.skyHorizon, b.skyHorizon, f);
  mixColor(out.hemiSky, a.hemiSky, b.hemiSky, f);
  mixColor(out.hemiGround, a.hemiGround, b.hemiGround, f);
  mixColor(out.sunColor, a.sunColor, b.sunColor, f);
  mixColor(out.water, a.water, b.water, f);
  out.hemiIntensity = lerp(a.hemiIntensity, b.hemiIntensity);
  out.sunIntensity = lerp(a.sunIntensity, b.sunIntensity);
  out.sunDir.set(lerp(a.sunDir[0], b.sunDir[0]), lerp(a.sunDir[1], b.sunDir[1]), lerp(a.sunDir[2], b.sunDir[2])).normalize();
  out.lamps = lerp(a.lamps, b.lamps);
  out.night = lerp(a.night, b.night);
  out.cloud.set(0xffffff);

  const w = WEATHER_LIGHT[weather];
  if (w.skyTint) {
    // At night the weather tint is mostly lost in the dark, so it fades with the night.
    const amount = w.skyTintAmount * (1 - out.night * 0.7);
    _a.set(w.skyTint);
    out.skyTop.lerp(_a, amount);
    out.skyHorizon.lerp(_a, amount);
    out.cloud.lerp(_a, Math.min(1, amount * 1.2));
  }
  if (w.waterTint) out.water.lerp(_a.set(w.waterTint), 0.45);
  out.sunIntensity *= w.sunMultiplier;
  out.hemiIntensity *= w.hemiMultiplier;
  out.lamps = Math.max(out.lamps, w.minLamps);
  if (w.hideStars) out.night *= 0.15;
  return out;
}
