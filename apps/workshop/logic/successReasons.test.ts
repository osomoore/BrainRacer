import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../content';
import { READING_LEVELS } from '../core/types';
import type { Challenge, LeveledPhrases, RunResult, WorkshopCatalog } from '../core/types';
import { resolveSpec } from './text';
import { successReasons } from './successReasons';
import { validateCatalog } from './validateCatalog';
import { evaluate } from './evaluate';
import { defaultModel } from './stats';

function oneRequirement(cat: WorkshopCatalog, seed = 17): Challenge {
  const scenario = cat.scenarios[0];
  const facet = scenario.facets[0];
  return resolveSpec(cat, { stages: [{ scenario: scenario.id, facets: [{ facet: facet.id, level: facet.levels[0] }] }] },
    { id: 'success-reason-test', seed, tier: 1, source: 'generated' });
}

function resultFor(challenge: Challenge, route: 'named' | 'stat' | 'check' = 'stat', parts?: readonly string[]): RunResult {
  const requirements = challenge.stages.flatMap((stage) => stage.requirements.map((req) => ({
    id: req.id, passed: true, reached: true, route, ...(parts ? { parts } : {}),
  })));
  return {
    passed: true, cleverWin: route === 'stat', endStage: challenge.stages.length - 1,
    stages: challenge.stages.map((_, index) => ({ index, passed: true, reached: true })), requirements,
  };
}

describe.each(Object.values(CATALOGS))('$title success reasons', (cat) => {
  it('chooses seeded quality reasons deterministically from both catalogs', () => {
    const challenge = oneRequirement(cat);
    const result = resultFor(challenge, 'stat');
    for (const reading of READING_LEVELS) {
      const a = Array.from({ length: 24 }, (_, seed) => successReasons(cat, { ...challenge, seed }, result, reading)[0]);
      const b = Array.from({ length: 24 }, (_, seed) => successReasons(cat, { ...challenge, seed }, result, reading)[0]);
      const allowed = cat.successPhrases![challenge.stages[0].requirements[0].facet].quality[reading];
      expect(a).toEqual(b);
      expect(a.every((line) => allowed.includes(line!))).toBe(true);
      expect(new Set(a).size).toBeGreaterThan(1);
    }
  });

  it('names the actual recipe parts selected by a real alternate named-route build', () => {
    let found: { challenge: Challenge; result: RunResult } | undefined;
    for (const scenario of cat.scenarios) for (const facet of scenario.facets) for (const level of facet.levels) {
      const challenge = resolveSpec(cat, { stages: [{ scenario: scenario.id, facets: [{ facet: facet.id, level }] }] },
        { id: 'alternate-success-reason', seed: 51, tier: 1, source: 'generated' });
      const req = challenge.stages[0].requirements[0];
      for (const alternate of req.namedFixes?.slice(1) ?? []) {
        const build = { ...defaultModel(cat) };
        for (const id of alternate) build[cat.variants.find((variant) => variant.id === id)!.aspect] = id;
        const result = evaluate(cat, build, challenge);
        if (result.requirements[0]?.route === 'named' && req.namedFixes?.slice(1).some((fix) =>
          JSON.stringify(fix) === JSON.stringify(result.requirements[0].parts))) {
          found = { challenge, result };
          break;
        }
      }
      if (found) break;
    }
    expect(found, 'catalog should provide a named recipe alternative').toBeDefined();
    const line = successReasons(cat, found!.challenge, found!.result, 'easy')[0];
    for (const id of found!.result.requirements[0].parts!) {
      const fullName = cat.variants.find((variant) => variant.id === id)!.name;
      expect(line).toContain(cat.successPartNames?.[id] ?? fullName);
    }
  });

  it('uses a quality reason for stat success without inventing a part', () => {
    const challenge = oneRequirement(cat);
    const req = challenge.stages[0].requirements[0];
    const line = successReasons(cat, challenge, resultFor(challenge, 'stat'), 'medium')[0];
    expect(cat.successPhrases![req.facet].quality.medium).toContain(line);
    for (const variant of cat.variants) expect(line).not.toContain(variant.name);
  });

  it('returns no reasons for a failed run', () => {
    const challenge = oneRequirement(cat);
    expect(successReasons(cat, challenge, { ...resultFor(challenge), passed: false }, 'easy')).toEqual([]);
  });

  it('keeps the two highest levels and breaks ties in challenge order', () => {
    const scenario = cat.scenarios.find((item) => item.facets.length >= 3)!;
    const chosen = scenario.facets.slice(0, 3);
    const base = resolveSpec(cat, { stages: [{ scenario: scenario.id, facets: chosen.map((facet) => ({ facet: facet.id, level: facet.levels[0] })) }] },
      { id: 'success-reason-priority', seed: 91, tier: 1, source: 'generated' });
    const replacements = [1, 3, 2];
    const phraseBanks = { ...cat.successPhrases };
    const challenge: Challenge = {
      ...base,
      stages: [{ ...base.stages[0], requirements: base.stages[0].requirements.map((req, i) => ({ ...req, id: `priority-${i}`, level: replacements[i] })) }],
    };
    const markerCatalog: WorkshopCatalog = {
      ...cat,
      successPhrases: Object.fromEntries(chosen.map((facet, i) => {
        const phrase = phraseBanks[facet.id]!;
        const qualityByLevel: Record<number, LeveledPhrases> = {};
        for (const level of [1, 2, 3]) qualityByLevel[level] = {
          starter: ['You did it!', 'A smart fix!'],
          easy: [`facet${i}-level${level}-one`, `facet${i}-level${level}-two`],
          medium: [`facet${i}-level${level}-one`, `facet${i}-level${level}-two`],
          hard: [`facet${i}-level${level}-one`, `facet${i}-level${level}-two`],
        };
        return [facet.id, { ...phrase, qualityByLevel }];
      })),
    };
    const makeResult = (c: Challenge): RunResult => ({
      ...resultFor(c),
      requirements: c.stages[0].requirements.map((req) => ({ id: req.id, passed: true, reached: true, route: 'stat' })),
    });
    const result = makeResult(challenge);
    expect(successReasons(markerCatalog, challenge, result, 'easy')).toEqual([
      expect.stringMatching(/^facet1-level3-/), expect.stringMatching(/^facet2-level2-/),
    ]);

    const tied: Challenge = {
      ...challenge,
      stages: [{ ...challenge.stages[0], requirements: challenge.stages[0].requirements.map((req) => ({ ...req, level: 2 })) }],
    };
    expect(successReasons(markerCatalog, tied, makeResult(tied), 'easy')).toEqual([
      expect.stringMatching(/^facet0-level2-/), expect.stringMatching(/^facet1-level2-/),
    ]);
  });
});

