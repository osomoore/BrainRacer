import { describe, expect, it } from 'vitest';
import { READING_LEVELS } from '../core/types';
import type { LeveledPhrases, WorkshopCatalog } from '../core/types';
import { aspectIdsAt } from '../logic/aspects';
import { available } from '../logic/available';
import { evaluate } from '../logic/evaluate';
import { solvable } from '../logic/solver';
import { defaultModel } from '../logic/stats';
import { resolveSpec, specChecks } from '../logic/text';
import { CATALOGS } from './index';

// Shop labels are copied verbatim, including capitals. Ordinary sentence openers
// and names in the setting are allowed outside those labels.
const SETTING_NAMES = ['Farmer Jo', 'Red Parade', 'Green Parade', 'Rainbow Parade'];
const NICKNAMES = /\b(?:coats?|fluff(?:y)?|big feet|stripes thing|pointy teeth|springy legs|giant wheels|strong jaw|flat tail|hook on a rope|breath(?:e|ing) through a tube)\b/gi;
const PART_ADVICE = /(?:^|\b(?:so|and|then)\s+)(?:add|change|check|drop|equip|find|fit|get|keep|look|lose|pick|put|remove|replace|skip|swap|take|try|use|wear)\b|\b(?:need(?:s|ed)?|should|must|would help|too (?:hot|warm))\b/i;
const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function namePattern(names: string[]): RegExp {
  return new RegExp(`\\b(?:${names.sort((a, b) => b.length - a.length).map(escape).join('|')})\\b`, 'g');
}

function allLabelNames(cat: WorkshopCatalog): string[] {
  return [...cat.variants.map((v) => v.name), ...cat.aspects.map((a) => a.label)];
}

function instructionProblems(line: string, labelPattern: RegExp): string[] {
  const prose = line.replace(labelPattern, '#');
  const sentences = (prose.match(/[^.!?]+/g) ?? []).map((sentence) => sentence.trim());
  const nicknames = sentences.flatMap((sentence) => PART_ADVICE.test(sentence) ? sentence.match(NICKNAMES) ?? [] : []);
  // A capitalized word inside a sentence is a proposed label. At the start,
  // a capitalized phrase also counts (e.g. "Rocket Motor would help").
  const unknown = sentences.flatMap((sentence) => sentence
    .replace(/^[A-Z][a-z]*\b(?!\s+[A-Z])/, '').match(/\b[A-Z][A-Za-z0-9]*\b/g) ?? []);
  return [...nicknames, ...unknown.filter((name) => name !== 'I')];
}

function authoredBanks(cat: WorkshopCatalog): LeveledPhrases[] {
  return [
    ...cat.facetPhrases.flatMap(({ requirement, hint }) => [...requirement, hint]),
    ...cat.scenarioPhrases.map(({ intro }) => intro),
    ...Object.values(cat.stories ?? {}).flatMap(({ story, fail }) => [...story, fail]),
    ...Object.values(cat.practiceStories ?? {}),
    ...Object.values(cat.successPhrases ?? {}).flatMap(({ named, quality, qualityByLevel }) =>
      [named, quality, ...Object.values(qualityByLevel ?? {})]),
    ...[cat.practiceFail, cat.cleverWinPhrases].filter((bank) => bank !== undefined),
  ];
}

describe.each(Object.values(CATALOGS))('$title instruction wording', (cat) => {
  it('uses catalog labels and avoids known nicknames in challenge copy', () => {
    const labels = namePattern([...SETTING_NAMES, ...allLabelNames(cat)]);
    const problems = authoredBanks(cat).flatMap((bank) => READING_LEVELS.flatMap((reading) =>
      bank[reading].flatMap((line) => instructionProblems(line, labels).map((problem) => `${reading}: ${problem} in "${line}"`))));
    expect(problems).toEqual([]);
  });

  it('names only visible shop parts or stations on dealable Starter and Easy cards', () => {
    const shown = new Set(aspectIdsAt(cat, true));
    const hidden = new Set([
      ...cat.aspects.filter((a) => !shown.has(a.id)).map((a) => a.label),
      ...cat.variants.filter((v) => !shown.has(v.aspect)).map((v) => v.name),
    ]);
    const labels = namePattern(allLabelNames(cat));
    const allowed = available(cat, { easy: true, bought: cat.variants.map((v) => v.id), overrides: {} });
    const problems: string[] = [];
    for (const { id: scenario, facets } of cat.scenarios) for (const facet of facets) {
      const phrases = cat.facetPhrases.find(({ facet: id }) => id === facet.id);
      for (const [i, level] of facet.levels.entries()) {
        const spec = { stages: [{ scenario, facets: [{ facet: facet.id, level }] }] };
        if (!solvable(cat, specChecks(cat, spec), allowed)) continue;
        const story = cat.stories?.[facet.id]?.story[i];
        for (const reading of ['starter', 'easy'] as const) {
          const hints = shown.has(facet.hintAspect) ? phrases?.hint[reading] ?? [] : [];
          for (const line of [...(story?.[reading] ?? []), ...hints]) {
            const missing = (line.match(labels) ?? []).filter((name) => hidden.has(name));
            if (missing.length) problems.push(`${facet.id} ${level} ${reading}: ${missing.join(', ')} in "${line}"`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

it('catches both nicknames and made-up part labels', () => {
  const labels = namePattern(allLabelNames(CATALOGS.dino));
  expect(instructionProblems('Drop the fluffy coat and add Big Feet.', labels))
    .toEqual(['fluffy', 'coat', 'Feet']);
  expect(instructionProblems('Pick the big feet or the stripes thing.', labels))
    .toEqual(['big feet', 'stripes thing']);
  expect(instructionProblems('A fluffy cloud floats by.', labels)).toEqual([]);
  expect(instructionProblems('Swap Feathers for Ice Scales.', labels)).toContain('Scales');
  expect(instructionProblems('Pick a Slim Body at Body.', labels)).toEqual([]);
});

it('describes working Dino Lab builds at both hot-sun levels', () => {
  const cat = CATALOGS.dino;
  const model = defaultModel(cat);
  const test = (level: number) => resolveSpec(cat, {
    stages: [{ scenario: 'desert', facets: [{ facet: 'desert.cool', level }] }],
  }, { id: 'hot-sun', source: 'generated', seed: 1, tier: 1 });
  const warm = test(1);
  const hot = test(2);
  const slim = { ...model, body: 'body.slim' };
  const frill = { ...model, extra: 'extra.frill' };
  expect(evaluate(cat, slim, warm).passed).toBe(true);
  expect(evaluate(cat, frill, warm).passed).toBe(true);
  expect(evaluate(cat, slim, hot).passed).toBe(false);
  expect(evaluate(cat, frill, hot).passed).toBe(false);
  expect(evaluate(cat, { ...slim, extra: 'extra.glow' }, hot).passed).toBe(true);
  expect(evaluate(cat, { ...slim, extra: 'extra.frill' }, hot).passed).toBe(true);
  const first = warm.stages[0].requirements[0];
  const second = hot.stages[0].requirements[0];
  for (const reading of ['starter', 'easy'] as const) {
    expect(first.text[reading]).toContain('Slim Body');
    expect(first.hint.text[reading]).toContain('Body');
  }
  for (const reading of ['medium', 'hard'] as const) expect(first.text[reading]).toContain('Feathers');
  for (const reading of READING_LEVELS) expect(second.text[reading]).toContain('Slim Body');
});
