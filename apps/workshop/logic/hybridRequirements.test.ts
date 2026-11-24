import { describe, expect, it } from 'vitest';
import { BUDDY_KINDS } from '../../../shared/buddies/catalog';
import { CATALOGS } from '../content';
import { READING_LEVELS } from '../core/types';
import type { BasicCheck, Model, Variant, WorkshopCatalog } from '../core/types';
import { evaluate } from './evaluate';
import { engine } from './index';
import { checkOptions, lineFixes } from './namedFixes';
import { allPass, computeModel, defaultModel, partTag } from './stats';
import { cleverWinMessage, resolveSpec } from './text';
import { flatChecks } from './util';
import { validateCatalog } from './validateCatalog';

function card(cat: WorkshopCatalog, scenario: string, facet: string, level: number) {
  return resolveSpec(cat, { stages: [{ scenario, facets: [{ facet, level }] }] },
    { id: 'hybrid', seed: 42, tier: 3, source: 'generated' });
}

function adversePart(part: Variant, check: BasicCheck): number {
  if (check.kind === 'statMin') return -(part.stats[check.stat] ?? 0);
  if (check.kind === 'statMax') return part.stats[check.stat] ?? 0;
  const tagged = part.tags.includes(check.tag) || partTag(part.id) === check.tag;
  return Number(check.kind === 'tag' ? !tagged : tagged);
}

function worstBuild(cat: WorkshopCatalog, check: BasicCheck): Model {
  return Object.fromEntries(cat.aspects.map(({ id }) => {
    const parts = cat.variants.filter((part) => part.aspect === id);
    const worst = parts.reduce((a, b) => adversePart(a, check) >= adversePart(b, check) ? a : b);
    return [id, worst.id];
  }));
}

describe.each(Object.values(CATALOGS))('$title hybrid requirements', (cat) => {
  it('honors every named fix from every phrase on builds hostile to each original check', () => {
    for (const scenario of cat.scenarios) for (const facet of scenario.facets) {
      const phrases = cat.facetPhrases.find((p) => p.facet === facet.id)!;
      for (const [i, level] of facet.levels.entries()) {
        const challenge = card(cat, scenario.id, facet.id, level);
        const checks = facet.check(level);
        const worstBuilds = checkOptions(checks).flat().map((check) => worstBuild(cat, check));
        for (const reading of READING_LEVELS) for (const text of phrases.requirement[i][reading]) {
          const fixes = lineFixes(cat, checks, text);
          const label = `${facet.id} ${level} [${reading}] ${text}`;
          expect(fixes.length, label).toBeGreaterThan(0);
          for (const fix of fixes) for (const worst of worstBuilds) {
            const model = { ...worst };
            for (const id of fix) model[cat.variants.find((part) => part.id === id)!.aspect] = id;
            expect(evaluate(cat, model, challenge), label).toMatchObject({
              passed: true, cleverWin: false, requirements: [{ route: 'named' }],
            });
            expect(allPass(flatChecks(challenge), computeModel(cat, model)), label).toBe(true);
          }
        }
      }
    }
  });

  it('picks seeded celebration variants from the requested reading level', () => {
    for (const reading of READING_LEVELS) {
      const phrases = cat.cleverWinPhrases![reading];
      const selected = Array.from({ length: 64 }, (_, seed) => cleverWinMessage(cat, reading, seed));
      expect(new Set(selected)).toEqual(new Set(phrases));
      expect(selected).toEqual(selected.map((_, seed) => cleverWinMessage(cat, reading, seed)));
    }
  });
});

