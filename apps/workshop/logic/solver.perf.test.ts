import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { solve } from './solver';
import { randomChecks, syntheticCatalog } from './testing/helpers';

describe('solver performance', () => {
  it('answers a 10 aspects x 6 variants query in well under 5 ms on average', () => {
    const cat = syntheticCatalog(77, 10, 6);
    const avail = new Set(cat.variants.map((v) => v.id));
    const ref = Object.fromEntries(cat.aspects.map((a) => [a.id, `${a.id}.0`]));
    const rng = new Rng(5);
    const queries = Array.from({ length: 200 }, () => randomChecks(rng, rng.int(2, 6)));
    solve(cat, queries[0], avail, { ref }); // warm up
    const t0 = performance.now();
    let found = 0;
    for (const q of queries) if (solve(cat, q, avail, { ref })) found++;
    const avg = (performance.now() - t0) / queries.length;
    expect(found).toBeGreaterThan(0);
    expect(avg).toBeLessThan(5);
  });
});
