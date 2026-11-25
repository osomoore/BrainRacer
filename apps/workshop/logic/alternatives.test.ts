import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../content';
import type { Check } from '../core/types';
import { affordability, solveAffordable } from './affordability';
import { challengeKey, generateChallenge } from './generator';
import { engine } from './index';
import { starterChallenge } from './starters';
import { flatChecks } from './util';
import { validateCatalog } from './validateCatalog';

const dino = CATALOGS.dino;
const initial = engine.newProgress('dino');
const peek = starterChallenge(dino, dino.starters.find((spec) => spec.id === 'dino-start-stand')!);
const [requirement] = peek.stages[0].requirements;
const peekChecks = flatChecks(peek);

describe('alternative challenge fixes', () => {
  it('passes one tall-grass requirement with any fair fix and still pays two', () => {
    const options = [
      { ...initial.model, move: 'move.stand' },
      { ...initial.model, head: 'head.longNeck' },
      { ...initial.model, size: 'size.big' },
      { ...initial.model, size: 'size.huge' },
    ];
    for (const model of options) {
      const result = engine.evaluate('dino', model, peek);
      expect(result.passed).toBe(true);
      expect(result.requirements).toMatchObject([{ id: requirement.id, passed: true, reached: true }]);
    }
    const failure = engine.evaluate('dino', initial.model, peek);
    expect(failure.passed).toBe(false);
    expect(failure.stages[0].firstFail).toBe(requirement.id);

    const progress = { ...initial, active: [peek.id], challenges: { [peek.id]: peek }, bought: ['size.big'] };
    expect(engine.recordWin('dino', progress, peek.id, options[2], 1)).toMatchObject({ firstWin: true, payout: 1 });
  });

  it('selects the cheapest complete option, including owned parts and total cost constraints', () => {
    expect(solveAffordable(dino, peekChecks, initial)).toMatchObject({ cost: 2, build: { move: 'move.stand' } });
    const locked = { ...initial, overrides: { 'move.stand': 'locked' as const } };
    expect(solveAffordable(dino, peekChecks, locked)?.cost).toBe(3);
    expect(solveAffordable(dino, peekChecks, { ...locked, wallet: 2 })).toBeNull();
    const owned = { ...locked, wallet: 0, bought: ['size.big'] };
    expect(solveAffordable(dino, peekChecks, owned)).toMatchObject({ cost: 0, build: { size: 'size.big' } });

    const extraChecks: Check[] = [
      { kind: 'noTag', tag: 'pose:stand' },
      { kind: 'tag', tag: 'diet:critters' },
    ];
    // The stand option conflicts with another check. Buying a different fix and teeth costs 5 together.
    expect(solveAffordable(dino, [...peekChecks, ...extraChecks], initial)).toBeNull();
    expect(solveAffordable(dino, [...peekChecks, ...extraChecks], { ...initial, wallet: 5 })?.cost).toBe(5);
  });

  it('generates for an affordable alternative and rejects builds that already pass via any option', () => {
    const grass = dino.scenarios.find((scenario) => scenario.id === 'tallGrass')!;
    const facet = grass.facets.find((item) => item.id === requirement.facet)!;
    const catalog = { ...dino, scenarios: [{ ...grass, facets: [{ ...facet, levels: [1] }] }] };
    const progress = { ...initial, overrides: { 'move.stand': 'locked' as const } };
    const budget = affordability(catalog, progress);
    const options = {
      tier: 0, avail: budget.pool, current: progress.model, lastWin: null, minChanged: 2,
      newest: null, usedKeys: new Set<string>(), avoidScenarios: new Set<string>(), attempts: 1,
      strictCurrent: true, accepts: (checks: readonly Check[]) => budget.solve(checks)?.cost === 3,
    };
    const generate = (params: Parameters<typeof generateChallenge>[4]) =>
      generateChallenge(catalog, 'test', 'generated', 1, params);
    expect(flatChecks(generate(options)!.challenge)).toEqual(peekChecks);
    const longNeck = { ...progress.model, head: 'head.longNeck' };
    const bigBody = { ...progress.model, size: 'size.big' };
    expect(generate({ ...options, current: longNeck })).toBeNull();
    expect(generate({ ...options, lastWin: bigBody })).toBeNull();
    expect(generate({ ...options, usedKeys: new Set([challengeKey(peek)]) })).toBeNull();
  });

  it('classifies a card by its cheapest complete alternative', () => {
    const progress = { ...initial, active: [peek.id], challenges: { [peek.id]: peek }, bought: ['size.big'] };
    const board = engine.refreshBoard('dino', progress);
    expect(board.active).toContain(peek.id);
    const costs = board.active.map((id) => affordability(dino, board).cheapest(flatChecks(board.challenges[id]))!.cost);
    expect(costs.slice(0, 2)).toEqual([0, 2]);
    expect(costs[2]).toBeGreaterThan(board.wallet);
  });

  it('keeps old resolved checks and round-trips new ones with the same save version and requirement ids', () => {
    const legacy = {
      ...peek,
      id: 'legacy-stand',
      stages: [{ ...peek.stages[0], requirements: [{ ...requirement, checks: [{ kind: 'tag' as const, tag: 'pose:stand' }] }] }],
    };
    delete legacy.stages[0].requirements[0].namedFixes;
    const progress = {
      ...initial, active: [legacy.id, peek.id], fails: { [legacy.id]: 2 },
      challenges: { [legacy.id]: legacy, [peek.id]: peek },
    };
    const save = { ...engine.newPlayerSave('medium'), workshops: { dino: progress } };
    const normalized = engine.normalizeSave(JSON.parse(JSON.stringify(save)))!;
    expect(normalized.workshops.dino).toMatchObject(progress);
    expect(engine.normalizeSave(JSON.parse(JSON.stringify(normalized)))).toEqual(normalized);
    expect(engine.evaluate('dino', { ...initial.model, size: 'size.big' }, legacy).passed).toBe(false);
  });

  it('reports guidelines over the limit at every reading level', () => {
    const facetPhrases = dino.facetPhrases.map((phrases) => phrases.facet === requirement.facet ? {
      ...phrases, requirement: [{
        starter: phrases.requirement[0].starter,
        easy: ['One two three four five six seven.', 'Stand or use a long neck.'],
        medium: ['One two three four five six seven eight nine.', 'Stand or use a long neck.'],
        hard: ['One two three four five six seven eight nine ten eleven twelve thirteen.', 'Stand or use a long neck.'],
      }, ...phrases.requirement.slice(1)],
    } : phrases);
    expect(validateCatalog({ ...dino, facetPhrases })).toEqual(expect.arrayContaining([
      expect.stringContaining('[easy]: guideline exceeds 6 words'),
      expect.stringContaining('[medium]: guideline exceeds 8 words'),
      expect.stringContaining('[hard]: guideline exceeds 12 words'),
    ]));
  });
});
