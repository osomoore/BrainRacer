import { describe, expect, it } from 'vitest';
import { firstEnabled, hitRect, moveFocus, type FocusRect } from './focusNav';

// 3 columns x 2 rows, centers 100 apart.
const grid: FocusRect[] = [0, 1, 2, 3, 4, 5].map((i) => ({ x: (i % 3) * 100, y: Math.floor(i / 3) * 100, w: 80, h: 80 }));

describe('moveFocus', () => {
  it('moves in a grid', () => {
    expect(moveFocus(grid, 0, 'right')).toBe(1);
    expect(moveFocus(grid, 1, 'down')).toBe(4);
    expect(moveFocus(grid, 5, 'left')).toBe(4);
    expect(moveFocus(grid, 4, 'up')).toBe(1);
  });
  it('stays at the edge without wrap and wraps within the row / column with wrap', () => {
    expect(moveFocus(grid, 2, 'right')).toBe(2);
    expect(moveFocus(grid, 2, 'right', true)).toBe(0);
    expect(moveFocus(grid, 0, 'left', true)).toBe(2);
    expect(moveFocus(grid, 1, 'up', true)).toBe(4);
    expect(moveFocus(grid, 3, 'down', true)).toBe(0);
  });
  it('skips disabled items', () => {
    const g = grid.map((r, i) => (i === 1 ? { ...r, enabled: false } : r));
    expect(moveFocus(g, 0, 'right')).toBe(2);
    expect(firstEnabled(g.map((r, i) => (i === 0 ? { ...r, enabled: false } : r)))).toBe(2);
  });
  it('handles different widths: a wide key under letters is reached from the nearest letter', () => {
    const items: FocusRect[] = [
      { x: 0, y: 0, w: 100, h: 100 }, { x: 120, y: 0, w: 100, h: 100 }, { x: 240, y: 0, w: 100, h: 100 },
      { x: 60, y: 120, w: 220, h: 100 }, { x: 260, y: 120, w: 100, h: 100 },
    ];
    expect(moveFocus(items, 0, 'down')).toBe(3);
    expect(moveFocus(items, 2, 'down')).toBe(4);
    expect(moveFocus(items, 3, 'up')).toBe(0);
  });
  it('starts at the first enabled item when nothing is focused', () => {
    expect(moveFocus(grid, -1, 'down')).toBe(0);
  });
});

describe('hitRect', () => {
  it('is centre based', () => {
    expect(hitRect({ x: 100, y: 100, w: 50, h: 50 }, 120, 80)).toBe(true);
    expect(hitRect({ x: 100, y: 100, w: 50, h: 50 }, 126, 100)).toBe(false);
  });
});

describe('letter grid edges', () => {
  // Real wide layout: 13 columns of 120 px keys, then SPACE / DELETE / DONE.
  const rects = (): FocusRect[] => {
    const key = 120, gap = 12, out: FocusRect[] = [];
    for (let i = 0; i < 26; i++) out.push({ x: (i % 13) * (key + gap) + key / 2, y: Math.floor(i / 13) * (key + gap) + key / 2, w: key, h: key });
    const span = (c: number, n: number) => ({ x: c * (key + gap) + (n * key + (n - 1) * gap) / 2, y: 2 * (key + gap) + key / 2, w: n * key + (n - 1) * gap, h: key });
    out.push(span(0, 4), span(4, 4), span(8, 5));
    return out;
  };
  it('Right on SPACE / DELETE stays in the bottom row', () => {
    expect(moveFocus(rects(), 26, 'right')).toBe(27);
    expect(moveFocus(rects(), 27, 'right')).toBe(28);
    expect(moveFocus(rects(), 28, 'left')).toBe(27);
  });
  it('bottom row wraps within itself', () => {
    expect(moveFocus(rects(), 28, 'right', true)).toBe(26);
    expect(moveFocus(rects(), 26, 'left', true)).toBe(28);
  });
  it('Up and Down between letters and the wide keys line up by column', () => {
    expect(moveFocus(rects(), 0, 'down')).toBe(13);
    expect(moveFocus(rects(), 13, 'down')).toBe(26);
    expect(moveFocus(rects(), 28, 'up')).toBe(23);
  });
});
