import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { ChallengeKind, Difficulty, QuestionTypes } from '../core/types';
import { ChallengeFactory } from './ChallengeFactory';
import { ChallengeGenerator } from './ChallengeGenerator';
import { ChallengeScheduler } from './ChallengeScheduler';

const selections: [string, QuestionTypes, Difficulty, ChallengeKind[]][] = [
  ['math (normal = addition)', { math: true, reading: false, jbq: false }, 'normal', ['math']],
  ['math (hard = multiplication)', { math: true, reading: false, jbq: false }, 'hard', ['multiplication']],
  ['reading', { math: false, reading: true, jbq: false }, 'normal', ['picToWord', 'wordToPic']],
  ['math + reading', { math: true, reading: true, jbq: false }, 'normal', ['math', 'picToWord', 'wordToPic']],
];

describe.each(selections)('%s question selection', (_label, questionTypes, difficulty, expectedKinds) => {
  const options = () => ({
    player: 0 as const,
    difficulty,
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
    expect(factory.make('bakery').source).toBe(questionTypes.reading ? 'place' : 'random');
  });

  it('filters While Driving questions and their place prompts', () => {
    const scheduler = new ChallengeScheduler({ ...options(), startDelaySec: 3, intervalSec: 5 });
    expect(scheduler.notifyPlace('bakery', 1).map((e) => e.challenge.source)).toEqual(questionTypes.reading ? ['place'] : []);
    const challenges = scheduler.update(500).flatMap((e) => e.type === 'shown' ? [e.challenge] : []);
    expect(new Set(challenges.map((c) => c.kind))).toEqual(new Set(expectedKinds));
    expect(challenges.every((c) => c.options.length === 3)).toBe(true);
  });
});
