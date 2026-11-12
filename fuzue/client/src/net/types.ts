import type { BoardStep, MinigameId, MinigameStep, Phase } from '@fuzue/shared';

/**
 * Formato do estado que chega do servidor. O cliente lê por reflexão
 * (sem as classes do servidor), então descrevemos aqui só o que usamos.
 */

export interface MapLike<T> {
  get(key: string): T | undefined;
  has(key: string): boolean;
  forEach(cb: (value: T, key: string) => void): void;
  readonly size: number;
}

export interface ArrayLikeSchema<T> {
  readonly length: number;
  [index: number]: T;
  forEach(cb: (value: T, index: number) => void): void;
}

export interface NetPlayer {
  id: string;
  name: string;
  character: number;
  bot: boolean;
  away: boolean;
  ready: boolean;
  ping: number;
  seat: number;
  tile: number;
  coins: number;
  crowns: number;
  items: ArrayLikeSchema<string>;
  shield: boolean;
  place: number;
}

export interface NetBoard {
  round: number;
  order: ArrayLikeSchema<string>;
  turn: number;
  step: BoardStep;
  crownTile: number;
  bombs: MapLike<string>;
  deadline: number;
  choices: ArrayLikeSchema<number>;
  shopOffer: ArrayLikeSchema<string>;
  orderRolls: MapLike<number>;
}

export interface NetMgPlayer {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  face: number; dashT: number; dashCd: number; stunT: number; boost: number;
  grounded: boolean;
  seq: number;
  alive: boolean;
  finished: boolean;
  score: number;
  team: number;
  ready: boolean;
}

export interface NetEntity { kind: string; x: number; y: number; z: number; a: number; s: number }

export interface NetMinigame {
  id: MinigameId | '';
  step: MinigameStep;
  stepEnds: number;
  players: MapLike<NetMgPlayer>;
  entities: MapLike<NetEntity>;
  tiles: ArrayLikeSchema<number>;
  radius: number;
  holder: string;
  fuse: number;
  teamScore: ArrayLikeSchema<number>;
  time: number;
}

export interface NetState {
  code: string;
  hostId: string;
  phase: Phase;
  players: MapLike<NetPlayer>;
  rounds: number;
  fillBots: boolean;
  botLevel: number;
  board: NetBoard;
  mg: NetMinigame;
}

/** Jogadores ordenados pelo lugar no lobby. */
export function playersBySeat(s: NetState): NetPlayer[] {
  const list: NetPlayer[] = [];
  s.players.forEach(p => list.push(p));
  return list.sort((a, b) => a.seat - b.seat);
}

/** Classificação no tabuleiro: coroas, depois moedas. */
export function ranking(s: NetState): NetPlayer[] {
  return playersBySeat(s).sort((a, b) => b.crowns - a.crowns || b.coins - a.coins);
}
