import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { ChallengeKind, Difficulty, QuestionTypes } from '../core/types';
import { ChallengeFactory } from './ChallengeFactory';
import { ChallengeGenerator } from './ChallengeGenerator';
import { ChallengeScheduler, kindsForMode, kindWeights } from './ChallengeScheduler';

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

  it('filters While Driving questions and their place prompts (deprecated style)', () => {
    const scheduler = new ChallengeScheduler({ ...options(), startDelaySec: 3, intervalSec: 5 });
    expect(scheduler.notifyPlace('bakery', 1).map((e) => e.challenge.source)).toEqual(questionTypes.reading ? ['place'] : []);
    const challenges = scheduler.update(500).flatMap((e) => e.type === 'shown' ? [e.challenge] : []);
    expect(new Set(challenges.map((c) => c.kind))).toEqual(new Set(expectedKinds));
    expect(challenges.every((c) => c.options.length === 3)).toBe(true);
  });
});

describe('JBQ question selection', () => {
  const jbqOnly: QuestionTypes = { math: false, reading: false, jbq: true };
  const all: QuestionTypes = { math: true, reading: true, jbq: true };
  const options = (questionTypes: QuestionTypes) => ({
    player: 0 as const, difficulty: 'normal' as Difficulty, mode: 'mixed' as const,
    generator: new ChallengeGenerator(new Rng(3)), rng: new Rng(5), questionTypes, today: '2026-11-22',
  });

  it('kindsForMode has no temporary fallback: JBQ-only is just jbq', () => {
    expect(kindsForMode('mixed', jbqOnly, 'normal')).toEqual(['jbq']);
    expect(kindsForMode('mixed', all, 'hard')).toEqual(['picToWord', 'multiplication', 'wordToPic', 'jbq']);
  });

  it('gives each enabled question type an equal share', () => {
    const w = kindWeights(['picToWord', 'math', 'wordToPic', 'jbq'], 'normal');
    const [pic, math, word, jbq] = w;
    expect(pic + word).toBeCloseTo(1 / 3);
    expect(math).toBeCloseTo(1 / 3);
    expect(jbq).toBeCloseTo(1 / 3);
    expect(kindWeights(['math', 'jbq'], 'easy')).toEqual([0.5, 0.5]);
  });

  it('Stop & Answer: JBQ-only racers only get 4-option JBQ questions with jbq info', () => {
    const factory = new ChallengeFactory(options(jbqOnly));
    const cs = Array.from({ length: 30 }, () => factory.make());
    expect(cs.every((c) => c.kind === 'jbq' && c.options.length === 4 && c.jbq !== undefined && c.durationSec === 0)).toBe(true);
    expect(factory.make('bakery').kind).toBe('jbq');   // no reading: place words are ignored
  });

  it('Stop & Answer: all types appear, roughly one third each', () => {
    const factory = new ChallengeFactory(options(all));
    const n = 900;
    const count = { jbq: 0, math: 0, reading: 0 };
    for (let i = 0; i < n; i++) {
      const k = factory.make().kind;
      count[k === 'jbq' ? 'jbq' : k === 'math' ? 'math' : 'reading']++;
    }
    for (const v of Object.values(count)) { expect(v / n).toBeGreaterThan(0.26); expect(v / n).toBeLessThan(0.41); }
  });

  it('uses the racer scope, date and progress', () => {
    const factory = new ChallengeFactory({ ...options(jbqOnly), jbq: { points: 30, scope: 'month' }, jbqCount: () => 0 });
    for (let i = 0; i < 40; i++) {
      const id = factory.make().jbq!.id;
      expect(id).toBeGreaterThanOrEqual(529);
      expect(id).toBeLessThanOrEqual(576);
    }
  });

  it('While Driving (deprecated) never asks JBQ', () => {
    const s = new ChallengeScheduler({ ...options(all), startDelaySec: 3, intervalSec: 5 });
    const kinds = new Set(s.update(500).flatMap((e) => e.type === 'shown' ? [e.challenge.kind] : []));
    expect(kinds.has('jbq')).toBe(false);
    const j = new ChallengeScheduler({ ...options(jbqOnly), startDelaySec: 3, intervalSec: 5 });
    expect(j.update(20).some((e) => e.type === 'shown')).toBe(true);
  });
});
