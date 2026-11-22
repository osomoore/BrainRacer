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
