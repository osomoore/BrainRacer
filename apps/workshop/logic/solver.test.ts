import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { Model } from '../core/types';
import { solve, solvable } from './solver';
import { allPass, computeModel } from './stats';
import { randomChecks, syntheticCatalog } from './testing/helpers';
import { FIXTURE_CATALOG } from './testing/fixtureCatalog';

describe('solver', () => {
  it('matches brute force on random small catalogs (solvability and minimum changes)', () => {
    const rng = new Rng(12345);
    for (let iter = 0; iter < 300; iter++) {
      const cat = syntheticCatalog(1000 + iter, 4, 4);
      const ref: Model = Object.fromEntries(cat.aspects.map((a) => [a.id, `${a.id}.${rng.int(0, 3)}`]));
      const avail = new Set(cat.variants.filter(() => rng.chance(0.7)).map((v) => v.id));
      for (const v of Object.values(ref)) avail.add(v);
      const checks = randomChecks(rng, rng.int(1, 4));
      // brute force
      let bestCost = Infinity;
      const ids = cat.aspects.map((a) => a.id);
      const pick = (i: number, m: Model): void => {
        if (i === ids.length) {
          if (!allPass(checks, computeModel(cat, m))) return;
          bestCost = Math.min(bestCost, ids.filter((a) => m[a] !== ref[a]).length);
          return;
        }
        for (const v of cat.variants.filter((x) => x.aspect === ids[i] && avail.has(x.id))) pick(i + 1, { ...m, [ids[i]]: v.id });
      };
      pick(0, {});
      const sol = solve(cat, checks, avail, { ref });
      if (bestCost === Infinity) { expect(sol).toBeNull(); expect(solvable(cat, checks, avail)).toBe(false); continue; }
      expect(sol, `iter ${iter}`).not.toBeNull();
      expect(sol!.cost).toBe(bestCost);
      expect(allPass(checks, computeModel(cat, sol!.build))).toBe(true);
      expect(Object.values(sol!.build).every((v) => avail.has(v))).toBe(true);
      expect(ids.filter((a) => sol!.build[a] !== ref[a]).length).toBe(bestCost);
      expect(solvable(cat, checks, avail)).toBe(true);
      // cost limit: finds nothing when limit <= best, something when above
      expect(solve(cat, checks, avail, { ref, costLimit: bestCost })).toBeNull();
      expect(solve(cat, checks, avail, { ref, costLimit: bestCost + 1 })?.cost).toBe(bestCost);
    }
  });

  it('handles clamped stats and contradictory checks', () => {
    const cat = FIXTURE_CATALOG;
    const all = new Set(cat.variants.map((v) => v.id));
    expect(solvable(cat, [{ kind: 'statMin', stat: 'speed', min: 99 }], all)).toBe(false);
    expect(solvable(cat, [{ kind: 'tag', tag: 'bright' }, { kind: 'noTag', tag: 'bright' }], all)).toBe(false);
    expect(solvable(cat, [{ kind: 'statMin', stat: 'speed', min: 5 }, { kind: 'statMax', stat: 'speed', max: 3 }], all)).toBe(false);
    expect(solvable(cat, [{ kind: 'statMin', stat: 'speed', min: -5 }], all)).toBe(true);
    expect(solvable(cat, [{ kind: 'statMin', stat: 'nope', min: 1 }], all)).toBe(false);
    expect(solvable(cat, [{ kind: 'statMax', stat: 'nope', max: 1 }], all)).toBe(true);
  });

  it('keeps irrelevant aspects at the reference', () => {
    const cat = FIXTURE_CATALOG;
    const all = new Set(cat.variants.map((v) => v.id));
    const ref: Model = { wheels: 'wheels.road', engine: 'engine.big', paint: 'paint.blue', size: 'size.medium', springs: 'springs.soft', extra: 'extra.roofRack' };
    const sol = solve(cat, [{ kind: 'tag', tag: 'bright' }], all, { ref })!;
    expect(sol.cost).toBe(1);
    expect(sol.build.wheels).toBe('wheels.road');
    expect(sol.build.engine).toBe('engine.big');
  });
});
