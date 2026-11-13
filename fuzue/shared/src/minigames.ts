import {
  axeWorld, BARDO, BARDO_GONE, CERCO, COROA, FLECHAS, gridWorld, harvestWorld, islandWorld, JAVALI,
  lavaWorld, millWorld, POTES, slopeWorld, TINTA, TRONO, yardWorld,
} from './arenas';
import { clampToCircle, PLAYER_RADIUS, type Body, type Pillar, type WorldDef } from './physics';

/**
 * Os minijogos: textos, regras de cenário e "mundo" para a física.
 * O mundo vem daqui para que o servidor e a previsão do cliente vejam
 * exatamente o mesmo chão, os mesmos buracos e as mesmas esteiras.
 * Os mundos dos minijogos novos ficam em arenas.ts.
 */

export type MinigameId =
  | 'ringue' | 'hexa' | 'corrida' | 'chuva' | 'bomba' | 'futebol'
  | 'coroa' | 'trono' | 'potes' | 'colheita' | 'moinho' | 'flechas' | 'javali' | 'cerco'
  | 'bardo' | 'tinta' | 'lava' | 'ladeira' | 'machados' | 'pastoreio' | 'estandarte';

/** O que aparece no placar ao lado de cada nome. */
export type MinigameHud = 'alive' | 'score' | 'lives' | 'race' | 'holder' | 'team';

export interface MinigameDef {
  id: MinigameId;
  name: string;
  /** Uma frase de instrução, mostrada antes de começar. */
  rule: string;
  mode: 'ffa' | 'team';
  /** Duração máxima (s). */
  duration: number;
  /** Câmera: arena inteira, seguindo o jogador, o campo, ou subindo junto (escalada). */
  camera: 'arena' | 'follow' | 'field' | 'climb';
  hud: MinigameHud;
  /** Unidade do placar (hud 'score'). */
  unit?: string;
  /** Corridas: z da chegada (para mostrar quantos metros faltam). */
  finishZ?: number;
  /** O que flutua sobre a cabeça de quem está com o objeto (mg.holder). */
  holderProp?: 'bomb' | 'crown';
  /** Times: dica mostrada nas instruções. */
  teamHint?: string;
  /** Existe desde a primeira versão (clientes antigos sabem jogar). */
  classic?: boolean;
}

