import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { Difficulty } from '../core/types';
import { generateMath } from './mathGen';

const sortedDigits = (n: number) => String(n).split('').sort().join('');

describe('generateMath', () => {
  it('easy: sum <= 10, distractors within 3 and positive', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 2000; i++) {
      const m = generateMath(rng, 'easy');
      expect(m.answer).toBeLessThanOrEqual(10);
      for (const d of m.distractors) {
        expect(Math.abs(d - m.answer)).toBeLessThanOrEqual(3);
        expect(d).toBeGreaterThan(0);
      }
    }
  });

  it('normal: only +-1, +-2, +-10 distractors; sum <= 30', () => {
    const rng = new Rng(2);
    let tens = 0;
    for (let i = 0; i < 2000; i++) {
      const m = generateMath(rng, 'normal');
      expect(m.answer).toBeLessThanOrEqual(30);
      for (const d of m.distractors) {
        expect([1, 2, 10]).toContain(Math.abs(d - m.answer));
        if (Math.abs(d - m.answer) === 10) tens++;
      }
    }
    expect(tens).toBeGreaterThan(300);
  });

  it('hard: carries; forgot-carry and digit swaps appear; all distinct and positive', () => {
    const rng = new Rng(3);
    let forgot = 0;
    let swap = 0;
    for (let i = 0; i < 2000; i++) {
      const m = generateMath(rng, 'hard');
      const [a, b] = m.text.split(' + ').map(Number);
      expect((a % 10) + (b % 10)).toBeGreaterThanOrEqual(10);
      expect(new Set([m.answer, ...m.distractors]).size).toBe(3);
      for (const d of m.distractors) {
        expect(d).toBeGreaterThan(0);
        if (d === m.answer - 10) forgot++;
        if (sortedDigits(d) === sortedDigits(m.answer)) swap++;
      }
    }
    expect(forgot).toBeGreaterThan(1000);
    expect(swap).toBeGreaterThan(50);
  });

  it.each(['easy', 'normal', 'hard'] as Difficulty[])('%s is deterministic per seed', (d) => {
    expect(generateMath(new Rng(9), d)).toEqual(generateMath(new Rng(9), d));
  });
});

describe('generateMath easyPlus', () => {
  it('answers 2..19 with about half teens, valid distinct distractors, deterministic', () => {
    const rng = new Rng(7);
    let teens = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const m = generateMath(rng, 'easyPlus', 4);
      expect(m.answer).toBeGreaterThanOrEqual(2);
      expect(m.answer).toBeLessThanOrEqual(19);
      if (m.answer >= 11) teens++;
      expect(new Set([m.answer, ...m.distractors]).size).toBe(4);
      for (const d of m.distractors) {
        expect(d).toBeGreaterThan(0);
        expect(Math.abs(d - m.answer)).toBeLessThanOrEqual(3);
      }
    }
    expect(teens / N).toBeGreaterThan(0.35);
    expect(teens / N).toBeLessThan(0.65);
    const a = generateMath(new Rng(5), 'easyPlus');
    expect(generateMath(new Rng(5), 'easyPlus')).toEqual(a);
  });
});
