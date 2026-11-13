import { clampToCircle, PLAYER_RADIUS, type Body, type Pillar, type WorldDef } from './physics';

/**
 * Mundos dos minijogos novos (os clássicos ficam em minigames.ts).
 * Tudo aqui é usado igual pelo servidor e pela previsão do cliente.
 */

/* ---------------- arenas redondas com muro ---------------- */

export const COROA = { radius: 8.5, holderBoost: 0.92, grabDelay: 0.7 };
export const TRONO = { radius: 9, zoneR: 2.3, moveEvery: 8 };
export const POTES = { radius: 9, count: 9, breakRange: 1.25 };
export const FLECHAS = { radius: 9, lives: 3, fallSpeed: 18, hitR: 1.05 };

/** Chão plano com muro redondo (e pilares opcionais). */
export function yardWorld(radius: number, pillars?: Pillar[]): WorldDef {
  return {
    ground: (_x, _z, y) => (y >= -0.35 ? 0 : null),
    bounds: (b: Body) => clampToCircle(b, radius),
    pillars,
  };
}

/* ---------------- Colheita ---------------- */

export const COLHEITA = { radius: 10, cartR: 1.3, deliverR: 2.5, carryBoost: 0.85, pumpkins: 6 };
const CART: Pillar[] = [{ x: 0, z: 0, r: COLHEITA.cartR, h: 1.7 }];
export function harvestWorld(): WorldDef {
  return yardWorld(COLHEITA.radius, CART);
}

/* ---------------- ilhas sem muro (cair = sair) ---------------- */

export const MOINHO = { radius: 7.4, hubR: 0.75, armLen: 7.6, armTop: 0.7, killY: -4 };
export const JAVALI = { radius: 9.5, killY: -4, boarR: 0.9 };

/** Chão redondo sem muro, com pilares opcionais. */
export function islandWorld(radius: number, pillars?: Pillar[]): WorldDef {
  return {
    ground: (x, z, y) => (y >= -0.35 && x * x + z * z <= radius * radius ? 0 : null),
    pillars,
  };
}

const HUB: Pillar[] = [{ x: 0, z: 0, r: MOINHO.hubR, h: 6 }];
export function millWorld(): WorldDef {
  return islandWorld(MOINHO.radius, HUB);
}

/** Ângulo da pá do moinho: gira cada vez mais rápido (1,1 → 2,7 rad/s). */
export function millAngle(t: number, duration: number): number {
  return 1.1 * t + (0.8 * t * t) / Math.max(1, duration);
}

/** Velocidade da pá (rad/s) no tempo t. */
export function millSpeed(t: number, duration: number): number {
  return 1.1 + (1.6 * t) / Math.max(1, duration);
}

/* ---------------- grades de pisos quadrados ---------------- */

export interface Grid { n: number; cell: number }

export const CERCO = { n: 9, cell: 2, killY: -6 } as const;
export const BARDO = { n: 8, cell: 2, colors: 4, killY: -6 } as const;
export const TINTA = { n: 10, cell: 1.6, buckets: 2 } as const;

/** Cores do Bardo (vermelho, azul, verde, ouro) e seus nomes. */
export const BARDO_COLORS = ['#b8323f', '#2f64a8', '#3f8a3a', '#d9a520'];
export const BARDO_NAMES = ['VERMELHO', 'AZUL', 'VERDE', 'DOURADO'];
/** Piso do bardo: cor 0..3; somado a 4 quando sumiu. */
export const BARDO_GONE = 4;

export function gridHalf(g: Grid): number {
  return (g.n * g.cell) / 2;
}

/** Índice do piso em (x, z), ou -1 fora da grade. */
export function gridIndexAt(g: Grid, x: number, z: number): number {
  const h = gridHalf(g);
  const cx = Math.floor((x + h) / g.cell);
  const cz = Math.floor((z + h) / g.cell);
  if (cx < 0 || cz < 0 || cx >= g.n || cz >= g.n) return -1;
  return cz * g.n + cx;
}

export function gridCenter(g: Grid, i: number): { x: number; z: number } {
  const h = gridHalf(g);
  return { x: -h + ((i % g.n) + 0.5) * g.cell, z: -h + (Math.floor(i / g.n) + 0.5) * g.cell };
}

/** Grade com muro em volta: só se cai pelos buracos. */
export function gridWorld(g: Grid, tiles: ArrayLike<number>, solid: (v: number) => boolean): WorldDef {
  const lim = gridHalf(g) - PLAYER_RADIUS;
  return {
    ground: (x, z, y) => {
      if (y < -0.35) return null;
      const i = gridIndexAt(g, x, z);
      if (i < 0) return null;
      return solid(tiles[i] ?? 0) ? 0 : null;
    },
    bounds: (b: Body) => {
      if (b.y < -0.3) return;
      if (b.x > lim) { b.x = lim; if (b.vx > 0) b.vx = 0; }
      if (b.x < -lim) { b.x = -lim; if (b.vx < 0) b.vx = 0; }
      if (b.z > lim) { b.z = lim; if (b.vz > 0) b.vz = 0; }
      if (b.z < -lim) { b.z = -lim; if (b.vz < 0) b.vz = 0; }
    },
  };
}

