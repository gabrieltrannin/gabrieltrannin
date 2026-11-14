/**
 * Stage 6: background music made on the fly with WebAudio (no sound files). Each place has a theme
 * (docs/GAME_DESIGN.md, "cada uma com visual, música e recursos próprios"): a scale, a tempo and
 * instruments. A short phrase is composed once per theme from a seed and loops softly, with a bass note
 * on the beat and a quiet chord each bar. It starts after the first click or key press (browsers ask
 * for that) and can be turned off in the options.
 */

export type MusicTheme = 'home' | 'night' | 'beach' | 'forest' | 'volcano' | 'clouds' | 'mine' | 'festival' | 'house';

interface ThemeDef {
  /** MIDI note of the scale's root. */
  root: number;
  scale: readonly number[];
  bpm: number;
  lead: OscillatorType;
  bass: OscillatorType;
  /** Chance that an eighth note has a melody note. */
  density: number;
  /** Seed of the phrase. */
  seed: number;
  /** Delay echo (0 = none). */
  echo: number;
}

const THEMES: Record<MusicTheme, ThemeDef> = {
  home: { root: 60, scale: [0, 2, 4, 7, 9], bpm: 96, lead: 'triangle', bass: 'sine', density: 0.55, seed: 3, echo: 0.15 },
  night: { root: 57, scale: [0, 2, 4, 7, 9], bpm: 72, lead: 'sine', bass: 'sine', density: 0.35, seed: 11, echo: 0.3 },
  house: { root: 62, scale: [0, 2, 4, 7, 9, 11], bpm: 84, lead: 'sine', bass: 'triangle', density: 0.4, seed: 21, echo: 0.2 },
  beach: { root: 62, scale: [0, 2, 4, 7, 9], bpm: 108, lead: 'triangle', bass: 'triangle', density: 0.6, seed: 5, echo: 0.12 },
  forest: { root: 55, scale: [0, 2, 4, 7, 9, 10], bpm: 84, lead: 'sine', bass: 'sine', density: 0.5, seed: 8, echo: 0.25 },
  volcano: { root: 57, scale: [0, 3, 5, 7, 10], bpm: 92, lead: 'triangle', bass: 'sawtooth', density: 0.5, seed: 13, echo: 0.1 },
  clouds: { root: 65, scale: [0, 2, 4, 6, 7, 11], bpm: 70, lead: 'sine', bass: 'sine', density: 0.4, seed: 17, echo: 0.35 },
  mine: { root: 50, scale: [0, 2, 3, 7, 8], bpm: 68, lead: 'triangle', bass: 'sine', density: 0.3, seed: 19, echo: 0.3 },
  festival: { root: 62, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 124, lead: 'triangle', bass: 'triangle', density: 0.75, seed: 23, echo: 0.1 },
};

const STEPS = 32;
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function phrase(def: ThemeDef): (number | null)[] {
  let s = def.seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const notes: (number | null)[] = [];
  let degree = 2;
  for (let i = 0; i < STEPS; i++) {
    if (rnd() > def.density && i % 8 !== 0) {
      notes.push(null);
      continue;
    }
    degree = Math.max(0, Math.min(def.scale.length * 2 - 1, degree + Math.round((rnd() - 0.5) * 4)));
    notes.push(def.root + 12 + def.scale[degree % def.scale.length]! + 12 * Math.floor(degree / def.scale.length));
  }
  // End the phrase on the root, so the loop feels at home.
  notes[STEPS - 2] = def.root + 12;
  return notes;
}

const STORAGE_KEY = 'ilha-aconchego.music';

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private echo: DelayNode | null = null;
  private echoGain: GainNode | null = null;
  private theme: MusicTheme = 'home';
  private notes: (number | null)[] = phrase(THEMES.home);
  private step = 0;
  private nextTime = 0;
  private timer = 0;
  enabled = true;

  constructor() {
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      this.enabled = true;
    }
    const start = () => {
      this.start();
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
  }

  private start(): void {
    if (this.ctx || typeof AudioContext === 'undefined') return;
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.7 : 0;
    this.echo = this.ctx.createDelay(1);
    this.echoGain = this.ctx.createGain();
    this.echo.connect(this.echoGain).connect(this.echo);
    this.echoGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.nextTime = this.ctx.currentTime + 0.1;
    this.applyTheme();
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      // Private windows may refuse; the choice just lasts until the page closes.
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.2);
  }

  setTheme(theme: MusicTheme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.notes = phrase(THEMES[theme]);
    this.step = 0;
    this.applyTheme();
  }

  get current(): MusicTheme {
    return this.theme;
  }

  private applyTheme(): void {
    if (!this.ctx || !this.echo || !this.echoGain) return;
    const def = THEMES[this.theme];
    this.echo.delayTime.value = (60 / def.bpm) * 0.75;
    this.echoGain.gain.value = def.echo;
  }

  private note(freq: number, at: number, length: number, type: OscillatorType, volume: number, toEcho: boolean): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain).connect(this.master!);
    if (toEcho) gain.connect(this.echo!);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }

  private schedule(): void {
    if (!this.ctx || !this.enabled) return;
    const def = THEMES[this.theme];
    const eighth = 60 / def.bpm / 2;
    if (this.nextTime < this.ctx.currentTime) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.3) {
      const i = this.step % STEPS;
      const n = this.notes[i];
      if (n !== null && n !== undefined) this.note(midi(n), this.nextTime, eighth * 1.8, def.lead, 0.05, true);
      if (i % 4 === 0) this.note(midi(def.root - 12 + (i % 16 === 8 ? def.scale[3] ?? 7 : 0)), this.nextTime, eighth * 3, def.bass, 0.045, false);
      if (i % 16 === 0) for (const d of [0, 2, 4]) this.note(midi(def.root + def.scale[d % def.scale.length]!), this.nextTime, eighth * 14, 'sine', 0.012, false);
      this.nextTime += eighth;
      this.step += 1;
    }
  }

  dispose(): void {
    window.clearInterval(this.timer);
    void this.ctx?.close();
  }
}
