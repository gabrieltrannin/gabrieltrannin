/**
 * Default content used when a new island is created and by tests.
 * The character creator (stage 2) will replace the player defaults.
 */

export const FRUITS = ['apple', 'pear', 'peach', 'orange', 'cherry'] as const;
export type FruitId = (typeof FRUITS)[number];

/** Color of each fruit on the trees. */
export const FRUIT_COLORS: Record<FruitId, number> = {
  apple: 0xe5383b,
  pear: 0xb9d35a,
  peach: 0xf7a07a,
  orange: 0xf39a2b,
  cherry: 0xc2183b,
};

export const DEFAULT_ISLAND = {
  name: 'Aconchego',
  nativeFruit: 'peach' as FruitId,
};

export const DEFAULT_PLAYER = {
  id: 'local',
  name: 'Ana',
};

/** Seed for the deterministic random generator of a brand-new island. */
export const DEFAULT_SEED = 20261113;
