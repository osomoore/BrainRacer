import { describe, expect, it } from 'vitest';
import { raceQuestionTypes } from './jbqRules';

const all = { math: true, reading: true, jbq: true };
const scope = 'all' as const;

describe('raceQuestionTypes', () => {
  it('keeps JBQ when allowed', () => {
    expect(raceQuestionTypes(all, { points: 'basics', scope }, 2)).toBe(all);
    expect(raceQuestionTypes(all, { points: 30, scope }, 1)).toBe(all);
  });
  it('turns JBQ off for this race when too many players', () => {
    expect(raceQuestionTypes(all, { points: 30, scope }, 2)).toEqual({ math: true, reading: true, jbq: false });
    expect(raceQuestionTypes(all, { points: 10, scope }, 3)).toEqual({ math: true, reading: true, jbq: false });
  });
  it('falls back to Math + Reading when JBQ was the only type', () => {
    expect(raceQuestionTypes({ math: false, reading: false, jbq: true }, { points: 20, scope }, 4)).toEqual({ math: true, reading: true, jbq: false });
    expect(raceQuestionTypes({ math: false, reading: true, jbq: true }, { points: 20, scope }, 4)).toEqual({ math: false, reading: true, jbq: false });
  });
  it('does nothing without JBQ', () => {
    const t = { math: true, reading: false, jbq: false };
    expect(raceQuestionTypes(t, { points: 30, scope }, 4)).toBe(t);
  });
});
