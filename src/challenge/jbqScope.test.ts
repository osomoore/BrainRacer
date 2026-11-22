import { describe, expect, it } from 'vitest';
import { jbqAllowed, jbqPointsOf, jbqRange, localDateString, previousChunks, weeklyChunks } from './jbqScope';

describe('jbqRange', () => {
  it('2026-11-22: 10s week = 145-168, month = 145-288', () => {
    expect(jbqRange(10, 'week', '2026-11-22')).toEqual({ from: 145, to: 168, label: 'Q145–168' });
    expect(jbqRange(10, 'month', '2026-11-22')).toEqual({ from: 145, to: 288, label: 'Q145–288' });
    expect(jbqRange(20, 'week', '2026-11-22')).toMatchObject({ from: 385, to: 400 });
    expect(jbqRange(30, 'month', '2026-11-22')).toMatchObject({ from: 529, to: 576 });
  });

  it('week uses the latest row on or before the date (mid-week, review and meet weeks)', () => {
    expect(jbqRange(10, 'week', '2026-11-25')).toMatchObject({ from: 145, to: 168 });
    expect(jbqRange(10, 'week', '2026-11-29')).toMatchObject({ from: 145, to: 288 });   // review
    expect(jbqRange(10, 'week', '2026-12-05')).toMatchObject({ from: 145, to: 288 });   // meet 2
    expect(jbqRange(10, 'week', '2026-12-06')).toMatchObject({ from: 133, to: 144 });
  });

  it('before the first row uses the first row', () => {
    expect(jbqRange(10, 'week', '2026-10-01')).toMatchObject({ from: 217, to: 288 });
    expect(jbqRange(10, 'month', '2026-10-01')).toMatchObject({ from: 217, to: 288 });   // meet 1
  });

  it('month = next review or meet on/after the date', () => {
    expect(jbqRange(10, 'month', '2026-11-29')).toMatchObject({ from: 145, to: 288 });
    expect(jbqRange(10, 'month', '2026-12-06')).toMatchObject({ from: 109, to: 288 });
    expect(jbqRange(20, 'month', '2027-01-10')).toMatchObject({ from: 337, to: 480 });
  });

  it('all = whole level; after the last row week and month fall back to all', () => {
    expect(jbqRange(10, 'all', '2026-11-22')).toMatchObject({ from: 1, to: 288 });
    expect(jbqRange(20, 'all', '2026-11-22')).toMatchObject({ from: 289, to: 480 });
    expect(jbqRange(30, 'all', '2026-11-22')).toMatchObject({ from: 481, to: 576 });
    expect(jbqRange(30, 'week', '2027-03-07')).toMatchObject({ from: 481, to: 576 });
    expect(jbqRange(10, 'month', '2027-03-07')).toMatchObject({ from: 1, to: 288 });
    expect(jbqRange(10, 'week', '2027-03-06')).toMatchObject({ from: 1, to: 288 });   // meet 4 itself
  });
});

describe('chunks', () => {
  it('weeklyChunks are the study weeks in schedule order, deduped', () => {
    const c = weeklyChunks(10);
    expect(c[0]).toEqual([217, 288]);
    expect(c[3]).toEqual([145, 168]);
    expect(c[c.length - 1]).toEqual([1, 24]);
    expect(c).toHaveLength(13);
    expect(weeklyChunks(30)).toHaveLength(13);
  });

  it('previousChunks go back from the current week, most recent first', () => {
    expect(previousChunks(10, '2026-11-22')).toEqual([[169, 192], [193, 216], [217, 288]]);
    expect(previousChunks(10, '2026-11-01')).toEqual([]);
    expect(previousChunks(10, '2026-11-29')).toEqual([[169, 192], [193, 216], [217, 288]]);   // review week: still after the Nov 22 chunk
  });
});

describe('localDateString', () => {
  it('formats local calendar dates', () => {
    expect(localDateString(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02');
  });
});

describe('jbq basics and player limits', () => {
  it('Basics is always Q1-144 whatever the scope or date', () => {
    for (const scope of ['week', 'month', 'all'] as const) {
      expect(jbqRange('basics', scope, '2026-11-22')).toEqual({ from: 1, to: 144, label: 'Q1–144' });
    }
    expect(jbqRange('basics', 'week', '2027-05-01')).toMatchObject({ from: 1, to: 144 });
    expect(jbqPointsOf('basics')).toBe(10);
    expect(jbqPointsOf(30)).toBe(30);
  });
  it('allows 1-2 players for Basics/10/20 and only 1 for 30', () => {
    for (const l of ['basics', 10, 20] as const) {
      expect(jbqAllowed(l, 1)).toBe(true);
      expect(jbqAllowed(l, 2)).toBe(true);
      expect(jbqAllowed(l, 3)).toBe(false);
      expect(jbqAllowed(l, 4)).toBe(false);
    }
    expect(jbqAllowed(30, 1)).toBe(true);
    expect(jbqAllowed(30, 2)).toBe(false);
  });
});
