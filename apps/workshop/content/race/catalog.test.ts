import { describe, expect, it } from 'vitest';
import type { Check, FacetDef, Model, VariantId } from '../../core/types';
import { READING_LEVELS } from '../../core/types';
import { allPass } from '../../logic/stats';
import { RACE_CATALOG as C, RACE_SCENE_NOTES } from './catalog';

// ---- helpers for checking content balance ----
const byId = new Map(C.variants.map((v) => [v.id, v]));
const aspectIds = C.aspects.map((a) => a.id);
const defaultModel: Model = Object.fromEntries(C.aspects.map((a) => [a.id, a.starters[0]]));
const starterPool = (a: string): VariantId[] => [...C.aspects.find((x) => x.id === a)!.starters];
const allPool = (a: string): VariantId[] => C.variants.filter((v) => v.aspect === a).map((v) => v.id);

function compute(model: Model) {
  const stats: Record<string, number> = {};
  const tags = new Set<string>();
  for (const s of C.stats) stats[s.id] = s.base;
  for (const id of Object.values(model)) {
    const v = byId.get(id)!;
    for (const [k, n] of Object.entries(v.stats)) stats[k] += n ?? 0;
    v.tags.forEach((t) => tags.add(t));
  }
  for (const s of C.stats) stats[s.id] = Math.max(s.min, Math.min(s.max, stats[s.id]));
  return { stats, tags };
}
function passes(model: Model, checks: Check[]): boolean {
  return allPass(checks, compute(model));
}
/** Fewest changed aspects from the default model that pass `checks` with the given pool (null = unsolvable). */
function minFix(checks: Check[], pool: (a: string) => VariantId[], maxChanges = 6): string[] | null {
  // Iterative deepening: the first depth with a solution is the minimum.
  for (let k = 0; k <= maxChanges; k++) {
    let found = null as string[] | null;
    const rec = (i: number, m: Model, changed: string[]): void => {
      if (found) return;
      if (changed.length === k) { if (passes(m, checks)) found = [...changed]; return; }
      if (aspectIds.length - i < k - changed.length) return;
      const a = aspectIds[i];
      for (const v of pool(a)) if (v !== defaultModel[a]) rec(i + 1, { ...m, [a]: v }, [...changed, v]);
      rec(i + 1, m, changed);
    };
    rec(0, defaultModel, []);
    if (found) return found;
  }
  return null;
}
const facets: FacetDef[] = C.scenarios.flatMap((s) => [...s.facets]);
const facetById = new Map(facets.map((f) => [f.id, f]));
const starterChecks = (i: number) => C.starters[i].stages.flatMap((st) => st.facets.flatMap((f) => facetById.get(f.facet)!.check(f.level)));

// Variant names that must never appear in Medium/Hard text (multi-word names always; distinctive single words too).
const DISTINCT = ['jeep', 'van', 'sleek', 'wedge', 'boxy', 'floaties', 'snorkel', 'winch', 'rainbow', 'tiny', 'truck',
  'rocket', 'spoiler', 'turbo', 'electric', 'bouncy', 'rubber', 'racing', 'monster'];
const MULTI = C.variants.map((v) => v.name.toLowerCase()).filter((n) => n.includes(' '));
const ASPECT_WORDS = ['wheels', 'wheel', 'tires', 'engine', 'motor', 'gears', 'springs', 'suspension', 'bumper', 'bumpers'];
const words = (s: string): string[] => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];
const hasWord = (s: string, w: string) => words(s).includes(w);

describe('race catalog structure', () => {
  it('has prefixed, unique ids', () => {
    const vids = C.variants.map((v) => v.id);
    expect(new Set(vids).size).toBe(vids.length);
    for (const v of C.variants) {
      expect(v.id.startsWith(`${v.aspect}.`)).toBe(true);
      expect(aspectIds).toContain(v.aspect);
      expect(v.note.length).toBeGreaterThan(0);
      for (const k of Object.keys(v.stats)) expect(C.stats.map((s) => s.id)).toContain(k);
    }
    const fids = facets.map((f) => f.id);
    expect(new Set(fids).size).toBe(fids.length);
    for (const s of C.scenarios) for (const f of s.facets) {
      expect(f.id.startsWith(`${s.id}.`)).toBe(true);
      expect(aspectIds).toContain(f.hintAspect);
      expect([...f.levels]).toEqual([...f.levels].sort((a, b) => a - b));
    }
    expect(C.scenarios.length).toBeGreaterThanOrEqual(12);
    expect(C.scenarios.length).toBeLessThanOrEqual(15);
    expect(C.starters.map((s) => s.id)).toEqual(['race-start-mud', 'race-start-jump', 'race-start-turn', 'race-start-hill', 'race-start-bright']);
  });

  it('only checks stats and tags that exist', () => {
    const statIds = new Set(C.stats.map((s) => s.id));
    const allTags = new Set(C.variants.flatMap((v) => v.tags));
    for (const f of facets) for (const l of f.levels) for (const c of f.check(l).flatMap((check) =>
      check.kind === 'anyOf' ? check.options.flat() : [check])) {
      if (c.kind === 'statMin' || c.kind === 'statMax') expect(statIds.has(c.stat), `${f.id} ${c.stat}`).toBe(true);
      else expect(allTags.has(c.tag), `${f.id} ${c.tag}`).toBe(true);
    }
  });

  it('unlockOrder covers every non-starter exactly once', () => {
    const starters = new Set(C.aspects.flatMap((a) => [...a.starters]));
    const nonStarters = C.variants.map((v) => v.id).filter((id) => !starters.has(id));
    expect([...C.unlockOrder].sort()).toEqual([...nonStarters].sort());
    expect(new Set(C.unlockOrder).size).toBe(C.unlockOrder.length);
  });

  it('has scene notes for every scenario and facet', () => {
    for (const s of C.scenarios) {
      const n = RACE_SCENE_NOTES[s.id];
      expect(n, s.id).toBeDefined();
      for (const f of s.facets) {
        expect(n.success[f.id], f.id).toBeTruthy();
        expect(n.failure[f.id], f.id).toBeTruthy();
      }
    }
  });
});