describe('success reason catalog validation', () => {
  const race = CATALOGS.race;
  const facet = race.scenarios[0].facets[0].id;

  it('requires success content for every facet and reading level', () => {
    const missingFacet = { ...race, successPhrases: { ...race.successPhrases } };
    delete (missingFacet.successPhrases as Record<string, unknown>)[facet];
    expect(validateCatalog(missingFacet).join('\n')).toMatch(/facet.*no success phrases/i);

    const missingLevel = { ...race, successPhrases: { ...race.successPhrases } };
    const phrase = { ...race.successPhrases![facet], quality: { ...race.successPhrases![facet].quality } };
    delete (phrase.quality as Record<string, unknown>).easy;
    missingLevel.successPhrases = { ...missingLevel.successPhrases, [facet]: phrase };
    expect(validateCatalog(missingLevel).join('\n')).toMatch(/success.*\[easy\]/i);
  });

  it('rejects over-limit and hard words in success reasons', () => {
    const phrases = { ...race.successPhrases![facet] };
    const quality = { ...phrases.quality, easy: ['This sentence has far too many words today.', 'It works.'] };
    const bad = {
      ...race,
      successPhrases: { ...race.successPhrases, [facet]: { ...phrases, quality } },
    };
    expect(validateCatalog(bad).join('\n')).toMatch(/success.*easy/i);
    const hard = {
      ...race,
      successPhrases: { ...race.successPhrases, [facet]: { ...phrases, quality: { ...phrases.quality, easy: ['This is gooey.', 'It works.'] } } },
    };
    expect(validateCatalog(hard).join('\n')).toMatch(/hard word/i);
  });
});
