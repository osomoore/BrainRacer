import { describe, expect, it } from 'vitest';
import { WS_UI } from '../config';
import { CATALOGS } from './index';
import { STARTER_DENYLIST, starterWordProblems } from './starterWords';
import { distinctFixes, lineFixes } from '../logic/namedFixes';
import { catalogFixes } from '../logic/text';
import { validateCatalog } from '../logic/validateCatalog';
import { STARTER_FAIL, STARTER_HINT, STARTER_PART, STARTER_RESULTS, STARTER_SHORT_FIX, STARTER_TEST_TITLE } from '../logic/wording';

describe.each(Object.values(CATALOGS))('$title Starter wording', (cat) => {
  it('requires Starter copy and checks the authored banks and filled-in part names', () => {
    expect(validateCatalog(cat)).toEqual([]);

    const phrase = cat.facetPhrases[0];
    const hint = { ...phrase.hint };
    Reflect.deleteProperty(hint, 'starter');
    expect(validateCatalog({ ...cat, facetPhrases: [{ ...phrase, hint }, ...cat.facetPhrases.slice(1)] }))
      .toEqual(expect.arrayContaining([expect.stringContaining('hint [starter]: needs >= 2 sentences')]));
  });

  it('enforces the Starter guideline limit and rejects words outside the allowlist', () => {
    const phrase = cat.facetPhrases[0];
    const [first, ...rest] = phrase.requirement;
    const requirement = [{ ...first, starter: ['Pick the bright part and do the test.', first.starter[1]] }, ...rest];
    expect(validateCatalog({ ...cat, facetPhrases: [{ ...phrase, requirement }, ...cat.facetPhrases.slice(1)] }))
      .toEqual(expect.arrayContaining([
        expect.stringContaining('[starter] row 1: guideline sentence exceeds 6 words'),
        expect.stringContaining('Starter word "bright" is not decodable'),
      ]));
  });

  it('rejects a one-word Starter sentence', () => {
    const phrase = cat.facetPhrases[0];
    const hint = { ...phrase.hint, starter: ['Hop! Check it.', phrase.hint.starter[1]] };
    expect(validateCatalog({ ...cat, facetPhrases: [{ ...phrase, hint }, ...cat.facetPhrases.slice(1)] }))
      .toContainEqual(expect.stringContaining('Starter sentences need at least 2 words'));
  });

  it('keeps the named fixes from Easy through Hard', () => {
    for (const { facets } of cat.scenarios) for (const facet of facets) {
      const phrases = cat.facetPhrases.find((p) => p.facet === facet.id)!;
      for (const [i, level] of facet.levels.entries()) {
        const { easy, medium, hard } = phrases.requirement[i];
        const existing = [...easy, ...medium, ...hard].flatMap((line) => lineFixes(cat, facet.check(level), line));
        expect(catalogFixes(cat, facet, level), `${facet.id} level ${level}`).toEqual(distinctFixes(existing));
      }
    }
  });

  it('checks built-in Starter wording and rejects hard words outside exact shop names', () => {
    for (const text of [WS_UI.readingSamples.starter, STARTER_FAIL, STARTER_PART, STARTER_SHORT_FIX, STARTER_TEST_TITLE, ...STARTER_HINT, ...Object.values(STARTER_RESULTS)]) {
      expect(starterWordProblems(cat, text), text).toEqual([]);
    }
    for (const word of STARTER_DENYLIST) expect(starterWordProblems(cat, `Get ${word}.`)).toEqual([word]);
  });
});

it('allows the exact shop name but still rejects "bright" in surrounding copy', () => {
  expect(starterWordProblems(CATALOGS.race, 'Pick Bright Yellow.')).toEqual([]);
  expect(starterWordProblems(CATALOGS.race, 'Pick bright paint.')).toContain('bright');
});
