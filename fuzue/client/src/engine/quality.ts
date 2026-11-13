/**
 * Qualidade gráfica por aparelho.
 *  - alta:  PC. Antisserrilhado 4x, brilho (bloom) inteiro, sombras 2048.
 *  - media: celular/tablet. Bloom em meia resolução, sombras 1024.
 *  - baixa: aparelho fraco. Sem pós-processamento.
 * Começa pelo palpite do aparelho e desce sozinha se o jogo ficar lento.
 * `?q=alta|media|baixa` na URL fixa um nível (fica salvo neste navegador).
 */
export type Tier = 'alta' | 'media' | 'baixa';

const KEY = 'fuzue:qualidade';
const TIERS: Tier[] = ['alta', 'media', 'baixa'];

function readPinned(): Tier | null {
  const q = new URLSearchParams(location.search).get('q') as Tier | null;
  try {
    if (q && TIERS.includes(q)) { localStorage.setItem(KEY, q); return q; }
    if (q === ('auto' as string)) localStorage.removeItem(KEY);
    const saved = localStorage.getItem(KEY) as Tier | null;
    if (saved && TIERS.includes(saved)) return saved;
  } catch { /* navegador sem armazenamento */ }
  return null;
}

function guess(): Tier {
  try {
    const dropped = sessionStorage.getItem(KEY) as Tier | null;
    if (dropped && TIERS.includes(dropped)) return dropped;
  } catch { /* ignora */ }
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem <= 2) return 'baixa';
  return touch ? 'media' : 'alta';
}

const pinned = readPinned();

export const quality = {
  tier: pinned ?? guess(),
  /** Nível fixado pela URL: não cai sozinho. */
  pinned: pinned !== null,
  /** Desce um nível. Retorna false se já está no mais baixo. */
  drop(): boolean {
    const i = TIERS.indexOf(this.tier);
    if (this.pinned || i >= TIERS.length - 1) return false;
    this.tier = TIERS[i + 1];
    try { sessionStorage.setItem(KEY, this.tier); } catch { /* ignora */ }
    return true;
  },
};