export const MINIGAMES: Record<MinigameId, MinigameDef> = {
  ringue: { id: 'ringue', name: 'Lago Congelado', rule: 'O gelo está rachando e o lago vai encolhendo. Empurre todo mundo para a água gelada e seja o último de pé!', mode: 'ffa', duration: 50, camera: 'arena', hud: 'alive', classic: true },
  hexa: { id: 'hexa', name: 'Torre em Ruínas', rule: 'Cada pedra desaba logo depois que alguém pisa nela. Não pare de andar e seja o último a cair na lava!', mode: 'ffa', duration: 70, camera: 'arena', hud: 'alive', classic: true },
  corrida: { id: 'corrida', name: 'Ponte do Castelo', rule: 'Chegue primeiro ao portão do castelo: pule os buracos da ponte, vença a correnteza e desvie das toras giratórias!', mode: 'ffa', duration: 75, camera: 'follow', hud: 'race', finishZ: -68, classic: true },
  chuva: { id: 'chuva', name: 'Tesouro do Dragão', rule: 'O dragão espalhou o tesouro! Pegue o máximo de moedas e fuja das bolas de fogo!', mode: 'ffa', duration: 40, camera: 'arena', hud: 'score', unit: 'coin', classic: true },
  bomba: { id: 'bomba', name: 'Barril de Pólvora', rule: 'Está com o barril aceso? Encoste em alguém para passar antes que ele exploda!', mode: 'ffa', duration: 90, camera: 'arena', hud: 'holder', holderProp: 'bomb', classic: true },
  futebol: { id: 'futebol', name: 'Torneio da Bola', rule: 'Dois contra dois: leve a bola de couro até o gol da casa rival!', mode: 'team', duration: 60, camera: 'field', hud: 'team', teamHint: 'Ataque o gol do outro lado!', classic: true },
  coroa: { id: 'coroa', name: 'Coroa Roubada', rule: 'Pegue a coroa e fuja! Quem está com ela ganha 1 ponto por segundo. Empurre quem está com a coroa para roubar.', mode: 'ffa', duration: 45, camera: 'arena', hud: 'score', unit: 's', holderProp: 'crown' },
  trono: { id: 'trono', name: 'Trono Disputado', rule: 'Fique sozinho no círculo do trono para ganhar pontos. Com mais alguém dentro, ninguém pontua. E o trono muda de lugar!', mode: 'ffa', duration: 50, camera: 'arena', hud: 'score', unit: 's' },
  potes: { id: 'potes', name: 'Quebra-Potes', rule: 'Empurre os potes para quebrar: barro vale 1, ouro vale 3. Cuidado com os potes de pólvora!', mode: 'ffa', duration: 40, camera: 'arena', hud: 'score', unit: 'pts' },
  colheita: { id: 'colheita', name: 'Colheita', rule: 'Pegue uma abóbora e leve até a carroça no meio. Levou um empurrão? A abóbora cai!', mode: 'ffa', duration: 50, camera: 'arena', hud: 'score', unit: '🎃' },
  moinho: { id: 'moinho', name: 'Moinho Maluco', rule: 'Pule a pá do moinho, que gira cada vez mais rápido. Quem for varrido cai no rio!', mode: 'ffa', duration: 60, camera: 'arena', hud: 'alive' },
  flechas: { id: 'flechas', name: 'Chuva de Flechas', rule: 'Os arqueiros do castelo estão treinando! Fuja das sombras no chão. Cada um tem 3 vidas.', mode: 'ffa', duration: 60, camera: 'arena', hud: 'lives' },
  javali: { id: 'javali', name: 'Fúria do Javali', rule: 'O javali escolhe um alvo e dispara! Saia da frente na hora certa e não caia da ilha.', mode: 'ffa', duration: 60, camera: 'arena', hud: 'alive' },
  cerco: { id: 'cerco', name: 'Cerco ao Castelo', rule: 'As catapultas estão destruindo o pátio! Fuja das sombras das pedras e seja o último em pé.', mode: 'ffa', duration: 70, camera: 'arena', hud: 'alive' },
  bardo: { id: 'bardo', name: 'O Bardo Manda', rule: 'O bardo canta uma cor: corra para um piso dessa cor antes que os outros sumam!', mode: 'ffa', duration: 70, camera: 'arena', hud: 'alive' },
  tinta: { id: 'tinta', name: 'Tinta do Reino', rule: 'Pinte o chão com a sua cor andando por cima. Pegue os baldes para pintar mais. Ganha quem tiver mais pisos no fim!', mode: 'ffa', duration: 45, camera: 'arena', hud: 'score', unit: 'pisos' },
  lava: { id: 'lava', name: 'Maré de Lava', rule: 'A lava está subindo! Escale as colunas de pedra até o topo e não deixe ninguém te derrubar.', mode: 'ffa', duration: 60, camera: 'climb', hud: 'alive' },
  ladeira: { id: 'ladeira', name: 'Ladeira dos Barris', rule: 'Suba a ladeira até o topo! Pule ou desvie dos barris que vêm rolando.', mode: 'ffa', duration: 70, camera: 'follow', hud: 'race', finishZ: -58 },
  machados: { id: 'machados', name: 'Corredor dos Machados', rule: 'Atravesse a passarela sem cair: espere a hora certa de passar pelos machados que balançam!', mode: 'ffa', duration: 75, camera: 'follow', hud: 'race', finishZ: -66 },
  pastoreio: { id: 'pastoreio', name: 'Pastoreio', rule: 'Dois contra dois: assuste as ovelhas até o curral do seu time. Cada ovelha no curral vale 1 ponto!', mode: 'team', duration: 60, camera: 'field', hud: 'team', teamHint: 'O curral do seu time fica do seu lado do campo.' },
  estandarte: { id: 'estandarte', name: 'Captura do Estandarte', rule: 'Dois contra dois: pegue o estandarte do outro time e traga até a sua base. Empurre quem estiver levando o seu!', mode: 'team', duration: 70, camera: 'field', hud: 'team', teamHint: 'Sua base fica do seu lado do campo.' },
};

/** Times dos minijogos 2v2. */
export const TEAMS = {
  colors: ['#a3242f', '#2f5a8f'],
  names: ['Casa do Leão', 'Casa do Lobo'],
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
  teamColors: TEAMS.colors,
  teamNames: TEAMS.names,
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
    case 'coroa': return yardWorld(COROA.radius);
    case 'trono': return yardWorld(TRONO.radius);
    case 'potes': return yardWorld(POTES.radius);
    case 'colheita': return harvestWorld();
    case 'moinho': return millWorld();
    case 'flechas': return yardWorld(FLECHAS.radius);
    case 'javali': return islandWorld(JAVALI.radius);
    case 'cerco': return gridWorld(CERCO, v.tiles, t => t < 2);
    case 'bardo': return gridWorld(BARDO, v.tiles, t => t < BARDO_GONE);
    case 'tinta': return gridWorld(TINTA, v.tiles, () => true);
    case 'lava': return lavaWorld();
    case 'ladeira': return slopeWorld();
    case 'machados': return axeWorld();
    case 'pastoreio': return soccerWorld();
    case 'estandarte': return soccerWorld();
  }
}
