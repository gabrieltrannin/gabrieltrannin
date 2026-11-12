import type { ItemId } from './constants';
import type { PlayerInput } from './physics';

/** Fases da partida (state.phase). */
export type Phase = 'lobby' | 'order' | 'board' | 'minigame' | 'final' | 'podium';
/** Etapas do turno no tabuleiro (state.board.step). */
export type BoardStep = 'idle' | 'roll' | 'moving' | 'choose' | 'shop' | 'busy';
/** Etapas de um minijogo (state.mg.step). */
export type MinigameStep = 'intro' | 'countdown' | 'play' | 'result';

/** Nomes das mensagens trocadas pela sala. */
export const MSG = {
  // cliente → servidor
  ready: 'ready',
  settings: 'settings',
  start: 'start',
  character: 'character',
  chat: 'chat',
  input: 'input',
  roll: 'roll',
  useItem: 'useItem',
  choose: 'choose',
  shop: 'shop',
  orderRoll: 'orderRoll',
  mgReady: 'mgReady',
  again: 'again',
  pong: 'pong',
  // servidor → cliente
  ping: 'ping',
  said: 'said',
  hit: 'hit',
  fx: 'fx',
  boardRoll: 'b:roll',
  boardMove: 'b:move',
  boardCoins: 'b:coins',
  boardNote: 'b:note',
  boardCrown: 'b:crown',
  boardDuel: 'b:duel',
  boardTeleport: 'b:tp',
  orderResult: 'o:roll',
  mgResult: 'mg:result',
  bonus: 'final:bonus',
} as const;

/** Opções enviadas ao criar ou entrar numa sala. */
export interface JoinOptions {
  name: string;
  character: number;
  protocol: number;
}

export interface InputMsg extends PlayerInput {
  /** Número sequencial; o servidor devolve o último processado. */
  seq: number;
}

export interface SettingsMsg {
  rounds?: number;
  fillBots?: boolean;
  botLevel?: number;
}

export interface ChatMsg { kind: 'quick' | 'emote'; index: number }
export interface SaidMsg { from: string; text: string; emote: boolean }

export interface RollMsg { pid: string; dice: number[] }
export interface MoveMsg { pid: string; path: number[] }
export interface CoinsMsg { pid: string; delta: number }
export interface NoteMsg { text: string; tone: 'good' | 'bad' | 'info'; pid?: string }
export interface CrownMsg { pid: string }
export interface DuelMsg { a: string; b: string; ra: number; rb: number; winner: string | null; amount: number }
export interface TeleportMsg { pid: string; tile: number }
export interface OrderRollMsg { pid: string; value: number }
export interface UseItemMsg { index: number }
export interface ShopMsg { item: ItemId | null }

export interface HitMsg { attacker: string; target: string; x: number; y: number; z: number }
export interface FxMsg { kind: 'explode' | 'goal' | 'finish' | 'fall' | 'coin' | 'pass' | 'out'; x: number; y: number; z: number; pid?: string; team?: number }

export interface MgResultMsg {
  /** Grupos por colocação (empates no mesmo grupo). */
  ranking: string[][];
  rewards: Record<string, number>;
  teamScores?: number[];
  winnerTeam?: number | null;
}

export interface BonusMsg {
  bonuses: { title: string; desc: string; pids: string[] }[];
}
