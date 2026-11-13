/**
 * Deterministic random numbers (mulberry32).
 * Game rules must never call Math.random(): the generator state lives in GameState,
 * so the client and the multiplayer server produce the same results for the same commands.
 */

export interface RandomResult {
  value: number;
  state: number;
}

/** Returns a number in [0, 1) and the next generator state. */
export function nextRandom(state: number): RandomResult {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

/** Integer in [min, max], inclusive. */
export function nextInt(state: number, min: number, max: number): RandomResult {
  const r = nextRandom(state);
  return { value: min + Math.floor(r.value * (max - min + 1)), state: r.state };
}
