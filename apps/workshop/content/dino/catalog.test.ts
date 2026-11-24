import { describe, expect, it } from 'vitest';
import { READING_LEVELS, type Model, type VariantId } from '../../core/types';
import { DINO_CATALOG as cat, DINO_SCENE_NOTES } from './catalog';
import { defaultModel, oneChangeFixes, passes, solve, starterSet } from './balance';

const all = new Set(cat.variants.map((v) => v.id));
const starters = starterSet(cat);
const def = defaultModel(cat);
const facets = cat.scenarios.flatMap((s) => s.facets.map((f) => ({ s, f })));
const facetById = new Map(facets.map((x) => [x.f.id, x]));

const TREX: Record<string, VariantId> = {
  head: 'head.rex', teeth: 'teeth.mega', claws: 'claws.tinyArms', legs: 'legs.powerful',
  move: 'move.stand', tail: 'tail.heavy', size: 'size.huge',
};

/** Variant names a Medium/Hard sentence must not use. Size words (Big, Small...) are plain vocabulary. */
const ALLOWED_NAME_WORDS = new Set(['medium', 'small', 'big', 'huge']);
const bannedNames = cat.variants.map((v) => v.name).filter((n) => !ALLOWED_NAME_WORDS.has(n.toLowerCase()));

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe('dino catalog structure', () => {
  it('has unique, well-formed ids', () => {
    const ids = cat.variants.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of cat.variants) expect(v.id.startsWith(`${v.aspect}.`)).toBe(true);
    for (const v of cat.variants) expect(v.note.length).toBeGreaterThan(0);
    const fids = facets.map((x) => x.f.id);
    expect(new Set(fids).size).toBe(fids.length);
    for (const { s, f } of facets) expect(f.id.startsWith(`${s.id}.`)).toBe(true);
    expect(cat.scenarios.length).toBeGreaterThanOrEqual(12);
    expect(cat.scenarios.length).toBeLessThanOrEqual(15);
  });

  it('checks only use known stats, tags and aspects', () => {
    const stats = new Set(cat.stats.map((s) => s.id));
    const tags = new Set(cat.variants.flatMap((v) => v.tags));
    const aspects = new Set(cat.aspects.map((a) => a.id));
    for (const v of cat.variants) for (const k of Object.keys(v.stats)) expect(stats.has(k), `${v.id} ${k}`).toBe(true);
    for (const { f } of facets) {
      expect(aspects.has(f.hintAspect)).toBe(true);
      expect([...f.levels]).toEqual([...f.levels].sort((a, b) => a - b));
      for (const L of f.levels) for (const c of f.check(L).flatMap((check) =>
        check.kind === 'anyOf' ? check.options.flat() : [check])) {
        if (c.kind === 'statMin' || c.kind === 'statMax') expect(stats.has(c.stat), `${f.id} ${c.stat}`).toBe(true);
        else expect(tags.has(c.tag), `${f.id} ${c.tag}`).toBe(true);
      }
    }
  });

  it('unlockOrder covers each non-starter exactly once', () => {
    const non = cat.variants.map((v) => v.id).filter((id) => !starters.has(id));
    expect([...cat.unlockOrder].sort()).toEqual(non.sort());
  });

  it('T-Rex parts come late in the unlock order', () => {
    const n = cat.unlockOrder.length;
    for (const id of ['head.rex', 'teeth.mega', 'claws.tinyArms', 'size.huge']) {
      expect(cat.unlockOrder.indexOf(id)).toBeGreaterThanOrEqual(n - 6);
    }
  });
});

describe('dino balance', () => {
  it('starters: default fails, each solvable by changing exactly one starter part', () => {
    expect(cat.starters.map((s) => s.id)).toEqual(['dino-start-teeth', 'dino-start-green', 'dino-start-jump', 'dino-start-hole', 'dino-start-stand']);
    const fixAspects = new Set<string>();
    for (const st of cat.starters) {
      const checks = st.stages.flatMap((stage) => stage.facets.flatMap((x) => facetById.get(x.facet)!.f.check(x.level)));
      expect(passes(cat, def, checks), st.id).toBe(false);
      const fixes = oneChangeFixes(cat, def, checks, starters);
      expect(fixes.length, st.id).toBeGreaterThan(0);
      for (const f of fixes) fixAspects.add(f.split('.')[0]);
    }
    expect(fixAspects.size).toBeGreaterThanOrEqual(5);
  });

  it('every facet level is solvable with all variants', () => {
    for (const { f } of facets) for (const L of f.levels) expect(solve(cat, f.check(L), all), `${f.id}@${L}`).not.toBeNull();
  });

  it('several tier-0 facet levels are solvable with starters, needing different fixes', () => {
    const fixAspects = new Set<string>();
    let count = 0;
    for (const { s, f } of facets) {
      if (s.minTier > 0 || f.minTier > 0) continue;
      for (const L of f.levels) {
        if (!solve(cat, f.check(L), starters)) continue;
        count++;
        for (const v of oneChangeFixes(cat, def, f.check(L), starters)) fixAspects.add(v.split('.')[0]);
      }
    }
    expect(count).toBeGreaterThanOrEqual(4);
    expect(fixAspects.size).toBeGreaterThanOrEqual(4);
  });

  it('the hardest level of most facets needs an unlocked part', () => {
    const multi = facets.filter(({ f }) => f.levels.length > 1);
    const needUnlock = multi.filter(({ f }) => !solve(cat, f.check(f.levels[f.levels.length - 1]), starters));
    expect(needUnlock.length / multi.length).toBeGreaterThanOrEqual(0.6);
  });

  it('a T-Rex build passes at least 3 late facet levels', () => {
    const allowed = new Set([...all].filter((id) => { const a = id.split('.')[0]; return !(a in TREX) || TREX[a] === id; }));
    const late = facets.flatMap(({ s, f }) => f.levels
      .filter((_L, i) => Math.max(s.minTier, f.minTier) >= 3 || (f.levels.length > 1 && i === f.levels.length - 1))
      .map((L) => ({ id: `${f.id}@${L}`, checks: f.check(L) })));
    const won = late.filter((x) => solve(cat, x.checks, allowed));
    expect(won.length).toBeGreaterThanOrEqual(3);
    expect(won.map((x) => x.id)).toEqual(expect.arrayContaining(['snack.bigGulp@2', 'birds.roar@3', 'log.push@3']));
    // the T-Rex build itself (free choices filled in) is a valid model
    const m: Model = { ...def, ...TREX };
    expect(passes(cat, m, facetById.get('log.push')!.f.check(3))).toBe(true);
  });
});

