/** Integration gate: the shipped catalogs must validate and be playable end to end. Skipped while a catalog is still a stub. */
import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../content';
import { WORKSHOP_IDS } from '../core/types';
import { simulate } from './simulate';
import { validateCatalog } from './validateCatalog';

describe.each(WORKSHOP_IDS)('real catalog: %s', (id) => {
  const cat = CATALOGS[id];
  const run = cat.scenarios.length > 0 ? it : it.skip;
  run('passes validateCatalog', () => {
    expect(validateCatalog(cat)).toEqual([]);
  });
  run('can be played from a fresh profile until every part is unlocked', () => {
    const r = simulate(cat);
    expect(r.stalls).toEqual([]);
    expect(r.allUnlocked).toBe(true);
    expect(r.mismatches).toBe(0);
  });
});