describe('race balance', () => {
  it('default model fails every starter', () => {
    C.starters.forEach((_, i) => expect(passes(defaultModel, starterChecks(i)), C.starters[i].id).toBe(false));
  });

  it('each starter is solvable with starters by changing one aspect', () => {
    C.starters.forEach((s, i) => {
      const fix = minFix(starterChecks(i), starterPool);
      expect(fix, s.id).not.toBeNull();
      expect(fix!.length, s.id).toBe(1);
    });
  });

  it('Long Jump and Steep Hill are not fixed by the same single part', () => {
    const jump = starterChecks(1);
    const hill = starterChecks(3);
    for (const a of aspectIds) for (const v of starterPool(a)) {
      const m = { ...defaultModel, [a]: v };
      expect(passes(m, jump) && passes(m, hill), v).toBe(false);
    }
  });

  it('every facet level is solvable with all variants', () => {
    for (const f of facets) for (const l of f.levels) expect(minFix(f.check(l), allPool), `${f.id} L${l}`).not.toBeNull();
  });

  it('enough tier-0 facet levels are solvable with starters, needing different parts', () => {
    const scTier = new Map(C.scenarios.flatMap((s) => s.facets.map((f) => [f.id, s.minTier] as const)));
    const solved: string[] = [];
    const fixAspects = new Set<string>();
    for (const f of facets) {
      if (f.minTier !== 0 || scTier.get(f.id) !== 0) continue;
      for (const l of f.levels) {
        const fix = minFix(f.check(l), starterPool);
        if (!fix) continue;
        solved.push(`${f.id} L${l}`);
        if (fix.length === 1) fixAspects.add(fix[0].split('.')[0]);
      }
    }
    expect(solved.length).toBeGreaterThanOrEqual(4);
    expect(fixAspects.size).toBeGreaterThanOrEqual(4);
  });

  it('top levels of multi-level tier-0 facets need unlocked parts', () => {
    for (const f of facets) {
      if (f.minTier !== 0 || f.levels.length < 2) continue;
      const top = f.levels[f.levels.length - 1];
      expect(minFix(f.check(top), starterPool), `${f.id} L${top}`).toBeNull();
    }
  });
});

describe('race phrases', () => {
  const allVariantText = (s: string) => {
    const low = s.toLowerCase();
    return MULTI.filter((n) => low.includes(n));
  };

  it('covers every facet level and reading level', () => {
    for (const f of facets) {
      const p = C.facetPhrases.find((x) => x.facet === f.id);
      expect(p, f.id).toBeDefined();
      expect(p!.requirement.length).toBeGreaterThanOrEqual(f.levels.length);
      for (const row of p!.requirement) for (const r of READING_LEVELS) {
        expect(row[r].length, `${f.id} ${r}`).toBeGreaterThanOrEqual(2);
        expect(new Set(row[r]).size).toBe(row[r].length);
      }
      for (const r of READING_LEVELS) expect(p!.hint[r].length, `${f.id} hint ${r}`).toBeGreaterThanOrEqual(2);
      expect(p!.vocab?.length ?? 0).toBeGreaterThan(0);
    }
    for (const s of C.scenarios) {
      const p = C.scenarioPhrases.find((x) => x.scenario === s.id);
      expect(p, s.id).toBeDefined();
      expect(p!.title.length).toBeGreaterThanOrEqual(2);
      for (const r of READING_LEVELS) expect(p!.intro[r], `${s.id} intro ${r}`).toEqual([]); // intros are dropped
    }
  });

  it('sentences are well formed; Easy <= 6 words, Medium <= 8, Hard <= 12', () => {
    for (const p of C.facetPhrases) {
      const all = [...p.requirement.flatMap((row) => READING_LEVELS.flatMap((r) => [...row[r]])), ...READING_LEVELS.flatMap((r) => [...p.hint[r]])];
      for (const s of all) expect(s, s).toMatch(/^[A-Z].*[.!?]$/);
      for (const row of p.requirement) for (const [r, max] of [['easy', 6], ['medium', 8], ['hard', 12]] as const) {
        for (const s of row[r]) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(max);
      }
    }
        // Plain ASCII only (UTF-8 safe everywhere).
    expect(/[^\x20-\x7e]/.test(JSON.stringify(C.facetPhrases) + JSON.stringify(C.scenarioPhrases))).toBe(false);
  });

  it('keeps single-option guidelines and hints from naming variants', () => {
    for (const p of C.facetPhrases) {
      const facet = facetById.get(p.facet)!;
      for (const [i, row] of p.requirement.entries()) {
        if (facet.check(facet.levels[i]).some((check) => check.kind === 'anyOf')) continue;
        for (const r of READING_LEVELS) for (const s of row[r]) {
          expect(allVariantText(s), s).toEqual([]);
          if (r === 'easy') continue;
          for (const w of [...DISTINCT, ...ASPECT_WORDS]) expect(hasWord(s, w), `${s} [${w}]`).toBe(false);
        }
      }
      for (const r of READING_LEVELS) for (const s of p.hint[r]) {
        expect(allVariantText(s), s).toEqual([]);
        for (const w of DISTINCT) expect(hasWord(s, w), `${s} [${w}]`).toBe(false);
      }
    }
  });
});
