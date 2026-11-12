import { CODE_ALPHABET, CODE_LENGTH } from './constants';

/** Normaliza o que o jogador digitou ("k7 qx" → "K7QX") e valida. */
export function normalizeCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** Limpa o apelido: sem espaços duplicados, até 16 caracteres. */
export function sanitizeName(raw: unknown): string {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return name || 'Jogador';
}

/** Interpola ângulos pelo caminho mais curto. */
export function lerpAngle(a: number, b: number, k: number): number {
  const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * k;
}

/** Pseudo-aleatório com semente: o mesmo cenário para todo mundo. */
export function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pick<T>(arr: readonly T[], rand: () => number = Math.random): T {
  return arr[Math.floor(rand() * arr.length)];
}
