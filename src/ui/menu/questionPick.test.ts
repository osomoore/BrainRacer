import { describe, expect, it } from 'vitest';
import {
  changeJbq, CHIP_KEYS, jbqScopeLabel, moveChip, moveRow, ROW_CAR, ROW_DONE, ROW_POINTS, ROW_QUESTIONS, ROW_SCOPE,
  jbqLimitNote, jbqPointsLabel, rowOrder, toggleChip, visibleRow,
} from './questionPick';

describe('question rows', () => {
  it('lists the JBQ rows only while JBQ is on', () => {
    expect(rowOrder(false)).toEqual([ROW_QUESTIONS, ROW_DONE]);
    expect(rowOrder(true)).toEqual([ROW_QUESTIONS, ROW_POINTS, ROW_SCOPE, ROW_DONE]);
  });
  it('moves between rows, skipping hidden ones and wrapping', () => {
    expect(moveRow(ROW_QUESTIONS, 1, false)).toBe(ROW_DONE);
    expect(moveRow(ROW_QUESTIONS, 1, true)).toBe(ROW_POINTS);
    expect(moveRow(ROW_DONE, -1, true)).toBe(ROW_SCOPE);
    expect(moveRow(ROW_DONE, 1, false)).toBe(ROW_QUESTIONS);
    expect(moveRow(ROW_QUESTIONS, -1, false)).toBe(ROW_DONE);
    expect(moveRow(ROW_SCOPE, 1, false)).toBe(ROW_DONE); // hidden row counts as Questions
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
    expect(changeJbq({ points: 10, scope: 'week' }, ROW_POINTS, -1).points).toBe('basics');
    expect(changeJbq({ points: 'basics', scope: 'week' }, ROW_POINTS, 1).points).toBe(10);
    expect(changeJbq({ points: 30, scope: 'week' }, ROW_POINTS, 1).points).toBe('basics');
    expect(changeJbq({ points: 10, scope: 'all' }, ROW_SCOPE, 1).scope).toBe('week');
    expect(changeJbq({ points: 10, scope: 'week' }, ROW_CAR, 1)).toEqual({ points: 10, scope: 'week' });
  });
  it('labels the scope', () => {
    expect(jbqScopeLabel(10, 'month', '2026-11-22')).toBe('Month 145–288');
    expect(jbqScopeLabel(10, 'week', '2026-11-22')).toBe('Week 145–168');
    expect(jbqScopeLabel(30, 'all', '2026-11-22')).toBe('All 481–576');
  });
  it('hides the scope row for Basics', () => {
    expect(rowOrder(true, true)).toEqual([ROW_QUESTIONS, ROW_POINTS, ROW_DONE]);
    expect(moveRow(ROW_POINTS, 1, true, true)).toBe(ROW_DONE);
    expect(visibleRow(ROW_SCOPE, true, true)).toBe(ROW_QUESTIONS);
  });
  it('labels Basics and the player limit', () => {
    expect(jbqPointsLabel('basics')).toBe('Basics');
    expect(jbqPointsLabel(20)).toBe('20 pts');
    expect(jbqScopeLabel('basics', 'week', '2026-11-22')).toBe('Q1–144');
    expect(jbqLimitNote(30, 1)).toBeNull();
    expect(jbqLimitNote(30, 2)).toBe('JBQ: 1 player only');
    expect(jbqLimitNote(10, 2)).toBeNull();
    expect(jbqLimitNote('basics', 3)).toBe('JBQ: 1–2 players');
  });
});
