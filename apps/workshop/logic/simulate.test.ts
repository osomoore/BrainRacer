import { describe, expect, it } from 'vitest';
import { simulate } from './simulate';
import { validateCatalog } from './validateCatalog';
import { FIXTURE_CATALOG as C } from './testing/fixtureCatalog';
import type { WorkshopCatalog } from '../core/types';
import { CATALOGS } from '../content';
import { WS_RULES } from '../config';
import { newProgress, refreshBoard } from './board';
import { affordability } from './affordability';
import { currencyStarters } from './starters';

describe('simulate (fixture)', () => {
  it('unlocks everything without stalling and every solution passes evaluate', () => {
    const r = simulate(C);
    expect(r.stalls).toEqual([]);
    expect(r.allUnlocked).toBe(true);
    expect(r.mismatches).toBe(0);
    expect(r.averageChanged).toBeGreaterThan(0.9);
    expect(r.newestRequiredRate).toBeGreaterThan(0);
    expect(r.newestRequiredRate).toBeLessThan(1);
    expect(r.tierReached).toBeGreaterThanOrEqual(3);
  });
  it('is deterministic', () => {
    expect(simulate(C).progress).toEqual(simulate(C).progress);
  });
  it('buys distinct cards through the full progression across many seeds', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const r = simulate(C, { seed });
      expect(r.stalls).toEqual([]);
      expect(r.allUnlocked).toBe(true);
      expect(new Set(r.progress.bought).size).toBe(r.progress.bought.length);
      expect(r.progress.bought.length).toBe(C.variants.length - C.aspects.length);
      expect(r.progress.active).toHaveLength(3);
      expect(r.progress.wallet).toBeGreaterThanOrEqual(0);
    }
  }, 60000);
  it('keeps independent simulator seeds deterministic and sandboxed', () => {
    const a = simulate(C, { seed: 17 });
    const b = simulate(C, { seed: 17 });
    const c = simulate(C, { seed: 18 });
    expect(a).toEqual(b);
    expect(c.progress).not.toEqual(a.progress);
  });
});

describe('fresh Starter and Easy progression', () => {
  const authored = {
    race: [
      ['race-start-landing', 'springs.bouncy'],
      ['race-start-boxes', 'body.truck'],
    ],
    dino: [
      ['dino-start-rocks', 'claws.hooks'],
      ['dino-start-river', 'tail.paddle'],
    ],
  } as const;

  it.each(['race', 'dino'] as const)('%s starts with four currency and defers expensive authored cards until affordable on Starter and Easy', (id) => {
    const cat = CATALOGS[id];
    for (const level of ['starter', 'easy'] as const) {
      const fresh = refreshBoard(cat, newProgress(cat, undefined, level));
      expect(fresh.wallet).toBe(WS_RULES.startWallet);
      const featured = authored[id];
      const expensive = featured.filter(([, part]) => (affordability(cat, fresh).routes.get(part)?.cost ?? 0) > fresh.wallet);
      // A card cannot be dealt while its featured part is still beyond the player's wallet.
      for (const [challenge] of expensive) expect(fresh.active).not.toContain(challenge);

      const report = simulate(cat, { level, seed: 1 });
      expect(report.stalls, `${id} ${level}`).toEqual([]);
      expect(report.allUnlocked, `${id} ${level}`).toBe(true);
      expect(report.progress.wallet).toBeGreaterThanOrEqual(0);
      for (const [challenge] of featured) {
        expect(report.progress.challenges[challenge], `${id} ${level} ${challenge} dealt in full progression`).toBeDefined();
      }

      // Once the original starter cards are done, each authored card deals at its full route cost.
      for (const [challenge, part] of featured) {
        const routeCost = affordability(cat, fresh).routes.get(part)?.cost;
        expect(routeCost, `${id} ${level} ${part}`).toBeDefined();
        const starterIndex = currencyStarters(cat, true).findIndex(({ challenge: card }) => card.id === challenge);
        expect(starterIndex, `${id} ${level} ${challenge} eligibility`).toBeGreaterThanOrEqual(0);
        const belowCost = refreshBoard(cat, { ...fresh, active: [], challenges: {}, nextStarter: starterIndex, wallet: routeCost! - 1 });
        expect(belowCost.active, `${id} ${level} ${challenge} below route cost ${routeCost}`).not.toContain(challenge);
        const ready = refreshBoard(cat, { ...fresh, active: [], challenges: {}, nextStarter: starterIndex, wallet: routeCost! });
        expect(ready.active, `${id} ${level} ${challenge} at route cost ${routeCost}`).toContain(challenge);
      }
    }
  }, 60_000);
});

