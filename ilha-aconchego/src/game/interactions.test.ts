import { describe, expect, it } from 'vitest';
import { Interactions, type Interactable } from './interactions';

const item = (id: string, x: number, z: number, radius = 2, enabled = true): Interactable => ({
  id,
  at: () => ({ x, z }),
  radius,
  label: () => id,
  enabled: () => enabled,
  act: () => {},
});

describe('Interactions.nearest', () => {
  it('picks what is in reach and in front of the player', () => {
    const list = new Interactions();
    list.add(item('front', 0, 1.5));
    list.add(item('behind', 0, -1.5));
    // Facing 0 looks toward +z.
    expect(list.nearest(0, 0, 0)?.id).toBe('front');
    expect(list.nearest(0, 0, Math.PI)?.id).toBe('behind');
  });

  it('ignores things out of reach or disabled', () => {
    const list = new Interactions();
    list.add(item('far', 0, 5));
    list.add(item('off', 0, 1, 2, false));
    expect(list.nearest(0, 0, 0)).toBeNull();
  });

  it('accepts something right next to the player even if it is to the side', () => {
    const list = new Interactions();
    list.add(item('side', 0.6, 0));
    expect(list.nearest(0, 0, 0)?.id).toBe('side');
  });

  it('prefers the closer and more central target', () => {
    const list = new Interactions();
    list.add(item('ahead', 0, 1.2));
    list.add(item('diagonal', 1.2, 1.2));
    expect(list.nearest(0, 0, 0)?.id).toBe('ahead');
    list.remove('ahead');
    expect(list.nearest(0, 0, 0)?.id).toBe('diagonal');
  });
});
