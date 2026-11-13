import type { MinigameId } from '@fuzue/shared';
import type { GameRoom } from '../rooms/GameRoom.js';
import { Bardo } from './Bardo.js';
import { Bomba } from './Bomba.js';
import { Cerco } from './Cerco.js';
import { Chuva } from './Chuva.js';
import { Colheita } from './Colheita.js';
import { Coroa } from './Coroa.js';
import { Corrida } from './Corrida.js';
import { Estandarte } from './Estandarte.js';
import { Flechas } from './Flechas.js';
import { Futebol } from './Futebol.js';
import { Hexa } from './Hexa.js';
import { Javali } from './Javali.js';
import { Ladeira } from './Ladeira.js';
import { Lava } from './Lava.js';
import { Machados } from './Machados.js';
import type { Minigame } from './Minigame.js';
import { Moinho } from './Moinho.js';
import { Pastoreio } from './Pastoreio.js';
import { Potes } from './Potes.js';
import { Ringue } from './Ringue.js';
import { Tinta } from './Tinta.js';
import { Trono } from './Trono.js';

export type { Minigame } from './Minigame.js';

const GAMES: Record<MinigameId, new (room: GameRoom) => Minigame> = {
  ringue: Ringue,
  hexa: Hexa,
  corrida: Corrida,
  chuva: Chuva,
  bomba: Bomba,
  futebol: Futebol,
  coroa: Coroa,
  trono: Trono,
  potes: Potes,
  colheita: Colheita,
  moinho: Moinho,
  flechas: Flechas,
  javali: Javali,
  cerco: Cerco,
  bardo: Bardo,
  tinta: Tinta,
  lava: Lava,
  ladeira: Ladeira,
  machados: Machados,
  pastoreio: Pastoreio,
  estandarte: Estandarte,
};

export function createMinigame(id: MinigameId, room: GameRoom, ids: string[]): Minigame {
  const game = new GAMES[id](room);
  game.init(ids);
  return game;
}
