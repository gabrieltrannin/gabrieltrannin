import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { DEFAULT_ROUNDS, START_COINS, START_TILE } from '@fuzue/shared';

/**
 * Estado sincronizado automaticamente com todos os clientes.
 * O Colyseus envia só o que mudou a cada patch (30 por segundo).
 */

export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('uint8') character = 0;
  /** Vaga preenchida por bot. */
  @type('boolean') bot = false;
  /** Humano desconectado: um bot joga por ele até voltar. */
  @type('boolean') away = false;
  @type('boolean') ready = false;
  @type('uint16') ping = 0;
  /** Lugar no lobby (ordem de chegada). */
  @type('uint8') seat = 0;

  // tabuleiro
  @type('uint8') tile = START_TILE;
  @type('int16') coins = START_COINS;
  @type('uint8') crowns = 0;
  @type(['string']) items = new ArraySchema<string>();
  @type('boolean') shield = false;
  /** Colocação final (1 = campeão). */
  @type('uint8') place = 0;
}

export class BoardState extends Schema {
  @type('uint8') round = 1;
  /** Ordem dos turnos (ids). */
  @type(['string']) order = new ArraySchema<string>();
  /** Índice em `order` de quem está jogando. */
  @type('uint8') turn = 0;
  @type('string') step = 'idle';
  @type('uint8') crownTile = 0;
  /** Bombas-armadilha: casa → dono. */
  @type({ map: 'string' }) bombs = new MapSchema<string>();
  /** Hora do servidor (ms) em que a decisão atual vence. */
  @type('number') deadline = 0;
  /** Opções numa bifurcação. */
  @type(['uint8']) choices = new ArraySchema<number>();
  /** Itens à venda na loja agora. */
  @type(['string']) shopOffer = new ArraySchema<string>();
  /** Fase "quem começa": número tirado por cada um. */
  @type({ map: 'uint8' }) orderRolls = new MapSchema<number>();
}

export class MgPlayer extends Schema {
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('float32') z = 0;
  @type('float32') vx = 0;
  @type('float32') vy = 0;
  @type('float32') vz = 0;
  @type('float32') face = 0;
  @type('float32') dashT = 0;
  @type('float32') dashCd = 0;
  @type('float32') stunT = 0;
  @type('float32') boost = 1;
  @type('boolean') grounded = true;
  /** Último input processado. */
  @type('uint32') seq = 0;
  @type('boolean') alive = true;
  @type('boolean') finished = false;
  @type('int16') score = 0;
  @type('int8') team = -1;
  /** Apertou "Pronto" na tela de instruções. */
  @type('boolean') ready = false;
}

export class MgEntity extends Schema {
  @type('string') kind = '';
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('float32') z = 0;
  /** Ângulo ou rotação. */
  @type('float32') a = 0;
  /** Valor extra (ex.: valor da moeda, velocidade do martelo). */
  @type('float32') s = 0;
}

export class MinigameState extends Schema {
  @type('string') id = '';
  @type('string') step = 'intro';
  /** Hora do servidor (ms) em que a etapa atual termina. */
  @type('number') stepEnds = 0;
  @type({ map: MgPlayer }) players = new MapSchema<MgPlayer>();
  @type({ map: MgEntity }) entities = new MapSchema<MgEntity>();
  /** Pisos do "Chão que Some" (0 inteiro, 1 rachando, 2 caiu). */
  @type(['uint8']) tiles = new ArraySchema<number>();
  /** Raio atual do ringue. */
  @type('float32') radius = 0;
  /** Quem está com a bomba. */
  @type('string') holder = '';
  @type('float32') fuse = 0;
  @type(['int16']) teamScore = new ArraySchema<number>();
  /** Tempo de jogo decorrido (s). */
  @type('float32') time = 0;
}

export class GameState extends Schema {
  @type('string') code = '';
  @type('string') hostId = '';
  @type('string') phase = 'lobby';
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  // configurações do anfitrião
  @type('uint8') rounds = DEFAULT_ROUNDS;
  @type('boolean') fillBots = true;
  @type('uint8') botLevel = 1;
  @type(BoardState) board = new BoardState();
  @type(MinigameState) mg = new MinigameState();
}
