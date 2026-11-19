import { describe, expect, it } from 'vitest';
import { RoundClock, applyChallenge, applyGoal, buildResults, emptyStats, starRating } from './roundStats';

describe('score math', () => {
  it('counts results', () => {
    const s = emptyStats();
    applyChallenge(s, 'correct'); applyChallenge(s, 'correct'); applyChallenge(s, 'wrong'); applyChallenge(s, 'timeout');
    applyGoal(s, 3);
    expect(s).toEqual({ correct: 2, wrong: 1, timeouts: 1, goals: 1, points: 5 });
  });
  it('builds results', () => {
    const a = emptyStats(), b = emptyStats();
    applyGoal(a, 3); applyGoal(b, 3);
    const r = buildResults([a, b], 1, 7);
    expect(r).toMatchObject({ teamPoints: 6, goalsCompleted: 1, seed: 7 });
    expect(r.players[0]).not.toBe(a);
  });
  it('stars', () => {
    expect(starRating(2, 300, [3, 6])).toBe(1);
    expect(starRating(20, 300, [3, 6])).toBe(2);
    expect(starRating(40, 300, [3, 6])).toBe(3);
  });
});

describe('RoundClock', () => {
  it('ticks once per second, half once, end once', () => {
    const c = new RoundClock(10);
    const ticks: number[] = [];
    let half = 0, end = 0;
    for (let t = 0; t <= 12; t += 0.05) {
      const o = c.step(t);
      if (o.tick !== undefined) ticks.push(o.tick);
      if (o.half) half++;
      if (o.end) end++;
    }
    expect(half).toBe(1);
    expect(end).toBe(1);
    expect(new Set(ticks).size).toBe(ticks.length);
    expect(ticks[ticks.length - 1]).toBe(0);
  });
  it('a huge jump fires half and end together once', () => {
    const c = new RoundClock(10);
    expect(c.step(50)).toMatchObject({ half: true, end: true });
    expect(c.step(51)).toEqual({});
  });
});
