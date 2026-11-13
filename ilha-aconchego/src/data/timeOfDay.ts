/**
 * Light of the day (docs/GAME_DESIGN.md): golden morning, clear afternoon, orange sunset,
 * blue night with lights on. Keyframes by minute of the game day; values in between are blended.
 * Light intensities use Three.js physical units (about π means "full white light").
 */
export interface LightKey {
  minute: number;
  skyTop: string;
  skyHorizon: string;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
  /** Direction the sunlight comes from (not normalized). */
  sunDir: readonly [number, number, number];
  /** 0 = lamps off, 1 = windows, lanterns and string lights fully on. */
  lamps: number;
  /** 0 to 1: stars and fireflies. */
  night: number;
  /** Multiplies the sea texture. */
  water: string;
}

export const LIGHT_KEYS: readonly LightKey[] = [
  { minute: 6 * 60, skyTop: '#9CC9E8', skyHorizon: '#F6D3B0', hemiSky: '#FFE9CC', hemiGround: '#6E8A5E', hemiIntensity: 1.25, sunColor: '#FFD29A', sunIntensity: 1.3, sunDir: [1, 0.45, 0.55], lamps: 0.35, night: 0.1, water: '#F4E8DA' },
  { minute: 8 * 60, skyTop: '#86C7EC', skyHorizon: '#D8EEF5', hemiSky: '#FFF3E0', hemiGround: '#7E9A6A', hemiIntensity: 1.45, sunColor: '#FFE6BE', sunIntensity: 1.65, sunDir: [0.9, 0.8, 0.6], lamps: 0, night: 0, water: '#F6FAFF' },
  { minute: 13 * 60, skyTop: '#7FC6EC', skyHorizon: '#CDEBF5', hemiSky: '#FFFFFF', hemiGround: '#8AA676', hemiIntensity: 1.5, sunColor: '#FFF6E8', sunIntensity: 1.75, sunDir: [-0.45, 1.45, 0.75], lamps: 0, night: 0, water: '#FFFFFF' },
  { minute: 17 * 60, skyTop: '#86BEE6', skyHorizon: '#F2DDBE', hemiSky: '#FFEBD2', hemiGround: '#7F8F68', hemiIntensity: 1.4, sunColor: '#FFD8A8', sunIntensity: 1.6, sunDir: [-0.95, 0.75, 0.45], lamps: 0, night: 0, water: '#FFF2E4' },
  { minute: 18 * 60 + 30, skyTop: '#7D8FC4', skyHorizon: '#F5A881', hemiSky: '#FFC9A6', hemiGround: '#6E5A66', hemiIntensity: 1.15, sunColor: '#FF9A62', sunIntensity: 1.45, sunDir: [-1, 0.38, 0.32], lamps: 0.6, night: 0.15, water: '#FFC3AE' },
  { minute: 20 * 60, skyTop: '#2C3A6E', skyHorizon: '#6D6E9E', hemiSky: '#7D8CCB', hemiGround: '#2C3446', hemiIntensity: 0.85, sunColor: '#B8C4FF', sunIntensity: 0.5, sunDir: [-0.4, 1.1, -0.4], lamps: 1, night: 0.8, water: '#6A79A8' },
  { minute: 22 * 60, skyTop: '#152048', skyHorizon: '#2B3A66', hemiSky: '#5D74B8', hemiGround: '#1E2A3C', hemiIntensity: 0.75, sunColor: '#AEC0FF', sunIntensity: 0.42, sunDir: [-0.3, 1.2, -0.5], lamps: 1, night: 1, water: '#4A5C90' },
  { minute: 26 * 60, skyTop: '#121B40', skyHorizon: '#26335E', hemiSky: '#56699F', hemiGround: '#1A2434', hemiIntensity: 0.7, sunColor: '#A9BBFF', sunIntensity: 0.38, sunDir: [-0.2, 1.2, -0.6], lamps: 1, night: 1, water: '#44558A' },
];

/** How each weather changes the light: sky tint and how much of it, and multipliers. */
export interface WeatherLight {
  skyTint: string | null;
  skyTintAmount: number;
  sunMultiplier: number;
  hemiMultiplier: number;
  waterTint: string | null;
  /** Lamps come on at least this much (rainy days are darker). */
  minLamps: number;
  hideStars: boolean;
}

export const WEATHER_LIGHT: Record<'sun' | 'rain' | 'storm' | 'snow' | 'rainbow', WeatherLight> = {
  sun: { skyTint: null, skyTintAmount: 0, sunMultiplier: 1, hemiMultiplier: 1, waterTint: null, minLamps: 0, hideStars: false },
  rainbow: { skyTint: '#A6DCF5', skyTintAmount: 0.25, sunMultiplier: 1, hemiMultiplier: 1.03, waterTint: null, minLamps: 0, hideStars: false },
  rain: { skyTint: '#8C9BA6', skyTintAmount: 0.6, sunMultiplier: 0.4, hemiMultiplier: 0.92, waterTint: '#9AAAB4', minLamps: 0.35, hideStars: true },
  storm: { skyTint: '#5F6B78', skyTintAmount: 0.72, sunMultiplier: 0.25, hemiMultiplier: 0.8, waterTint: '#7E8C96', minLamps: 0.55, hideStars: true },
  snow: { skyTint: '#DCE6EE', skyTintAmount: 0.4, sunMultiplier: 0.75, hemiMultiplier: 1, waterTint: '#C9D6E0', minLamps: 0.15, hideStars: true },
};
