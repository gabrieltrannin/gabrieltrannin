/**
 * Sons do jogo, sintetizados na hora com Web Audio (sem arquivos).
 * O navegador só libera áudio depois de um toque/clique: `unlock()`.
 */

export type Sfx =
  | 'click' | 'coin' | 'lose' | 'dice' | 'hop' | 'crown' | 'hit' | 'jump' | 'dash'
  | 'explode' | 'splash' | 'tick' | 'go' | 'win' | 'fail' | 'pass' | 'goal' | 'buy' | 'turn' | 'pop';

const MUTE_KEY = 'fuzue:mudo';

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer = 0;
  private musicStep = 0;
  private musicMode: 'calm' | 'fast' | null = null;
  muted = false;

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* ignora */ }
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* ignora */ }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.2, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 0.3, freq = 1200, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  play(name: Sfx): void {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'click': this.tone(660, 0.06, 'triangle', 0.12); break;
      case 'pop': this.tone(520, 0.08, 'sine', 0.18, 900); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.12); this.tone(1319, 0.16, 'square', 0.12, undefined, 0.07); break;
      case 'lose': this.tone(392, 0.12, 'sawtooth', 0.1, 220); this.tone(262, 0.2, 'sawtooth', 0.1, 150, 0.1); break;
      case 'dice': for (let i = 0; i < 5; i++) this.noise(0.04, 0.18, 3000, i * 0.07); break;
      case 'hop': this.tone(300, 0.09, 'sine', 0.15, 520); break;
      case 'jump': this.tone(280, 0.14, 'square', 0.1, 640); break;
      case 'dash': this.noise(0.14, 0.18, 1600); break;
      case 'hit': // espada batendo em metal
        this.tone(1480, 0.25, 'square', 0.07, 1320); this.tone(2210, 0.18, 'square', 0.05, 2000); this.noise(0.08, 0.3, 5000); break;
      case 'explode': this.noise(0.6, 0.5, 600); this.tone(110, 0.5, 'sawtooth', 0.2, 40); break;
      case 'splash': this.noise(0.4, 0.25, 1800); this.tone(500, 0.2, 'sine', 0.08, 200); break;
      case 'tick': this.tone(880, 0.08, 'square', 0.12); break;
      case 'go': this.tone(1046, 0.25, 'square', 0.16); break;
      case 'pass': this.tone(700, 0.08, 'triangle', 0.15, 1000); break;
      case 'buy': this.tone(784, 0.08, 'triangle', 0.15); this.tone(1046, 0.12, 'triangle', 0.15, undefined, 0.08); break;
      case 'turn': this.tone(523, 0.08, 'triangle', 0.14); this.tone(784, 0.12, 'triangle', 0.14, undefined, 0.09); break;
      case 'crown':
      case 'win': // fanfarra de corneta
        [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'sawtooth', 0.07, undefined, i * 0.12));
        this.tone(784, 0.6, 'sawtooth', 0.08, undefined, 0.5);
        this.tone(523, 0.6, 'triangle', 0.1, undefined, 0.5);
        break;
      case 'goal':
        [784, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'square', 0.15, undefined, i * 0.14));
        this.noise(0.8, 0.15, 4000, 0.1);
        break;
      case 'fail': [392, 330, 262].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, undefined, i * 0.16)); break;
    }
  }

  /** Musiquinha em loop: calma no lobby/tabuleiro, rápida nos minijogos. */
  music(mode: 'calm' | 'fast' | null): void {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    window.clearInterval(this.musicTimer);
    if (!mode) return;
    const bpm = mode === 'fast' ? 150 : 108;
    const stepMs = 60000 / bpm / 2;
    // Ré dórico (Dm – C – Bb – C): som de taverna medieval
    const chords = [[294, 349, 440], [262, 330, 392], [233, 294, 349], [262, 330, 392]];
    const bass = [73.4, 65.4, 58.3, 65.4];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted || !this.musicGain) return;
      const bar = Math.floor(this.musicStep / 8) % 4;
      const s = this.musicStep % 8;
      const t = this.ctx.currentTime;
      const note = (freq: number, dur: number, type: OscillatorType, vol: number) => {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(this.musicGain!);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      };
      if (s % 4 === 0) note(bass[bar] * 2, 0.4, 'triangle', 0.22);
      // alaúde: nota curta e beliscada
      const arp = chords[bar][[0, 1, 2, 1][s % 4]] * (s >= 4 ? 2 : 1);
      note(arp, mode === 'fast' ? 0.1 : 0.18, 'triangle', mode === 'fast' ? 0.08 : 0.09);
      // tambor nos tempos fortes dos minijogos
      if (mode === 'fast' && s % 2 === 0) {
        const len = Math.floor(this.ctx.sampleRate * 0.05);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = s % 4 === 0 ? 300 : 900;
        const g = this.ctx.createGain();
        g.gain.value = 0.25;
        src.connect(f).connect(g).connect(this.musicGain);
        src.start(t);
      }
      this.musicStep++;
    }, stepMs);
  }
}

export const sound = new Sound();
