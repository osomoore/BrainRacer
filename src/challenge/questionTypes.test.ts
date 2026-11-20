import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { ChallengeKind, QuestionTypes } from '../core/types';
import { ChallengeFactory } from './ChallengeFactory';
import { ChallengeGenerator } from './ChallengeGenerator';
import { ChallengeScheduler } from './ChallengeScheduler';

const selections: [string, QuestionTypes, ChallengeKind[]][] = [
  ['addition', { addition: true, multiplication: false, spelling: false }, ['math']],
  ['multiplication', { addition: false, multiplication: true, spelling: false }, ['multiplication']],
  ['spelling', { addition: false, multiplication: false, spelling: true }, ['picToWord', 'wordToPic']],
  ['both math types', { addition: true, multiplication: true, spelling: false }, ['math', 'multiplication']],
  ['all', { addition: true, multiplication: true, spelling: true }, ['math', 'multiplication', 'picToWord', 'wordToPic']],
];

describe.each(selections)('%s question selection', (_label, questionTypes, expectedKinds) => {
  const options = () => ({
    player: 0 as const,
    difficulty: 'normal' as const,
    mode: 'mixed' as const,
    generator: new ChallengeGenerator(new Rng(3)),
    rng: new Rng(5),
    questionTypes,
  });

  it('filters Stop & Answer questions and their place prompts', () => {
    const factory = new ChallengeFactory(options());
    const challenges = Array.from({ length: 100 }, () => factory.make());
    expect(new Set(challenges.map((c) => c.kind))).toEqual(new Set(expectedKinds));
    expect(challenges.every((c) => c.options.length === 4)).toBe(true);
    expect(factory.make('bakery').source).toBe(questionTypes.spelling ? 'place' : 'random');
  });

  it('filters While Driving questions and their place prompts', () => {
    const scheduler = new ChallengeScheduler({ ...options(), startDelaySec: 3, intervalSec: 5 });
    expect(scheduler.notifyPlace('bakery', 1).map((e) => e.challenge.source)).toEqual(questionTypes.spelling ? ['place'] : []);
    const challenges = scheduler.update(500).flatMap((e) => e.type === 'shown' ? [e.challenge] : []);
    expect(new Set(challenges.map((c) => c.kind))).toEqual(new Set(expectedKinds));
    expect(challenges.every((c) => c.options.length === 3)).toBe(true);
  });
});
