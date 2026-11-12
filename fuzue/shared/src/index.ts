/**
 * Código compartilhado entre servidor e cliente.
 *
 * Tudo o que precisa dar o MESMO resultado nos dois lados mora aqui:
 * constantes da simulação, regras de movimento e formato das mensagens.
 * O servidor usa `stepMove` para decidir a velocidade de cada jogador antes
 * de rodar a física (Rapier). O cliente usa a mesma função para prever o
 * próprio movimento sem esperar a resposta do servidor.
 */

/* ------------------------------------------------------------------ */
/* Simulação                                                           */
/* ------------------------------------------------------------------ */

/** Ticks de simulação por segundo (servidor e envio de inputs do cliente). */
export const TICK_RATE = 30;
/** Duração de um tick, em segundos. */
export const DT = 1 / TICK_RATE;
/** Máximo de jogadores por sala. */
export const MAX_PLAYERS = 4;
/** Nome da sala registrada no servidor Colyseus. */
export const ROOM_NAME = 'arena';
/** Raio da esfera de colisão do jogador (metros). */
export const PLAYER_RADIUS = 0.45;

export interface Pillar { x: number; z: number; r: number; h: number }

export const ARENA = {
  /** Raio da plataforma redonda. O topo dela fica em y = 0. */
  radius: 8,
  /** Abaixo desta altura o jogador conta uma queda e renasce. */
  killY: -8,
  /** Altura de onde o jogador cai ao renascer. */
  spawnY: 3.5,
  /** Gravidade (m/s²). Mais forte que a real para a queda ficar "pesada". */
  gravity: -22,
  /** Pilares fixos na arena (obstáculos). */
  pillars: [
    { x: -4.2, z: -2.2, r: 0.7, h: 1.6 },
    { x: 4.4, z: -1.6, r: 0.7, h: 1.6 },
    { x: 0.4, z: 4.6, r: 0.7, h: 1.6 },
  ] as Pillar[],
  /** Bolas gigantes empurráveis (sincronizadas pelo servidor). */
  balls: [
    { x: -1.8, z: 0.6, r: 1.0 },
    { x: 2.2, z: 2.0, r: 0.8 },
  ],
} as const;

export const MOVE = {
  /** Velocidade máxima andando (m/s). */
  maxSpeed: 6,
  /** Aceleração em direção à velocidade desejada (m/s²). */
  accel: 45,
  /** Aceleração enquanto atordoado: o boneco "escorrega". */
  stunAccel: 5,
  /** Impulso do empurrão (m/s somados na direção que o boneco olha). */
  dashSpeed: 8,
  /** Quanto tempo dura o empurrão (s). Durante ele o jogador não freia. */
  dashTime: 0.2,
  /** Tempo de recarga do empurrão (s). */
  dashCooldown: 0.9,
  /** Distância entre centros para o empurrão acertar alguém (m). */
  hitRange: 1.2,
  /** Velocidade com que o alvo é arremessado (m/s). */
  knockback: 10.5,
  /** Velocidade vertical do arremesso (m/s). */
  knockUp: 4.5,
  /** Quanto tempo o alvo fica atordoado (s). */
  stunTime: 0.65,
} as const;

/* ------------------------------------------------------------------ */
/* Personagens                                                         */
/* ------------------------------------------------------------------ */

export type CritterKind = 'urso' | 'coelho' | 'gato' | 'axolote' | 'pinguim' | 'ovelha';

export interface CharacterDef {
  name: string;
  kind: CritterKind;
  /** Cor principal (hex CSS). */
  color: string;
  /** Cor da barriga e detalhes claros. */
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

/* ------------------------------------------------------------------ */
/* Mensagens                                                           */
/* ------------------------------------------------------------------ */

/** Opções enviadas ao criar ou entrar numa sala. */
export interface JoinOptions {
  name: string;
  character: number;
}

/** Input enviado pelo cliente a cada tick. */
export interface InputMsg {
  /** Número sequencial; o servidor devolve o último processado em `seq`. */
  seq: number;
  /** Direção desejada no plano (-1..1). x = direita, z = para a câmera. */
  x: number;
  z: number;
  /** Apertou o botão de empurrar neste tick. */
  push: boolean;
}

/** Servidor → cliente quando um empurrão acerta alguém. */
export interface HitMsg {
  attacker: string;
  target: string;
  x: number;
  y: number;
  z: number;
}

/** Nomes das mensagens trocadas pela sala. */
export const MSG = {
  input: 'input',
  ping: 'ping',
  pong: 'pong',
  hit: 'hit',
} as const;

/* ------------------------------------------------------------------ */
/* Regras de movimento (determinísticas)                               */
/* ------------------------------------------------------------------ */

/** Estado mínimo de movimento de um jogador no plano. */
export interface MoveState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Para onde o boneco olha (radianos, 0 = +z). */
  face: number;
  dashT: number;
  dashCd: number;
  stunT: number;
}

