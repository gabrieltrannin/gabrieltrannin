import type { FestivalId } from './calendar';
import type { ItemId } from './items';
import type { XZ } from './map';
import type { NpcId } from './villagers';

/**
 * Stage 6: one festival per season in the market square (docs/GAME_DESIGN.md, "Um festival por estação:
 * Flores, Lanternas, Colheita e Neve"). On the day, the square is decorated, the villagers gather there,
 * and the host runs a little game. Each player can play once per festival; better scores win more.
 */

export type MinigameId = 'memory' | 'sequence' | 'whack' | 'timing';

export interface FestivalDef {
  id: FestivalId;
  /** From/to minutes of the day while the villagers are gathered. */
  hours: readonly [number, number];
  host: NpcId;
  game: MinigameId;
  /** Highest possible score of the game. */
  maxScore: number;
  /** Score for the special prize. */
  prizeScore: number;
  prize: ItemId;
}

export const FESTIVAL_DEFS: Record<FestivalId, FestivalDef> = {
  flowers: { id: 'flowers', hours: [9 * 60, 18 * 60], host: 'margo', game: 'memory', maxScore: 6, prizeScore: 4, prize: 'furn.flowerArch' },
  lanterns: { id: 'lanterns', hours: [17 * 60, 24 * 60], host: 'juca', game: 'sequence', maxScore: 10, prizeScore: 5, prize: 'furn.paperLantern' },
  harvest: { id: 'harvest', hours: [9 * 60, 18 * 60], host: 'lino', game: 'whack', maxScore: 30, prizeScore: 15, prize: 'furn.jackLantern' },
  snow: { id: 'snow', hours: [10 * 60, 20 * 60], host: 'tico', game: 'timing', maxScore: 8, prizeScore: 5, prize: 'furn.snowGlobe' },
};

/** The middle of the square, where the host stands and the games are played. */
export const FESTIVAL_CENTER: XZ = [10.3, 2.4];
export const FESTIVAL_REACH = 7;
/** Coins per point of score. */
export const FESTIVAL_COINS = 25;

/** Where the villagers stand during a festival: a ring around the square. */
export function festivalSpot(index: number, count: number): XZ {
  const a = (index / Math.max(1, count)) * Math.PI * 2 + 0.4;
  return [FESTIVAL_CENTER[0] + Math.cos(a) * 3.6, FESTIVAL_CENTER[1] + 2.0 + Math.sin(a) * 2.2];
}
