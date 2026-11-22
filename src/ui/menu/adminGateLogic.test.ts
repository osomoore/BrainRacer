import { describe, expect, it } from 'vitest';
import { appendGateDigit, checkGateAnswer, makeGateQuestion } from './adminGateLogic';

describe('adminGateLogic', () => {
  it('keeps both factors within 6..12 at the rng extremes', () => {
    for (const r of [0, 0.5, 0.999999, 1]) {
      const q = makeGateQuestion(() => r, 6, 12);
      expect(q.a).toBeGreaterThanOrEqual(6); expect(q.a).toBeLessThanOrEqual(12);
      expect(q.b).toBeGreaterThanOrEqual(6); expect(q.b).toBeLessThanOrEqual(12);
      expect(q.answer).toBe(q.a * q.b);
    }
    expect(makeGateQuestion(() => 0, 6, 12)).toEqual({ a: 6, b: 6, answer: 36 });
  });
  it('covers every factor with a sweeping rng', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 7; i++) seen.add(makeGateQuestion(() => i / 7, 6, 12).a);
    expect([...seen].sort((x, y) => x - y)).toEqual([6, 7, 8, 9, 10, 11, 12]);
  });
  it('checks answers', () => {
    const q = { a: 7, b: 9, answer: 63 };
    expect(checkGateAnswer(q, '63')).toBe(true);
    expect(checkGateAnswer(q, '64')).toBe(false);
    expect(checkGateAnswer(q, '')).toBe(false);
  });
  it('appends digits with a cap and no stacked leading zero', () => {
    expect(appendGateDigit('', 6, 3)).toBe('6');
    expect(appendGateDigit('0', 5, 3)).toBe('5');
    expect(appendGateDigit('144', 1, 3)).toBe('144');
  });
});
