/**
 * Constantes do jogo usadas pelo servidor e pelo cliente.
 * Mudou algo aqui? Os dois lados passam a usar o novo valor.
 */

/**
 * Versão do "idioma" entre cliente e servidor. Suba este número sempre que
 * mudar mensagens ou estado de um jeito incompatível: quem estiver com a
 * página antiga aberta é avisado para recarregar.
 */
export const PROTOCOL_VERSION = 2;

/** Ticks de simulação por segundo. */
export const TICK_RATE = 30;
/** Duração de um tick, em segundos. */
export const DT = 1 / TICK_RATE;
/** Jogadores por partida (humanos + bots). */
export const MAX_PLAYERS = 4;
/** Nome da sala registrada no servidor. */
export const ROOM_NAME = 'fuzue';

/* ---------------- personagens ---------------- */

export type CritterKind = 'urso' | 'coelho' | 'gato' | 'axolote' | 'pinguim' | 'ovelha';

export interface CharacterDef {
  name: string;
  kind: CritterKind;
  color: string;
  belly: string;
}

export const CHARACTERS: CharacterDef[] = [
  { name: 'Bolota', kind: 'urso', color: '#ff8a3d', belly: '#ffe2c2' },
  { name: 'Pipoca', kind: 'coelho', color: '#ff9cc8', belly: '#fff0f6' },
  { name: 'Tufo', kind: 'gato', color: '#35c9b9', belly: '#dcfff8' },
  { name: 'Brisa', kind: 'axolote', color: '#a8e063', belly: '#f3ffdf' },
  { name: 'Pingo', kind: 'pinguim', color: '#4a8dff', belly: '#f4f8ff' },
  { name: 'Nuvem', kind: 'ovelha', color: '#b49cff', belly: '#fff8ee' },
];

/* ---------------- bots ---------------- */

export const BOT_NAMES = ['Paçoca', 'Brigadeiro', 'Cocada', 'Quindim', 'Cajuzinho', 'Jujuba'];
export const BOT_LEVELS = ['Fácil', 'Médio', 'Difícil'] as const;

/* ---------------- partida ---------------- */

export const ROUND_OPTIONS = [5, 10, 15, 20] as const;
export const DEFAULT_ROUNDS = 10;
export const START_COINS = 10;
export const CROWN_PRICE = 20;
/** Tempo de cada pulinho de casa em casa no tabuleiro (ms). */
export const HOP_MS = 260;

/** Moedas por colocação nos minijogos de todos contra todos. */
export const FFA_REWARDS = [10, 6, 3, 0];
/** Moedas para cada jogador do time vencedor / em caso de empate. */
export const TEAM_WIN_REWARD = 8;
export const TEAM_DRAW_REWARD = 3;

/* ---------------- itens ---------------- */

export type ItemId = 'dado2' | 'luva' | 'bomba' | 'escudo' | 'ima' | 'troca';

export interface ItemDef {
  name: string;
  price: number;
  icon: string;
  /** Frase curta mostrada na loja e na mochila. */
  desc: string;
  /** Itens passivos não têm botão de usar (funcionam sozinhos). */
  passive?: boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  dado2: { name: 'Dado duplo', price: 5, icon: '🎲', desc: 'Rola dois dados neste turno.' },
  luva: { name: 'Luva de boxe', price: 6, icon: '🥊', desc: 'Rouba 5 moedas de quem tem mais.' },
  bomba: { name: 'Bomba-armadilha', price: 4, icon: '💣', desc: 'Deixa uma bomba na sua casa: quem parar nela perde 8 moedas.' },
  escudo: { name: 'Escudo', price: 5, icon: '🛡️', desc: 'Bloqueia a próxima perda de moedas.', passive: true },
  ima: { name: 'Ímã de moedas', price: 6, icon: '🧲', desc: 'Ganha 1 moeda por casa andada neste turno.' },
  troca: { name: 'Troca de lugar', price: 8, icon: '🔀', desc: 'Troca de lugar com quem está mais perto da coroa.' },
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const MAX_ITEMS = 3;

/* ---------------- conversa ---------------- */

export const QUICK_CHAT = ['Boa!', 'Nãooo', 'kkkkk', 'Vem pro x1', 'Me ajuda!', 'GG'];
export const EMOTES = ['😂', '😭', '🔥', '👑', '😈', '👏'];

/* ---------------- salas ---------------- */

/** Caracteres dos códigos de sala (sem I, O, 0 e 1, que se confundem). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;
