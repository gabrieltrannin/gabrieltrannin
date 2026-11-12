import type { MinigameId } from '@fuzue/shared';
import type { GameRoom } from '../rooms/GameRoom.js';
import { Bomba } from './Bomba.js';
import { Chuva } from './Chuva.js';
import { Corrida } from './Corrida.js';
import { Futebol } from './Futebol.js';
import { Hexa } from './Hexa.js';
import type { Minigame } from './Minigame.js';
import { Ringue } from './Ringue.js';

export type { Minigame } from './Minigame.js';

const GAMES: Record<MinigameId, new (room: GameRoom) => Minigame> = {
  ringue: Ringue,
  hexa: Hexa,
  corrida: Corrida,
  chuva: Chuva,
  bomba: Bomba,
  futebol: Futebol,
};

export function createMinigame(id: MinigameId, room: GameRoom, ids: string[]): Minigame {
  const game = new GAMES[id](room);
  game.init(ids);
  return game;
}
