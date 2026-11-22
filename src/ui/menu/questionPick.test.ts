import { describe, expect, it } from 'vitest';
import {
  changeJbq, CHIP_KEYS, jbqScopeLabel, moveChip, moveRow, ROW_CAR, ROW_GUIDE, ROW_POINTS, ROW_QUESTIONS, ROW_RACER, ROW_SCOPE,
  rowOrder, toggleChip, visibleRow,
} from './questionPick';

describe('question rows', () => {
  it('lists the JBQ rows only while JBQ is on', () => {
    expect(rowOrder(false)).toEqual([ROW_RACER, ROW_QUESTIONS, ROW_CAR, ROW_GUIDE]);
    expect(rowOrder(true)).toEqual([ROW_RACER, ROW_QUESTIONS, ROW_POINTS, ROW_SCOPE, ROW_CAR, ROW_GUIDE]);
  });
  it('moves between rows, skipping hidden ones and wrapping', () => {
    expect(moveRow(ROW_QUESTIONS, 1, false)).toBe(ROW_CAR);
    expect(moveRow(ROW_QUESTIONS, 1, true)).toBe(ROW_POINTS);
    expect(moveRow(ROW_CAR, -1, true)).toBe(ROW_SCOPE);
    expect(moveRow(ROW_GUIDE, 1, false)).toBe(ROW_RACER);
    expect(moveRow(ROW_RACER, -1, false)).toBe(ROW_GUIDE);
    expect(moveRow(ROW_SCOPE, 1, false)).toBe(ROW_CAR); // hidden row counts as Questions
  });
  it('pulls a cursor off a hidden row', () => {
    expect(visibleRow(ROW_POINTS, false)).toBe(ROW_QUESTIONS);
    expect(visibleRow(ROW_POINTS, true)).toBe(ROW_POINTS);
  });
  it('moves chip focus with wrap', () => {
    expect(moveChip(0, -1)).toBe(CHIP_KEYS.length - 1);
    expect(moveChip(2, 1)).toBe(0);
  });
  it('toggles chips but keeps at least one on', () => {
    const t = { math: true, reading: false, jbq: false };
    expect(toggleChip(t, 0)).toBe(t);
    expect(toggleChip(t, 2)).toEqual({ math: true, reading: false, jbq: true });
    expect(toggleChip({ math: true, reading: false, jbq: true }, 0)).toEqual({ math: false, reading: false, jbq: true });
  });
  it('cycles points and scope', () => {
    expect(changeJbq({ points: 10, scope: 'week' }, ROW_POINTS, 1)).toEqual({ points: 20, scope: 'week' });
    expect(changeJbq({ points: 10, scope: 'week' }, ROW_POINTS, -1).points).toBe(30);
    expect(changeJbq({ points: 10, scope: 'all' }, ROW_SCOPE, 1).scope).toBe('week');
    expect(changeJbq({ points: 10, scope: 'week' }, ROW_CAR, 1)).toEqual({ points: 10, scope: 'week' });
  });
  it('labels the scope', () => {
    expect(jbqScopeLabel(10, 'month')).toBe('This Month');
  });
});