describe('validateCatalog', () => {
  it('accepts the fixture (placeholder wording, so the wording rules are off)', () => {
    expect(validateCatalog(C, { wording: false })).toEqual([]);
  });
  const bad = (patch: Partial<WorkshopCatalog>): string => validateCatalog({ ...C, ...patch }).join('\n');
  it('reports phrase problems', () => {
    expect(bad({ facetPhrases: C.facetPhrases.slice(1) })).toContain('no facetPhrases');
    const short = C.facetPhrases.map((f, i) => (i === 0 ? { ...f, hint: { ...f.hint, easy: ['only one'] } } : f));
    expect(bad({ facetPhrases: short })).toContain('hint [easy]');
    const fewer = C.facetPhrases.map((f, i) => (i === 0 ? { ...f, requirement: f.requirement.slice(1) } : f));
    expect(bad({ facetPhrases: fewer })).toContain('requirement phrase rows');
    expect(bad({ scenarioPhrases: [] })).toContain('no scenarioPhrases');
  });
  it('reports unlock order problems', () => {
    expect(bad({ unlockOrder: C.unlockOrder.slice(1) })).toContain('appears 0 times');
    expect(bad({ unlockOrder: [...C.unlockOrder, 'wheels.road'] })).toContain('is a starter');
    expect(bad({ unlockOrder: [...C.unlockOrder, 'ghost.x'] })).toContain('unknown variant');
  });
  it('reports starter problems', () => {
    expect(bad({ starters: [{ id: 'x', stages: [{ scenario: 'nope', facets: [] }], }, ...C.starters] })).toContain('unknown scenario');
    const hard = { id: 'imp', stages: [{ scenario: 'tree', facets: [{ facet: 'tree.reach', level: 2 }] }] };
    expect(bad({ starters: [...C.starters, hard] })).toContain('starter imp');
    const solved = { id: 'solved', stages: [{ scenario: 'delivery', facets: [{ facet: 'delivery.load', level: 1 }] }] };
    expect(bad({ starters: [...C.starters, solved] })).toContain('already solved by the default model');
  });
  it('reports unsolvable facets and unknown stats/tags', () => {
    const sc = C.scenarios.map((s) => (s.id === 'fog' ? { ...s, facets: [{ ...s.facets[0], check: () => [{ kind: 'tag' as const, tag: 'nonexistent' }] }] } : s));
    const msg = bad({ scenarios: sc });
    expect(msg).toContain('no variant has tag "nonexistent"');
    expect(msg).toContain('not solvable');
    const sc2 = C.scenarios.map((s) => (s.id === 'fog' ? { ...s, facets: [{ ...s.facets[0], check: () => [{ kind: 'statMin' as const, stat: 'zzz', min: 1 }] }] } : s));
    expect(bad({ scenarios: sc2 })).toContain('unknown stat "zzz"');
  });
  it('reports id and variant problems', () => {
    expect(bad({ variants: [...C.variants, { id: 'wheels.road', aspect: 'wheels', name: 'x', stats: {}, tags: [], note: '' }] })).toContain('duplicate variant');
    expect(bad({ variants: C.variants.map((v, i) => (i === 0 ? { ...v, stats: { nope: 1 } } : v)) })).toContain('unknown stat "nope"');
  });
  it('reports too few starter-only tier-0 facets', () => {
    expect(bad({ scenarios: C.scenarios.filter((s) => s.minTier > 0) })).toContain('tier-0 facets');
  });
});