it('derives complete AND and OR options and leaves excluded parts out', () => {
  const { dino } = CATALOGS;
  const check = card(dino, 'snack', 'snack.bite', 2).stages[0].requirements[0].checks;
  expect(lineFixes(dino, check, 'Pick Sharp Teeth, or Big Teeth and a Rex Head.')).toEqual([
    ['teeth.sharp'], expect.arrayContaining(['teeth.big', 'head.rex']),
  ]);
  const canyon = card(dino, 'canyon', 'canyon.fly', 2).stages[0].requirements[0].checks;
  expect(lineFixes(dino, canyon, 'Pick Flying and stay small, not Big or Huge, to fly far.')).toEqual([
    expect.arrayContaining(['move.fly', 'size.small']),
  ]);
  const grass = card(dino, 'tallGrass', 'tallGrass.peek', 1);
  expect(evaluate(dino, { ...defaultModel(dino), size: 'size.huge' }, grass)).toMatchObject({
    passed: true, cleverWin: false, requirements: [{ route: 'check' }],
  });
});

const race = CATALOGS.race;
const jump = card(race, 'jump', 'jump.speed', 2);
const base = defaultModel(race);
const unusual = { ...base, wheels: 'wheels.racing', engine: 'engine.turbo' };

it('prefers the named route, marks alternate stat wins and requires the entire run to pass', () => {
  expect(evaluate(race, base, jump)).toMatchObject({
    passed: false, cleverWin: false, requirements: [{ route: null }],
  });
  expect(evaluate(race, unusual, jump)).toMatchObject({
    passed: true, cleverWin: true, requirements: [{ route: 'stat' }],
  });
  expect(evaluate(race, { ...unusual, gears: 'gears.speedy', extra: 'extra.rocket' }, jump)).toMatchObject({
    passed: true, cleverWin: false, requirements: [{ route: 'named' }],
  });
  const mud = card(race, 'mud', 'mud.grip', 3);
  expect(evaluate(race, unusual, { ...jump, stages: [...jump.stages, ...mud.stages] })).toMatchObject({
    passed: false, cleverWin: false, requirements: [{ route: 'stat' }, { route: null }],
  });
  const fog = card(race, 'fog', 'fog.bright', 1);
  expect(evaluate(race, { ...unusual, paint: 'paint.yellow' }, { ...jump, stages: [...jump.stages, ...fog.stages] })).toMatchObject({
    passed: true, cleverWin: true, requirements: [{ route: 'stat' }, { route: 'named' }],
  });
});

it('awards one extra buddy point, including an unlock and overflow at ten', () => {
  const progress = engine.newProgress('race');
  for (const [points, expected, unlock] of [[0, 2, false], [8, 0, true], [9, 1, true]] as const) {
    const p = { ...progress, challenges: { [jump.id]: jump }, active: [jump.id],
      bought: [unusual.wheels, unusual.engine], buddies: { ...progress.buddies, progress: points } };
    const win = engine.recordWin('race', p, jump.id, unusual, 1);
    expect(win).toMatchObject({ firstWin: true, payout: 1, progress: { buddies: { progress: expected } } });
    expect(Boolean(win.unlockedBuddy)).toBe(unlock);
    const again = engine.recordWin('race', win.progress, jump.id, unusual, 2);
    expect(again.progress.buddies.progress).toBe(expected);
    if (points === 9) {
      const final = engine.recordWin('race', {
        ...p, buddies: { ...p.buddies, unlocked: BUDDY_KINDS.filter((kind) => kind !== BUDDY_KINDS.at(-1)) },
      }, jump.id, unusual, 1);
      expect(final.progress.buddies.progress).toBe(10);
    }
  }
});

it('validates clever-win wording at every reading level', () => {
  const phrases = {
    easy: ['One two three four five six seven.', 'Nice fix!'],
    medium: ['One two three four five six seven eight nine.', 'Great fix!'],
    hard: ['One two three four five six seven eight nine ten eleven twelve thirteen.', 'You solved the obstacle!'],
  };
  const problems = validateCatalog({ ...race, cleverWinPhrases: phrases }).join('\n');
  expect(problems).toContain('clever win [easy]: exceeds 6 words');
  expect(problems).toContain('clever win [medium]: exceeds 8 words');
  expect(problems).toContain('clever win [hard]: exceeds 12 words');
  expect(problems).toContain('clever win [hard]: hard word "obstacle"');
});
