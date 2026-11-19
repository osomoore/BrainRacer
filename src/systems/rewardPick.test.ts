import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { extendTurbo, FLAVORS, pickFlavor, type Flavor } from './rewardPick';

const W: Record<Flavor, number> = { rainbow: 3, shockwave: 3, ghost: 2, magnet: 2 };

describe('pickFlavor', () => {
  it('never repeats the previous flavor', () => {
    const rng = new Rng(5);
    let last: Flavor | null = null;
    for (let i = 0; i < 500; i++) {
      const f = pickFlavor(rng, W, last);
      expect(f).not.toBe(last);
      last = f;
    }
  });
  it('is deterministic for a seed', () => {
    const run = () => { const r = new Rng(9); let l: Flavor | null = null; return Array.from({ length: 30 }, () => (l = pickFlavor(r, W, l))); };
    expect(run()).toEqual(run());
  });
  it('respects weights and zero weights', () => {
    const rng = new Rng(1);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) { const f = pickFlavor(rng, { ...W, magnet: 0, ghost: 20 }, null); counts[f] = (counts[f] ?? 0) + 1; }
    expect(counts.magnet).toBeUndefined();
    expect(counts.ghost).toBeGreaterThan(counts.rainbow * 2);
    expect(FLAVORS.length).toBe(4);
  });
});

describe('extendTurbo', () => {
  it('adds time to remaining', () => expect(extendTurbo(1, 3, 8)).toBe(4));
  it('starts from zero', () => expect(extendTurbo(0, 3, 8)).toBe(3));
  it('caps', () => expect(extendTurbo(7, 3, 8)).toBe(8));
});
