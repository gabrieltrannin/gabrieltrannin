/**
 * Constantes do jogo usadas pelo servidor e pelo cliente.
 * Mudou algo aqui? Os dois lados passam a usar o novo valor.
 */

/**
 * Versão do "idioma" entre cliente e servidor. Suba este número sempre que
 * mudar mensagens ou estado de um jeito incompatível: quem estiver com a
 * página antiga aberta é avisado para recarregar.
 */
export const PROTOCOL_VERSION = 3;
/**
 * Clientes a partir desta versão ainda entram (só jogam os minijogos
 * clássicos, que eles conhecem).
 */
export const MIN_PROTOCOL = 2;

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
/** Papel medieval: define a roupa e os acessórios do bichinho. */
export type CritterRole = 'cavaleiro' | 'bruxa' | 'arqueiro' | 'bobo' | 'viking' | 'frade';

export interface CharacterDef {
  name: string;
  /** "o cavaleiro", "a bruxa"… */
  title: string;
  kind: CritterKind;
  role: CritterRole;
  /** Cor da roupa: é a cor do personagem na interface. */
  color: string;
  /** Detalhes da roupa (bordas, emblema, cordão). */
  trim: string;
  /** Pelo/pele do bichinho. */
  fur: string;
  /** Barriga, focinho e partes claras. */
  belly: string;
}

export const CHARACTERS: CharacterDef[] = [
  { name: 'Bolota', title: 'o cavaleiro', kind: 'urso', role: 'cavaleiro', color: '#2f5a8f', trim: '#c9a227', fur: '#8b5e3c', belly: '#d9b48a' },
  { name: 'Pipoca', title: 'a bruxa', kind: 'coelho', role: 'bruxa', color: '#5c3d7a', trim: '#c9a227', fur: '#d4c6b2', belly: '#f1e9dc' },
  { name: 'Tufo', title: 'o arqueiro', kind: 'gato', role: 'arqueiro', color: '#3f6b3a', trim: '#6b4a2f', fur: '#7d7f86', belly: '#d6d2c8' },
  { name: 'Brisa', title: 'a boba da corte', kind: 'axolote', role: 'bobo', color: '#b5651d', trim: '#2f5a8f', fur: '#c98f97', belly: '#efd9d4' },
  { name: 'Pingo', title: 'o viking', kind: 'pinguim', role: 'viking', color: '#8e2430', trim: '#7a5a3a', fur: '#3d4654', belly: '#ece6da' },
  { name: 'Nuvem', title: 'o frade', kind: 'ovelha', role: 'frade', color: '#6b4a2f', trim: '#d8c08a', fur: '#5f4f46', belly: '#ece4d2' },
];

/* ---------------- bots ---------------- */

export const BOT_NAMES = ['Sir Rufus', 'Dama Brígida', 'Mestre Odo', 'Irmão Bento', 'Lady Elvira', 'Barão Tibério'];
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
  /** Frase curta mostrada no mercador e na bolsa. */
  desc: string;
  /** Itens passivos não têm botão de usar (funcionam sozinhos). */
  passive?: boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  dado2: { name: 'Dados viciados', price: 5, icon: '🎲', desc: 'Rola dois dados neste turno.' },
  luva: { name: 'Manopla', price: 6, icon: '🤛', desc: 'Toma 5 moedas de quem tem mais.' },
  bomba: { name: 'Armadilha de pólvora', price: 4, icon: '💣', desc: 'Esconde pólvora na sua casa: quem parar nela perde 8 moedas.' },
  escudo: { name: 'Escudo', price: 5, icon: '🛡️', desc: 'Bloqueia a próxima perda de moedas.', passive: true },
  ima: { name: 'Bolsa do mercador', price: 6, icon: '💰', desc: 'Ganha 1 moeda por casa andada neste turno.' },
  troca: { name: 'Pergaminho de troca', price: 8, icon: '📜', desc: 'Troca de lugar com quem está mais perto da coroa.' },
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const MAX_ITEMS = 3;

/* ---------------- conversa ---------------- */

export const QUICK_CHAT = ['Pela coroa!', 'Nãooo', 'kkkkk', 'Te desafio!', 'Socorro!', 'GG'];
export const EMOTES = ['😂', '😭', '⚔️', '👑', '🍺', '🛡️'];

/* ---------------- salas ---------------- */

/** Caracteres dos códigos de sala (sem I, O, 0 e 1, que se confundem). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;
