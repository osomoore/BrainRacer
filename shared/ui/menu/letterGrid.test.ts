import { describe, expect, it } from 'vitest';
import { appendChar, buildKeys, clampPos, deleteLast, isValidName, keyAction, moveCursor } from './letterGrid';

describe('letterGrid', () => {
  const rows = buildKeys();
  it('has 26 letters plus space/delete/done', () => {
    expect(rows.flat().filter((k) => k.kind === 'letter')).toHaveLength(26);
    expect(rows[rows.length - 1].map((k) => k.kind)).toEqual(['space', 'delete', 'done']);
  });
  it('wraps horizontally and vertically', () => {
    expect(moveCursor(rows, { row: 0, idx: 0 }, -1, 0)).toEqual({ row: 0, idx: 6 });
    const last = rows.length - 1;
    expect(moveCursor(rows, { row: 0, idx: 0 }, 0, -1).row).toBe(last);
    expect(moveCursor(rows, { row: last, idx: 0 }, 0, 1).row).toBe(0);
  });
  it('maps columns onto wide keys', () => {
    const last = rows.length - 1;
    expect(rows[last][moveCursor(rows, { row: last - 1, idx: 4 }, 0, 1).idx].kind).toBe('done');
    expect(rows[last][moveCursor(rows, { row: last - 1, idx: 0 }, 0, 1).idx].kind).toBe('space');
  });
  it('edits text', () => {
    expect(appendChar('AB', 'C', 3)).toBe('ABC');
    expect(appendChar('ABC', 'D', 3)).toBe('ABC');
    expect(appendChar('', ' ', 5)).toBe('');
    expect(appendChar('A ', ' ', 5)).toBe('A ');
    expect(deleteLast('AB')).toBe('A');
    expect(deleteLast('')).toBe('');
    expect(isValidName('  ')).toBe(false);
    expect(isValidName('A')).toBe(true);
  });
  it('maps keys to press actions', () => {
    const last = rows.length - 1;
    expect(keyAction(rows[0][0])).toEqual({ type: 'add', ch: 'A' });
    expect(keyAction(rows[last][0])).toEqual({ type: 'add', ch: ' ' });
    expect(keyAction(rows[last][1])).toEqual({ type: 'delete' });
    expect(keyAction(rows[last][2])).toEqual({ type: 'done' });
  });
  it('clamps tapped positions into the grid', () => {
    expect(clampPos(rows, 99, 99)).toEqual({ row: rows.length - 1, idx: 2 });
    expect(clampPos(rows, -1, -1)).toEqual({ row: 0, idx: 0 });
  });
});
