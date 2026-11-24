/** Integration gate: the shipped catalogs must validate and be playable end to end. Skipped while a catalog is still a stub. */
import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../content';
import { WORKSHOP_IDS } from '../core/types';
import { simulate } from './simulate';
import { validateCatalog } from './validateCatalog';
import { engine } from './index';
import { affordability, BOARD_CATEGORIES, boardCategory } from './affordability';
import { flatChecks } from './util';

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
    expect(new Set(r.progress.bought).size).toBe(r.progress.bought.length);
    expect(r.progress.bought.length).toBe(cat.variants.length - cat.aspects.length);
  }, 30_000); // a full playthrough takes 2-4 s alone, far longer while the whole suite runs in parallel
  run('deals Ready, Affordable, and Future, then keeps the same cards and colors through every legal two-purchase opening', () => {
    const start = engine.refreshBoard(id, engine.newProgress(id));
    const categories = (p: typeof start) => {
      const budget = affordability(cat, p);
      return p.active.map((id) => boardCategory(budget.cheapest(flatChecks(p.challenges[id]))!.cost, p.wallet));
    };
    expect(categories(start)).toEqual(['ready', 'affordable', 'future']);
    const options = (p: typeof start) => cat.aspects.flatMap(({ id: aspect }) =>
      engine.shopOffers(id, p, aspect).filter((offer) => offer.affordable).map((offer) => ({ aspect, ...offer })));
    for (const first of options(start)) {
      const once = engine.purchase(id, start, first.aspect, first.variant).progress;
      for (const second of options(once)) {
        const twice = engine.purchase(id, once, second.aspect, second.variant).progress;
        const purchasePair = first.variant + ' then ' + second.variant;
        expect(twice.wallet).toBe(0);
        expect([...twice.active].sort(), purchasePair).toEqual([...start.active].sort());
        expect(twice.challenges, purchasePair).toEqual(start.challenges);
        const actual = categories(twice);
        const sorted = BOARD_CATEGORIES.flatMap((category) => actual.filter((value) => value === category));
        expect(actual, purchasePair).toEqual(sorted);
      }
    }
  });
});