/* ---------------- Maré de Lava ---------------- */

export const LAVA = { floorR: 9.5, start: -0.7, end: 5.6, killMargin: 0.15 };

/** Duas espirais de colunas subindo até a plataforma do topo. */
export const LAVA_COLUMNS: Pillar[] = (() => {
  const out: Pillar[] = [];
  for (const offset of [0, Math.PI]) {
    for (let i = 0; i < 13; i++) {
      const a = offset + i * 0.62;
      const r = 7.4 - i * 0.36;
      out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: 1.15, h: 0.55 + i * 0.42 });
    }
  }
  out.push({ x: 0, z: 0, r: 1.9, h: 6.1 });
  return out;
})();

export function lavaWorld(): WorldDef {
  return {
    ground: (x, z, y) => {
      let best: number | null = null;
      for (const c of LAVA_COLUMNS) {
        if (c.h > y + 0.35) continue;
        const dx = x - c.x;
        const dz = z - c.z;
        if (dx * dx + dz * dz <= c.r * c.r && (best === null || c.h > best)) best = c.h;
      }
      if (best !== null) return best;
      return y >= -0.35 && x * x + z * z <= LAVA.floorR * LAVA.floorR ? 0 : null;
    },
    pillars: LAVA_COLUMNS,
  };
}

/** Altura da lava: sobe devagar no começo e acelera. */
export function lavaLevel(t: number, duration: number): number {
  const k = Math.min(1, t / Math.max(1, duration));
  return LAVA.start + (LAVA.end - LAVA.start) * (0.35 * k + 0.65 * k * k);
}

/* ---------------- Ladeira dos Barris ---------------- */

export const LADEIRA = {
  halfWidth: 4,
  /** Trechos (z decrescente): [zInício, zFim, alturaInício, alturaFim]. */
  profile: [
    [6, -2, 0, 0],
    [-2, -20, 0, 4.2],
    [-20, -25, 4.2, 4.2],
    [-25, -43, 4.2, 8.6],
    [-43, -47, 8.6, 8.6],
    [-47, -57, 8.6, 11],
    [-57, -66, 11, 11],
  ] as const,
  finishZ: -58,
  barrelR: 0.55,
  killY: -6,
};

export function slopeHeight(z: number): number | null {
  for (const [z0, z1, h0, h1] of LADEIRA.profile) {
    if (z <= z0 && z >= z1) return h0 + ((z0 - z) / (z0 - z1)) * (h1 - h0);
  }
  return null;
}

export function slopeWorld(): WorldDef {
  const rail = LADEIRA.halfWidth - PLAYER_RADIUS;
  return {
    ground: (x, z) => (Math.abs(x) > LADEIRA.halfWidth ? null : slopeHeight(z)),
    bounds: (b: Body) => {
      if (b.x > rail) { b.x = rail; if (b.vx > 0) b.vx = 0; }
      if (b.x < -rail) { b.x = -rail; if (b.vx < 0) b.vx = 0; }
      if (b.z > 5.5) { b.z = 5.5; if (b.vz > 0) b.vz = 0; }
      if (b.z < -65.5) { b.z = -65.5; if (b.vz < 0) b.vz = 0; }
    },
  };
}

/* ---------------- Corredor dos Machados ---------------- */

export const MACHADOS = {
  halfWidth: 1.7,
  floors: [
    { z0: -16, z1: 4 },
    { z0: -36, z1: -18.6 },
    { z0: -58, z1: -38.8 },
    { z0: -70, z1: -60.6 },
  ],
  /** Machados de pêndulo: cruzam a passarela de um lado ao outro. */
  axes: [
    { z: -5, speed: 1.7, phase: 0 },
    { z: -10.5, speed: 2.0, phase: 2.1 },
    { z: -23, speed: 1.9, phase: 1.0 },
    { z: -27.5, speed: 2.3, phase: 3.0 },
    { z: -32, speed: 2.1, phase: 4.4 },
    { z: -43, speed: 2.4, phase: 0.6 },
    { z: -47.5, speed: 2.2, phase: 2.6 },
    { z: -52, speed: 2.6, phase: 5.0 },
  ],
  swing: 2.6,
  finishZ: -66,
  checkpoints: [2, -20.5, -40.5, -62.5],
  killY: -7,
};

/** Posição x da lâmina do machado i no tempo t. */
export function axeX(i: number, t: number): number {
  const a = MACHADOS.axes[i];
  return Math.sin(a.phase + a.speed * t) * MACHADOS.swing;
}

export function axeWorld(): WorldDef {
  return {
    ground: (x, z, y) => {
      if (y < -0.35 || Math.abs(x) > MACHADOS.halfWidth) return null;
      for (const f of MACHADOS.floors) if (z >= f.z0 && z <= f.z1) return 0;
      return null;
    },
  };
}

/* ---------------- campos 2v2 (Pastoreio e Estandarte) ---------------- */

export const PASTOREIO = { sheep: 7, penHalf: 5.2, penDepth: 2.6, sheepR: 0.55, fleeR: 3.8 };
export const ESTANDARTE = { baseX: 8.6, grabR: 1.15, homeR: 1.9, returnAfter: 6, carryBoost: 0.9 };
