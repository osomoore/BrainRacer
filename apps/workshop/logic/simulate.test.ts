import { describe, expect, it } from 'vitest';
import { simulate } from './simulate';
import { validateCatalog } from './validateCatalog';
import { FIXTURE_CATALOG as C } from './testing/fixtureCatalog';
import type { WorkshopCatalog } from '../core/types';

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
});

describe('validateCatalog', () => {
  it('accepts the fixture', () => {
    expect(validateCatalog(C)).toEqual([]);
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
