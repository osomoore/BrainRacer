import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOGS } from '../content';
import { PRACTICE_TITLES } from '../content/practiceTitles';
import type { Challenge, Requirement, VariantId } from '../core/types';
import { evaluate } from '../logic/evaluate';
import { practiceChallenge, practiceTitle } from '../logic/practice';
import { defaultModel, partTag } from '../logic/stats';
import { genericPlayer } from './common/generic';
import { practiceBeats } from './common/practicePlan';
import { dinoPracticeScenes } from './dino/practice';
import { racePracticeScenes } from './race/practice';
import { playerFor } from './runner';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('./common/generic', () => ({ genericPlayer: vi.fn() }));

const WORKSHOPS = [
  { cat: CATALOGS.race, scenes: racePracticeScenes },
  { cat: CATALOGS.dino, scenes: dinoPracticeScenes },
];

describe.each(WORKSHOPS)('$cat.id practice', ({ cat, scenes }) => {
  beforeEach(() => vi.clearAllMocks());

  it('registers a dedicated player for every scenario including practice', () => {
    for (const scenario of [...cat.scenarios.map(({ id }) => id), 'practice']) {
      const player = playerFor(cat.id, scenario);
      expect(player).toMatchObject({ workshop: cat.id, scenario, play: expect.any(Function) });
    }
    expect(genericPlayer).not.toHaveBeenCalled();
  });

  it('has a scene and distinct title for each catalog aspect', () => {
    const aspects = cat.aspects.map(({ id }) => id).sort();
    expect(Object.keys(scenes).sort()).toEqual(aspects);
    expect(Object.keys(PRACTICE_TITLES[cat.id]).sort()).toEqual(aspects);
    const titles = aspects.map((aspect) => practiceTitle(cat.id, [{ aspect }]));
    expect(new Set(titles).size).toBe(aspects.length);
    expect(titles.every((title) => title && title !== 'Practice')).toBe(true);
    expect(practiceTitle(cat.id, aspects.slice(0, 2).map((aspect) => ({ aspect })))).toBe(titles.slice(0, 2).join(' & '));
  });

  it('uses the asked variants and plays both results in card order, even after a miss', () => {
    const model = defaultModel(cat);
    const aspect = cat.aspects[0];
    const wrong = aspect.starters.find((id) => id !== model[aspect.id])!;
    const second = model[cat.aspects[1].id];
    const requirements: Requirement[] = [wrong, second].map((id, index) => {
      const aspect = cat.variants.find((v) => v.id === id)!.aspect;
      const text = { easy: '', medium: '', hard: '' };
      return { id: String(index), facet: 'practice.' + aspect, level: 1, checks: [{ kind: 'tag', tag: partTag(id) }],
        text, hint: { aspect, text } };
    });
    const single = practiceChallenge(cat, 'practice-test', 7, 0, new Set<VariantId>([wrong]), model, null, new Set(), true)!;
    expect(single.title).toBe(practiceTitle(cat.id, [{ aspect: aspect.id }]));
    const challenge: Challenge = { ...single, stages: [{ ...single.stages[0], requirements }] };
    const result = evaluate(cat, model, challenge);
    expect(practiceBeats(cat, challenge.stages[0], result.requirements).map(({ part, passed }) => [part.id, passed]))
      .toEqual([[wrong, false], [second, true]]);
  });
});
