import { DT } from './constants';

/**
 * Física dos bonecos, igual no servidor e no cliente.
 *
 * O servidor roda `stepPlayer` para decidir onde cada um está de verdade.
 * O cliente roda a MESMA função no próprio boneco para ele responder na hora
 * (previsão). Por isso tudo aqui precisa ser determinístico: nada de
 * Math.random, nada de relógio.
 */

/** Raio horizontal do boneco (m). */
export const PLAYER_RADIUS = 0.45;
/** Altura aproximada do boneco (m). */
export const PLAYER_HEIGHT = 1.4;

export const MOVE = {
  /** Velocidade máxima andando (m/s). */
  maxSpeed: 6,
  /** Aceleração no chão em direção à velocidade desejada (m/s²). */
  accel: 45,
  /** Aceleração no ar. */
  airAccel: 22,
  /** Aceleração em chão escorregadio (gelo). */
  slipperyAccel: 13,
  /** Aceleração enquanto atordoado: o boneco "desliza". */
  stunAccel: 5,
  /** Impulso do empurrão (m/s somados na direção do olhar). */
  dashSpeed: 8,
  dashTime: 0.2,
  dashCooldown: 0.9,
  /** Velocidade inicial do pulo (m/s). */
  jumpSpeed: 8.6,
  gravity: -25,
  /** Distância entre centros para o empurrão acertar alguém (m). */
  hitRange: 1.2,
  knockback: 10.5,
  knockUp: 5,
  stunTime: 0.65,
} as const;

export interface Body {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Para onde olha (rad; 0 = +z). */
  face: number;
  dashT: number;
  dashCd: number;
  stunT: number;
  grounded: boolean;
  /** Multiplicador de velocidade (ex.: quem segura a bomba corre mais). */
  boost: number;
}

export interface PlayerInput {
  /** Direção no plano (-1..1). x = direita, z = para a câmera. */
  x: number;
  z: number;
  push: boolean;
  jump: boolean;
}

export const IDLE_INPUT: PlayerInput = { x: 0, z: 0, push: false, jump: false };

export interface Pillar { x: number; z: number; r: number; h: number }

/** Descrição do mundo de um minijogo para a física. */
export interface WorldDef {
  /**
   * Altura do chão sólido em (x, z) abaixo da altura `y`, ou null se não
   * há chão (buraco, fora da arena).
   */
  ground(x: number, z: number, y: number): number | null;
  /** Cilindros fixos que bloqueiam a passagem. */
  pillars?: readonly Pillar[];
  /** Paredes invisíveis (ex.: campo de futebol). Ajusta a posição. */
  bounds?(b: Body): void;
  /** Esteira rolante: velocidade extra do chão em (x, z). */
  conveyor?(x: number, z: number): { x: number; z: number } | null;
  /** Chão de gelo. */
  slippery?: boolean;
}

export function newBody(x: number, y: number, z: number, face = 0): Body {
  return { x, y, z, vx: 0, vy: 0, vz: 0, face, dashT: 0, dashCd: 0, stunT: 0, grounded: true, boost: 1 };
}

export function copyBody(from: Body, to: Body): Body {
  to.x = from.x; to.y = from.y; to.z = from.z;
  to.vx = from.vx; to.vy = from.vy; to.vz = from.vz;
  to.face = from.face; to.dashT = from.dashT; to.dashCd = from.dashCd; to.stunT = from.stunT;
  to.grounded = from.grounded; to.boost = from.boost;
  return to;
}

/** Limita a direção a comprimento 1 e descarta valores inválidos. */
export function clampInput(x: number, z: number): { x: number; z: number } {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: 0, z: 0 };
  const len = Math.hypot(x, z);
  return len > 1 ? { x: x / len, z: z / len } : { x, z };
}

/**
 * Um tick de física de um boneco.
 * Retorna se ele começou um empurrão ou um pulo neste tick.
 */
