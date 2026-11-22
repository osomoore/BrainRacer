import { describe, expect, it } from 'vitest';
import { jbqPool } from './jbqPool';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const learnedIn = (ids: number[], n = 2) => (id: number) => (ids.includes(id) ? n : 0);

describe('jbqPool', () => {
  const date = '2026-11-22';
  it('starts as the scope range', () => {
    expect(jbqPool(10, 'week', date, () => 0)).toEqual(range(145, 168));
    expect(jbqPool(10, 'week', date, learnedIn(range(145, 167)))).toEqual(range(145, 168));   // one question left
  });

  it('adds previous weeks back once everything in the pool is learned (2 correct each)', () => {
    expect(jbqPool(10, 'week', date, learnedIn(range(145, 168)))).toEqual(range(145, 192));
    expect(jbqPool(10, 'week', date, learnedIn(range(145, 192)))).toEqual(range(145, 216));
    expect(jbqPool(10, 'week', date, learnedIn(range(145, 216)))).toEqual(range(145, 288));
    expect(jbqPool(10, 'week', date, learnedIn(range(145, 288)))).toEqual(range(145, 288));   // nothing left to add
  });

  it('1 correct is not learned yet', () => {
    expect(jbqPool(10, 'week', date, learnedIn(range(145, 168), 1))).toEqual(range(145, 168));
  });

  it('does not add anything for the first week', () => {
    expect(jbqPool(10, 'week', '2026-11-01', () => 9)).toEqual(range(217, 288));
  });

  it('month and all scopes already contain the earlier weeks', () => {
    expect(jbqPool(10, 'month', date, () => 9)).toEqual(range(145, 288));
    expect(jbqPool(20, 'all', date, () => 9)).toEqual(range(289, 480));
  });

  it('works for other levels', () => {
    expect(jbqPool(30, 'week', date, () => 0)).toEqual(range(529, 536));
    expect(jbqPool(30, 'week', date, learnedIn(range(529, 536)))).toEqual(range(529, 544));
  });
});
