import { describe, expect, it } from 'vitest';
import type { Check, FacetDef, Model, VariantId } from '../../core/types';
import { READING_LEVELS } from '../../core/types';
import { allPass, computeModel, partTag } from '../../logic/stats';
import { evaluate } from '../../logic/evaluate';
import { resolveSpec } from '../../logic/text';
import { namedVariants, variantHelps } from '../../logic/validateCatalog';
import { newProgress } from '../../logic/board';
import { normalizeProgress } from '../../logic/save';
import { RACE_CATALOG as C, RACE_SCENE_NOTES } from './catalog';

// ---- helpers for checking content balance ----
const byId = new Map(C.variants.map((v) => [v.id, v]));
const aspectIds = C.aspects.map((a) => a.id);
const defaultModel: Model = Object.fromEntries(C.aspects.map((a) => [a.id, a.starters[0]]));
const starterPool = (a: string): VariantId[] => [...C.aspects.find((x) => x.id === a)!.starters];
const allPool = (a: string): VariantId[] => C.variants.filter((v) => v.aspect === a).map((v) => v.id);

function passes(model: Model, checks: Check[]): boolean {
  return allPass(checks, computeModel(C, model));
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

// Variant names that must never appear in hints (multi-word names always; distinctive single words too).
const DISTINCT = ['jeep', 'van', 'sleek', 'wedge', 'boxy', 'floaties', 'snorkel', 'winch', 'rainbow', 'tiny', 'truck',
  'rocket', 'spoiler', 'turbo', 'electric', 'bouncy', 'rubber', 'racing', 'monster'];
const MULTI = C.variants.map((v) => v.name.toLowerCase()).filter((n) => n.includes(' '));
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
    const allTags = new Set(C.variants.flatMap((v) => [...v.tags, partTag(v.id)]));
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

describe('jump builds printed on challenge cards', () => {
  const speed = facetById.get('jump.speed')!;
  const landing = facetById.get('jump.landing')!;
  const slow = { ...defaultModel, body: 'body.van', wheels: 'wheels.mud', bumpers: 'bumpers.pusher', gears: 'gears.climbing', extra: 'extra.floats' };
  const at = (facet: FacetDef, level: number) => ({ facet: facet.id, level });
  const jump = (...requirements: ReturnType<typeof at>[]) => resolveSpec(C, {
    stages: [{ scenario: 'jump', facets: requirements }],
  }, { id: 'jump-test', source: 'generated', tier: 3, seed: 42 });
  const fixes = (facet: FacetDef, level: number): Model[] => {
    const row = C.facetPhrases.find((p) => p.facet === facet.id)!.requirement[level - 1];
    const statCheck = facet.id === speed.id
      ? { kind: 'statMin' as const, stat: 'speed', min: 1 }
      : { kind: 'statMin' as const, stat: 'bounce', min: 1 };
    return READING_LEVELS.flatMap((reading) => row[reading].map((line) => {
      // A phrase can refer to "the car" without asking for the default Car body.
      const variants = [...namedVariants(C, line)].map((id) => byId.get(id)!).filter((part) => variantHelps(C, part, statCheck));
      expect(variants.length, line).toBeGreaterThan(0);
      return Object.fromEntries(variants.map((part) => [part.aspect, part.id]));
    }));
  };

  it('passes every advertised speed and landing build, alone or together at every level', () => {
    for (const speedLevel of speed.levels) for (const speedFix of fixes(speed, speedLevel)) {
      const speedReq = at(speed, speedLevel);
      expect(evaluate(C, { ...slow, ...speedFix }, jump(speedReq)).passed, JSON.stringify(speedFix)).toBe(true);
      for (const landingLevel of landing.levels) for (const landingFix of fixes(landing, landingLevel)) {
        const challenge = jump(speedReq, at(landing, landingLevel));
        expect(evaluate(C, { ...slow, ...speedFix, ...landingFix }, challenge).passed,
          JSON.stringify({ speedLevel, landingLevel, speedFix, landingFix })).toBe(true);
      }
    }
    for (const level of landing.levels) for (const fix of fixes(landing, level)) {
      expect(evaluate(C, { ...slow, ...fix }, jump(at(landing, level))).passed, JSON.stringify(fix)).toBe(true);
    }
  });

  it('repairs an existing Long Gap card and still requires the complete fix or sufficient speed', () => {
    const card = jump(at(speed, 2));
    card.stages[0].requirements[0].checks = [{ kind: 'statMin', stat: 'speed', min: 7 }];
    const original = { ...newProgress(C), challenges: { [card.id]: card }, active: [card.id], fails: { [card.id]: 2 } };
    const loaded = normalizeProgress(C, original)!;
    const upgraded = loaded.challenges[card.id];
    const withGears = { ...slow, gears: 'gears.speedy' };
    const both = { ...withGears, extra: 'extra.rocket' };
    expect(evaluate(C, both, card).passed).toBe(false);
    expect(evaluate(C, both, upgraded).passed).toBe(true);
    expect(evaluate(C, withGears, upgraded).passed).toBe(false);
    expect(evaluate(C, { ...slow, extra: 'extra.rocket' }, upgraded).passed).toBe(false);
    expect(evaluate(C, { ...defaultModel, wheels: 'wheels.racing', engine: 'engine.turbo' }, upgraded).passed).toBe(true);
    expect(loaded.active).toEqual(original.active);
    expect(loaded.fails).toEqual(original.fails);
    expect(normalizeProgress(C, loaded)).toEqual(loaded);
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
      expect(p!.title).toHaveLength(1); // stage title for 2+ requirements; one requirement uses its level title
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

  it('keeps hints from naming variants (guidelines name the fix; validateCatalog checks them)', () => {
    for (const p of C.facetPhrases) {
      for (const r of READING_LEVELS) for (const s of p.hint[r]) {
        expect(allVariantText(s), s).toEqual([]);
        for (const w of DISTINCT) expect(hasWord(s, w), `${s} [${w}]`).toBe(false);
      }
    }
  });
});
