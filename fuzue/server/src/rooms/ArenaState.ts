import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

/**
 * Estado sincronizado automaticamente com todos os clientes.
 * O Colyseus envia só o que mudou (delta) a cada patch.
 */

export class PlayerState extends Schema {
  @type('string') name = '';
  @type('uint8') character = 0;

  // posição do centro da esfera de colisão
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('float32') z = 0;
  // velocidade no plano (o cliente precisa dela para reconciliar a previsão)
  @type('float32') vx = 0;
  @type('float32') vz = 0;

  @type('float32') face = 0;
  @type('float32') dashT = 0;
  @type('float32') dashCd = 0;
  @type('float32') stunT = 0;

  /** Último input processado pelo servidor. */
  @type('uint32') seq = 0;
  /** Ping medido pelo servidor (ms). */
  @type('uint16') ping = 0;
  @type('uint16') falls = 0;
  @type('uint16') hits = 0;
}

export class BallState extends Schema {
  @type('float32') r = 1;
  @type('float32') x = 0;
  @type('float32') y = 0;
  @type('float32') z = 0;
  @type('float32') qx = 0;
  @type('float32') qy = 0;
  @type('float32') qz = 0;
  @type('float32') qw = 1;
}

export class ArenaState extends Schema {
  @type('string') code = '';
  @type('string') hostId = '';
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([BallState]) balls = new ArraySchema<BallState>();
}