/** Limita a direção do input a comprimento 1 e descarta valores inválidos. */
export function clampInput(x: number, z: number): { x: number; z: number } {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: 0, z: 0 };
  const len = Math.hypot(x, z);
  if (len > 1) return { x: x / len, z: z / len };
  return { x, z };
}

/**
 * Aplica um tick de input à velocidade do jogador.
 * Não move a posição: no servidor quem move é a física (Rapier);
 * no cliente quem move é `integrate`.
 * Retorna true se o jogador começou um empurrão neste tick.
 */
export function stepMove(s: MoveState, input: Pick<InputMsg, 'x' | 'z' | 'push'>, dt: number = DT): boolean {
  s.dashCd = Math.max(0, s.dashCd - dt);
  s.dashT = Math.max(0, s.dashT - dt);
  s.stunT = Math.max(0, s.stunT - dt);

  const dir = clampInput(input.x, input.z);
  const strength = Math.hypot(dir.x, dir.z);
  const stunned = s.stunT > 0;
  if (!stunned && strength > 0.1) s.face = Math.atan2(dir.x, dir.z);

  let dashed = false;
  if (input.push && !stunned && s.dashCd <= 0) {
    s.vx += Math.sin(s.face) * MOVE.dashSpeed;
    s.vz += Math.cos(s.face) * MOVE.dashSpeed;
    s.dashT = MOVE.dashTime;
    s.dashCd = MOVE.dashCooldown;
    dashed = true;
  }

  if (s.dashT <= 0) {
    const tx = stunned ? 0 : dir.x * MOVE.maxSpeed;
    const tz = stunned ? 0 : dir.z * MOVE.maxSpeed;
    const a = (stunned ? MOVE.stunAccel : MOVE.accel) * dt;
    const dx = tx - s.vx;
    const dz = tz - s.vz;
    const d = Math.hypot(dx, dz);
    if (d <= a) { s.vx = tx; s.vz = tz; }
    else { s.vx += (dx / d) * a; s.vz += (dz / d) * a; }
  }
  return dashed;
}

/** Move a posição pela velocidade (usado na previsão do cliente). */
export function integrate(s: MoveState, dt: number = DT): void {
  s.x += s.vx * dt;
  s.z += s.vz * dt;
}

/**
 * Empurra o jogador para fora dos pilares fixos.
 * O servidor resolve isso com a física; o cliente usa esta versão simples
 * para a previsão não atravessar pilares.
 */
export function resolvePillars(s: MoveState): void {
  for (const p of ARENA.pillars) {
    const dx = s.x - p.x;
    const dz = s.z - p.z;
    const d = Math.hypot(dx, dz);
    const min = p.r + PLAYER_RADIUS;
    if (d < min && d > 1e-6) {
      const nx = dx / d;
      const nz = dz / d;
      s.x = p.x + nx * min;
      s.z = p.z + nz * min;
      const vn = s.vx * nx + s.vz * nz;
      if (vn < 0) { s.vx -= vn * nx; s.vz -= vn * nz; }
    }
  }
}

/** Ponto aleatório perto do centro da arena para (re)nascer. */
export function spawnPoint(rand: () => number = Math.random): { x: number; z: number } {
  const a = rand() * Math.PI * 2;
  const r = 1 + rand() * 2.5;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

/* ------------------------------------------------------------------ */
/* Salas                                                               */
/* ------------------------------------------------------------------ */

/** Caracteres dos códigos de sala (sem I, O, 0 e 1, que se confundem). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

/** Normaliza o que o jogador digitou ("k7 qx" → "K7QX") e valida. */
export function normalizeCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** Limpa o apelido: sem espaços duplicados, até 16 caracteres. */
export function sanitizeName(raw: unknown): string {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return name || 'Jogador';
}
