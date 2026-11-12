/**
 * Tabuleiro "Ilha Confeito": casas, ligações e tipos.
 * O servidor usa para as regras; o cliente, para desenhar.
 */

export type TileType = 'azul' | 'vermelha' | 'evento' | 'loja' | 'armadilha' | 'duelo';

export interface Tile {
  id: number;
  x: number;
  z: number;
  type: TileType;
  /** Próximas casas. Mais de uma = bifurcação (o jogador escolhe). */
  next: number[];
}

export const TILE_INFO: Record<TileType, { label: string; color: string; short: string }> = {
  azul: { label: '+3 moedas', color: '#4aa3ff', short: '+3' },
  vermelha: { label: '−3 moedas', color: '#ff4d5a', short: '−3' },
  evento: { label: 'Evento surpresa', color: '#a77bff', short: '?' },
  loja: { label: 'Loja', color: '#ffc93c', short: 'loja' },
  armadilha: { label: 'Armadilha: −5 moedas', color: '#ff8a3d', short: '!' },
  duelo: { label: 'Duelo de dados', color: '#ff5fa2', short: 'VS' },
};

const MAIN_TYPES: TileType[] = [
  'azul', 'azul', 'azul', 'evento', 'vermelha', 'loja', 'azul', 'duelo',
  'azul', 'azul', 'evento', 'armadilha', 'azul', 'vermelha', 'azul', 'evento',
  'azul', 'loja', 'vermelha', 'azul', 'azul', 'evento', 'duelo', 'azul',
];
const MAIN_COUNT = MAIN_TYPES.length;
const A_TYPES: TileType[] = ['evento', 'vermelha', 'evento', 'azul'];
const B_TYPES: TileType[] = ['armadilha', 'evento', 'azul'];

/** Onde ficam as bifurcações e para onde levam. */
const FORK_A = { from: 2, to: 9 };
const FORK_B = { from: 14, to: 20 };

function buildBoard(): Tile[] {
  const tiles: Tile[] = [];
  const A = 7.2;
  const B = 5.6;
  for (let i = 0; i < MAIN_COUNT; i++) {
    const a = Math.PI / 2 + (i / MAIN_COUNT) * Math.PI * 2;
    tiles.push({ id: i, x: round(Math.cos(a) * A), z: round(Math.sin(a) * B), type: MAIN_TYPES[i], next: [(i + 1) % MAIN_COUNT] });
  }
  const addBranch = (fork: { from: number; to: number }, types: TileType[]) => {
    const p0 = tiles[fork.from];
    const p2 = tiles[fork.to];
    const cx = (p0.x + p2.x) * 0.15;
    const cz = (p0.z + p2.z) * 0.15;
    const ids: number[] = [];
    types.forEach((type, k) => {
      const t = (k + 1) / (types.length + 1);
      const u = 1 - t;
      const id = tiles.length;
      tiles.push({
        id,
        x: round(u * u * p0.x + 2 * u * t * cx + t * t * p2.x),
        z: round(u * u * p0.z + 2 * u * t * cz + t * t * p2.z),
        type,
        next: [],
      });
      ids.push(id);
    });
    ids.forEach((id, k) => { tiles[id].next = [k < ids.length - 1 ? ids[k + 1] : fork.to]; });
    tiles[fork.from].next.push(ids[0]);
  };
  addBranch(FORK_A, A_TYPES);
  addBranch(FORK_B, B_TYPES);
  return tiles;
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export const BOARD: Tile[] = buildBoard();
export const START_TILE = 0;
export const ISLAND_RADIUS = 10;

/** Nome de cada saída de uma bifurcação, para os botões de escolha. */
export function forkLabel(from: number, to: number): string {
  return BOARD[from].next[0] === to ? 'Caminho normal' : 'Atalho';
}

/** Menor número de passos de `from` até `to` seguindo as setas. */
export function stepsBetween(from: number, to: number): number {
  if (from === to) return 0;
  const dist = new Map<number, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of BOARD[cur].next) {
      if (dist.has(n)) continue;
      const d = dist.get(cur)! + 1;
      if (n === to) return d;
      dist.set(n, d);
      queue.push(n);
    }
  }
  return Infinity;
}

/** Casas onde a coroa pode aparecer. */
export const CROWN_SPOTS: number[] = BOARD.filter(t => t.type === 'azul' && t.id !== START_TILE).map(t => t.id);
