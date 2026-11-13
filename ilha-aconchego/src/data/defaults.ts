/**
 * Default content used when a new island is created and by tests.
 * The character creator (stage 2) will replace the player defaults.
 */

export const FRUITS = ['apple', 'pear', 'peach', 'orange', 'cherry'] as const;
export type FruitId = (typeof FRUITS)[number];

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
