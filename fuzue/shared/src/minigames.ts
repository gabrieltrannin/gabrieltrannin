import { clampToCircle, PLAYER_RADIUS, type Body, type Pillar, type WorldDef } from './physics';

/**
 * Os 6 minijogos: textos, regras de cenário e "mundo" para a física.
 * O mundo vem daqui para que o servidor e a previsão do cliente vejam
 * exatamente o mesmo chão, os mesmos buracos e as mesmas esteiras.
 */

export type MinigameId = 'ringue' | 'hexa' | 'corrida' | 'chuva' | 'bomba' | 'futebol';

export interface MinigameDef {
  id: MinigameId;
  name: string;
  /** Uma frase de instrução, mostrada antes de começar. */
  rule: string;
  mode: 'ffa' | 'team';
  /** Duração máxima (s). */
  duration: number;
  /** Rótulo do placar, quando o minijogo conta pontos. */
  scoreLabel?: string;
  /** Câmera: arena inteira, seguindo o jogador ou o campo. */
  camera: 'arena' | 'follow' | 'field';
}

export const MINIGAMES: Record<MinigameId, MinigameDef> = {
  ringue: { id: 'ringue', name: 'Lago Congelado', rule: 'O gelo está rachando e o lago vai encolhendo. Empurre todo mundo para a água gelada e seja o último de pé!', mode: 'ffa', duration: 50, camera: 'arena' },
  hexa: { id: 'hexa', name: 'Torre em Ruínas', rule: 'Cada pedra desaba logo depois que alguém pisa nela. Não pare de andar e seja o último a cair na lava!', mode: 'ffa', duration: 70, camera: 'arena' },
  corrida: { id: 'corrida', name: 'Ponte do Castelo', rule: 'Chegue primeiro ao portão do castelo: pule os buracos da ponte, vença a correnteza e desvie das toras giratórias!', mode: 'ffa', duration: 75, camera: 'follow' },
  chuva: { id: 'chuva', name: 'Tesouro do Dragão', rule: 'O dragão espalhou o tesouro! Pegue o máximo de moedas e fuja das bolas de fogo!', mode: 'ffa', duration: 40, scoreLabel: 'moedas', camera: 'arena' },
  bomba: { id: 'bomba', name: 'Barril de Pólvora', rule: 'Está com o barril aceso? Encoste em alguém para passar antes que ele exploda!', mode: 'ffa', duration: 90, camera: 'arena' },
  futebol: { id: 'futebol', name: 'Torneio da Bola', rule: 'Dois contra dois: leve a bola de couro até o gol da casa rival!', mode: 'team', duration: 60, scoreLabel: 'gols', camera: 'field' },
};

export const MINIGAME_IDS = Object.keys(MINIGAMES) as MinigameId[];

/* ---------------- Ringue Escorregadio ---------------- */

export const RING = { startRadius: 9, endRadius: 3.6, killY: -6 };

export function ringWorld(radius: number): WorldDef {
  return {
    ground: (x, z, y) => (y >= -0.35 && x * x + z * z <= radius * radius ? 0 : null),
    slippery: true,
  };
}

/* ---------------- Chão que Some (hexágonos) ---------------- */

export const HEX = {
  /** Distância do centro do hexágono até um canto. */
  size: 1.15,
  /** Anéis em volta do hexágono central (5 → 91 pisos por andar). */
  rings: 5,
  /** Altura de cada andar. Caiu do último, está fora. */
  layers: [0, -6, -12] as const,
  /** Tempo entre pisar e o piso cair (s). */
  crackTime: 1.1,
  killY: -20,
};

export interface HexTile { q: number; r: number; x: number; z: number }

const SQRT3 = Math.sqrt(3);

export const HEX_TILES: HexTile[] = (() => {
  const out: HexTile[] = [];
  const n = HEX.rings;
  for (let q = -n; q <= n; q++) {
    for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) {
      out.push({ q, r, x: HEX.size * SQRT3 * (q + r / 2), z: HEX.size * 1.5 * r });
    }
  }
  return out;
})();
export const HEX_PER_LAYER = HEX_TILES.length;

const hexLookup = new Map<string, number>(HEX_TILES.map((t, i) => [`${t.q},${t.r}`, i]));

/** Índice do hexágono que contém (x, z), ou -1. */
export function hexIndexAt(x: number, z: number): number {
  const fq = ((SQRT3 / 3) * x - z / 3) / HEX.size;
  const fr = ((2 / 3) * z) / HEX.size;
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return hexLookup.get(`${q},${r}`) ?? -1;
}

/** Estados de um piso: 0 inteiro, 1 rachando, 2 caiu. */
export const TILE_OK = 0;
export const TILE_CRACK = 1;
export const TILE_GONE = 2;

export function hexWorld(tiles: ArrayLike<number>): WorldDef {
  return {
    ground: (x, z, y) => {
      const i = hexIndexAt(x, z);
      if (i < 0) return null;
      for (let layer = 0; layer < HEX.layers.length; layer++) {
        const h = HEX.layers[layer];
        if (y < h - 0.35) continue;
        return (tiles[layer * HEX_PER_LAYER + i] ?? TILE_OK) < TILE_GONE ? h : null;
      }
      return null;
    },
  };
}

