import { nextRandom } from './rng';

/**
 * The fishing minigame (docs/GAME_DESIGN.md: "minijogo de tensão na linha"), as pure logic so it can
 * be tested without a screen. Holding the button reels in and raises the line's tension; letting go
 * lowers it; the fish pulls in bursts. While the tension stays inside the green zone the fish comes
 * closer; outside it, the fish gets away bit by bit. Too much tension snaps the line.
 */
export interface TensionOptions {
  /** 1 easy to 5 hard. */
  difficulty: number;
  /** Half the height of the green zone (bigger is easier). */
  zone: number;
  seed: number;
}

export type TensionResult = 'playing' | 'caught' | 'escaped' | 'snapped';

export const ZONE_CENTER = 0.55;

/** Half-height of the green zone for a rod level, fishing level and today's fishing bonus. */
export function zoneSize(rodLevel: number, fishingLevel: number, buff: boolean, assisted = false): number {
  return Math.min(0.32, 0.12 + 0.02 * (rodLevel - 1) + 0.006 * fishingLevel + (buff ? 0.03 : 0) + (assisted ? 0.06 : 0));
}

export class TensionGame {
  tension = 0.35;
  progress = 0.3;
  result: TensionResult = 'playing';
  /** Current pull of the fish (for the shaking line on screen). */
  pull = 0;
  private rng: number;
  private burstLeft = 0;
  private calmLeft = 0.8;

  constructor(private readonly opts: TensionOptions) {
    this.rng = opts.seed | 0 || 1;
  }

  get zoneLow(): number {
    return ZONE_CENTER - this.opts.zone;
  }

  get zoneHigh(): number {
    return ZONE_CENTER + this.opts.zone;
  }

  private random(): number {
    const r = nextRandom(this.rng);
    this.rng = r.state;
    return r.value;
  }

  /** Advances the game by `dt` seconds (call with small steps, at most 0.05 s). */
  step(dt: number, reeling: boolean): TensionResult {
    if (this.result !== 'playing') return this.result;
    const d = this.opts.difficulty;
    if (this.burstLeft > 0) {
      this.burstLeft -= dt;
      if (this.burstLeft <= 0) this.calmLeft = 0.6 + this.random() * (1.6 - d * 0.18);
    } else {
      this.calmLeft -= dt;
      if (this.calmLeft <= 0) {
        this.burstLeft = 0.4 + this.random() * 0.5;
        this.pull = (0.25 + this.random() * 0.25) * (0.7 + d * 0.22) * (this.random() < 0.5 ? 1 : -0.6);
      }
    }
    const fishPull = this.burstLeft > 0 ? this.pull : Math.sin(this.progress * 40) * 0.04;
    this.tension += ((reeling ? 0.8 : -0.65) + fishPull) * dt;
    this.tension = Math.max(0, this.tension);
    if (this.tension >= 1) return (this.result = 'snapped');
    const inZone = this.tension >= this.zoneLow && this.tension <= this.zoneHigh;
    this.progress += (inZone ? 0.24 - d * 0.015 : -0.1 - d * 0.02) * dt;
    if (this.progress >= 1) return (this.result = 'caught');
    if (this.progress <= 0) return (this.result = 'escaped');
    return 'playing';
  }
}