export function stepPlayer(b: Body, input: PlayerInput, world: WorldDef, dt: number = DT): { dashed: boolean; jumped: boolean } {
  b.dashCd = Math.max(0, b.dashCd - dt);
  b.dashT = Math.max(0, b.dashT - dt);
  b.stunT = Math.max(0, b.stunT - dt);

  const dir = clampInput(input.x, input.z);
  const strength = Math.hypot(dir.x, dir.z);
  const stunned = b.stunT > 0;
  if (!stunned && strength > 0.1) b.face = Math.atan2(dir.x, dir.z);

  let dashed = false;
  if (input.push && !stunned && b.dashCd <= 0) {
    b.vx += Math.sin(b.face) * MOVE.dashSpeed;
    b.vz += Math.cos(b.face) * MOVE.dashSpeed;
    b.dashT = MOVE.dashTime;
    b.dashCd = MOVE.dashCooldown;
    dashed = true;
  }

  let jumped = false;
  if (input.jump && !stunned && b.grounded) {
    b.vy = MOVE.jumpSpeed;
    b.grounded = false;
    jumped = true;
  }

  if (b.dashT <= 0) {
    const max = MOVE.maxSpeed * (b.boost || 1);
    const tx = stunned ? 0 : dir.x * max;
    const tz = stunned ? 0 : dir.z * max;
    const accel = stunned ? MOVE.stunAccel : !b.grounded ? MOVE.airAccel : world.slippery ? MOVE.slipperyAccel : MOVE.accel;
    const a = accel * dt;
    const dx = tx - b.vx;
    const dz = tz - b.vz;
    const d = Math.hypot(dx, dz);
    if (d <= a) { b.vx = tx; b.vz = tz; }
    else { b.vx += (dx / d) * a; b.vz += (dz / d) * a; }
  }

  b.vy += MOVE.gravity * dt;
  const prevY = b.y;
  b.x += b.vx * dt;
  b.z += b.vz * dt;
  b.y += b.vy * dt;

  if (b.grounded && world.conveyor) {
    const c = world.conveyor(b.x, b.z);
    if (c) { b.x += c.x * dt; b.z += c.z * dt; }
  }

  if (world.pillars) resolvePillars(b, world.pillars, prevY);
  world.bounds?.(b);

  const g = world.ground(b.x, b.z, Math.max(prevY, b.y));
  if (g !== null && b.vy <= 0 && b.y <= g && prevY >= g - 0.35) {
    b.y = g;
    b.vy = 0;
    b.grounded = true;
  } else {
    b.grounded = false;
  }
  return { dashed, jumped };
}

/**
 * Empurra o boneco para fora dos pilares. `prevY` é a altura no tick anterior:
 * quem vinha de cima está pousando no topo, não batendo na lateral.
 */
export function resolvePillars(b: Body, pillars: readonly Pillar[], prevY = b.y): void {
  for (const p of pillars) {
    if (Math.max(b.y, prevY) > p.h - 0.05) continue; // passando por cima ou pousando
    const dx = b.x - p.x;
    const dz = b.z - p.z;
    const d = Math.hypot(dx, dz);
    const min = p.r + PLAYER_RADIUS;
    if (d < min && d > 1e-6) {
      const nx = dx / d;
      const nz = dz / d;
      b.x = p.x + nx * min;
      b.z = p.z + nz * min;
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) { b.vx -= vn * nx; b.vz -= vn * nz; }
    }
  }
}

/** Mantém o boneco dentro de um círculo (paredes invisíveis). */
export function clampToCircle(b: Body, radius: number): void {
  const d = Math.hypot(b.x, b.z);
  const max = radius - PLAYER_RADIUS;
  if (d > max) {
    const nx = b.x / d;
    const nz = b.z / d;
    b.x = nx * max;
    b.z = nz * max;
    const vn = b.vx * nx + b.vz * nz;
    if (vn > 0) { b.vx -= vn * nx; b.vz -= vn * nz; }
  }
}

/**
 * Colisão entre dois bonecos (só no servidor): separa e troca velocidade
 * ao longo da linha entre eles, com um pouco de quique.
 */
export function separateBodies(a: Body, b: Body): boolean {
  if (Math.abs(a.y - b.y) > 1.1) return false;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const min = PLAYER_RADIUS * 2;
  if (d >= min || d < 1e-5) return false;
  const nx = dx / d;
  const nz = dz / d;
  const ov = (min - d) / 2;
  a.x -= nx * ov; a.z -= nz * ov;
  b.x += nx * ov; b.z += nz * ov;
  const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (rel < 0) {
    const j = (-(1 + 0.6) * rel) / 2;
    a.vx -= j * nx; a.vz -= j * nz;
    b.vx += j * nx; b.vz += j * nz;
  }
  return true;
}
