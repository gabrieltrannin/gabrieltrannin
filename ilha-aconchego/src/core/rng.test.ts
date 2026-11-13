import { describe, expect, it } from 'vitest';
import { nextInt, nextRandom } from './rng';

describe('rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const seq = (seed: number) => {
      const out: number[] = [];
      let s = seed;
      for (let i = 0; i < 5; i++) {
        const r = nextRandom(s);
        out.push(r.value);
        s = r.state;
      }
      return out;
    };
    expect(seq(7)).toEqual(seq(7));
    expect(seq(7)).not.toEqual(seq(8));
  });

  it('stays inside [0, 1) and inside integer ranges', () => {
    let s = 123;
    for (let i = 0; i < 2000; i++) {
      const r = nextRandom(s);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      const n = nextInt(r.state, 1, 6);
      expect(n.value).toBeGreaterThanOrEqual(1);
      expect(n.value).toBeLessThanOrEqual(6);
      s = n.state;
    }
  });
});