describe('dino phrases', () => {
  it('covers every facet: >= 2 sentences per level and reading level, >= 2 hints', () => {
    const byId = new Map(cat.facetPhrases.map((p) => [p.facet, p]));
    expect(byId.size).toBe(facets.length);
    for (const { f } of facets) {
      const p = byId.get(f.id);
      expect(p, f.id).toBeDefined();
      expect(p!.requirement.length).toBeGreaterThanOrEqual(f.levels.length);
      for (const row of p!.requirement) for (const r of READING_LEVELS) expect(row[r].length, `${f.id} ${r}`).toBeGreaterThanOrEqual(2);
      for (const r of READING_LEVELS) expect(p!.hint[r].length).toBeGreaterThanOrEqual(2);
    }
  });

  it('covers every scenario: titles; intros are dropped', () => {
    for (const s of cat.scenarios) {
      const p = cat.scenarioPhrases.find((x) => x.scenario === s.id);
      expect(p, s.id).toBeDefined();
      expect(p!.title).toHaveLength(1); // stage title for 2+ requirements; one requirement uses its level title
      for (const r of READING_LEVELS) expect(p!.intro[r]).toEqual([]);
    }
  });

  const allSentences = () => [
    ...cat.facetPhrases.flatMap((p) => [
      ...p.requirement.flatMap((row, i) => {
        const { f } = facetById.get(p.facet)!;
        const hasOptions = f.check(f.levels[i]).some((check) => check.kind === 'anyOf');
        return READING_LEVELS.flatMap((r) => row[r].map((t) => ({ r, t, id: p.facet, hasOptions })));
      }),
      ...READING_LEVELS.flatMap((r) => p.hint[r].map((t) => ({ r, t, id: `${p.facet} hint` }))),
    ]),
    ...cat.scenarioPhrases.flatMap((p) => READING_LEVELS.flatMap((r) => p.intro[r].map((t) => ({ r, t, id: `${p.scenario} intro` })))),
  ];

  it('sentences are plain ASCII, capitalised, end with a period; Easy <= 6, Medium <= 8, Hard <= 12 words', () => {
    for (const { r, t, id } of allSentences()) {
      expect(/^[\x20-\x7e]+$/.test(t), `${id}: ${t}`).toBe(true);
      expect(/^[A-Z]/.test(t), `${id}: ${t}`).toBe(true);
      expect(id.endsWith('hint') ? /[.?]$/.test(t) : t.endsWith('.'), `${id}: ${t}`).toBe(true);
      expect(words(t), `${id}: ${t}`).toBeLessThanOrEqual(r === 'easy' ? 6 : r === 'medium' ? 8 : 12);
    }
  });

  it('hints never name variants (guidelines name the fix; validateCatalog checks them)', () => {
    for (const sentence of allSentences()) {
      const { r, t, id } = sentence;
      if (!id.endsWith('hint')) continue;
      for (const n of bannedNames) {
        const re = new RegExp(`\\b${n.replace(/\s+/g, '\\s+')}\\b`, 'i');
        expect(re.test(t), `${id} (${r}) names "${n}": ${t}`).toBe(false);
      }
    }
  });

  it('no duplicate sentences inside one facet level', () => {
    for (const p of cat.facetPhrases) for (const row of p.requirement) {
      const list = READING_LEVELS.flatMap((r) => row[r]);
      expect(new Set(list).size, p.facet).toBe(list.length);
    }
  });
});

describe('dino scene notes', () => {
  it('describe every scenario and every facet success/failure', () => {
    for (const s of cat.scenarios) {
      const n = DINO_SCENE_NOTES[s.id];
      expect(n, s.id).toBeDefined();
      for (const f of s.facets) {
        expect(n.success[f.id], f.id).toBeTruthy();
        expect(n.failure[f.id], f.id).toBeTruthy();
      }
    }
  });
});
