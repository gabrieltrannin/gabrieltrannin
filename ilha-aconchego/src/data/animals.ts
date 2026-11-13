import type { ItemId } from './items';

export const ANIMAL_KINDS = ['chicken', 'cow', 'sheep'] as const;
export type AnimalKind = (typeof ANIMAL_KINDS)[number];

export interface AnimalKindDef {
  product: ItemId;
  /** Days between products (when fed every day). */
  every: number;
  /** Where it sleeps: the coop or the barn. */
  home: 'coop' | 'barn';
}

export const ANIMAL_DEFS: Record<AnimalKind, AnimalKindDef> = {
  chicken: { product: 'animal.egg', every: 1, home: 'coop' },
  cow: { product: 'animal.milk', every: 1, home: 'barn' },
  sheep: { product: 'animal.wool', every: 2, home: 'barn' },
};

/** The animals a new island starts with. Names are shown in the bubbles. */
export const STARTING_ANIMALS: readonly { id: string; kind: AnimalKind; name: string }[] = [
  { id: 'chicken-1', kind: 'chicken', name: 'Pipoca' },
  { id: 'chicken-2', kind: 'chicken', name: 'Gema' },
  { id: 'cow-1', kind: 'cow', name: 'Malhada' },
  { id: 'sheep-1', kind: 'sheep', name: 'Nuvem' },
];

export const MAX_FRIENDSHIP = 1000;
export const FRIENDSHIP = { feed: 10, pet: 25 } as const;
/** From this friendship on, an animal sometimes gives two products. */
export const FRIENDSHIP_DOUBLE = 500;