/* ---------------- Ponte do Castelo (corrida) ---------------- */

export const RACE = {
  halfWidth: 4,
  /** Trechos de chão (entre eles, buracos para pular). */
  floors: [
    { z0: -13, z1: 4 },
    { z0: -29, z1: -15.5 },
    { z0: -47, z1: -31.5 },
    { z0: -72, z1: -49.5 },
  ],
  /** Esteira que puxa para trás (+z). */
  conveyors: [{ z0: -27, z1: -19, vz: 3.2 }],
  /** Martelos giratórios: barra presa num poste no meio da pista. */
  sweepers: [
    { z: -36.5, speed: 1.25, phase: 0 },
    { z: -42.5, speed: -1.5, phase: 1.3 },
  ],
  sweeperLength: 4.1,
  bumpers: [
    { x: -2, z: -54, r: 0.7, h: 1.6 },
    { x: 2.2, z: -57.5, r: 0.7, h: 1.6 },
    { x: -0.6, z: -61, r: 0.7, h: 1.6 },
    { x: 2.4, z: -64.2, r: 0.6, h: 1.6 },
    { x: -2.6, z: -65.5, r: 0.6, h: 1.6 },
  ] as Pillar[],
  finishZ: -68,
  /** Onde quem cai renasce (o último alcançado). */
  checkpoints: [2, -17, -33.5, -51.5],
  killY: -7,
};

const RACE_RAIL = RACE.halfWidth - PLAYER_RADIUS;

const RACE_PILLARS: Pillar[] = [
  ...RACE.bumpers,
  ...RACE.sweepers.map(s => ({ x: 0, z: s.z, r: 0.35, h: 1.5 })),
];

export function raceWorld(): WorldDef {
  return {
    ground: (x, z, y) => {
      if (y < -0.35 || Math.abs(x) > RACE.halfWidth) return null;
      for (const f of RACE.floors) if (z >= f.z0 && z <= f.z1) return 0;
      return null;
    },
    pillars: RACE_PILLARS,
    // grades nas laterais: só se cai nos buracos
    bounds: (b: Body) => {
      if (b.y < -0.2) return;
      if (b.x > RACE_RAIL) { b.x = RACE_RAIL; if (b.vx > 0) b.vx = 0; }
      if (b.x < -RACE_RAIL) { b.x = -RACE_RAIL; if (b.vx < 0) b.vx = 0; }
    },
    conveyor: (x, z) => {
      if (Math.abs(x) > RACE.halfWidth) return null;
      for (const c of RACE.conveyors) if (z >= c.z0 && z <= c.z1) return { x: 0, z: c.vz };
      return null;
    },
  };
}

/** Ângulo de um martelo da corrida no tempo `t` (s desde o início). */
export function sweeperAngle(i: number, t: number): number {
  const s = RACE.sweepers[i];
  return s.phase + s.speed * t;
}

/* ---------------- Arenas planas (Chuva de Moedas e Bomba-Relógio) ---------------- */

export const CHUVA = { radius: 9 };
export const BOMBA = { radius: 8.5 };

export function flatWorld(radius: number): WorldDef {
  return {
    ground: (_x, _z, y) => (y >= -0.35 ? 0 : null),
    bounds: (b: Body) => clampToCircle(b, radius),
  };
}

/* ---------------- Futebol Caótico ---------------- */

export const SOCCER = {
  halfX: 11,
  halfZ: 7,
  goalHalf: 3.2,
  goalDepth: 2.2,
  ballR: 1.1,
  /** Time 0 defende o gol da esquerda (x negativo). */
  teamColors: ['#a3242f', '#2f5a8f'],
  teamNames: ['Casa do Leão', 'Casa do Lobo'],
};

export function soccerWorld(): WorldDef {
  const mx = SOCCER.halfX - PLAYER_RADIUS;
  const mz = SOCCER.halfZ - PLAYER_RADIUS;
  return {
    ground: (_x, _z, y) => (y >= -0.35 ? 0 : null),
    bounds: (b: Body) => {
      if (b.x > mx) { b.x = mx; if (b.vx > 0) b.vx = 0; }
      if (b.x < -mx) { b.x = -mx; if (b.vx < 0) b.vx = 0; }
      if (b.z > mz) { b.z = mz; if (b.vz > 0) b.vz = 0; }
      if (b.z < -mz) { b.z = -mz; if (b.vz < 0) b.vz = 0; }
    },
  };
}

/* ---------------- mundo de cada minijogo ---------------- */

/** Dados do estado sincronizado que mudam o mundo (raio do ringue, pisos). */
export interface WorldView {
  radius: number;
  tiles: ArrayLike<number>;
}

export function worldFor(id: MinigameId, v: WorldView): WorldDef {
  switch (id) {
    case 'ringue': return ringWorld(v.radius);
    case 'hexa': return hexWorld(v.tiles);
    case 'corrida': return raceWorld();
    case 'chuva': return flatWorld(CHUVA.radius);
    case 'bomba': return flatWorld(BOMBA.radius);
    case 'futebol': return soccerWorld();
  }
}
