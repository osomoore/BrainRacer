import { describe, expect, it } from 'vitest';
import { clampPage, pageCount, pageItems, pageOf } from './paging';

describe('paging', () => {
  it('counts, clamps, slices', () => {
    expect(pageCount(0, 8)).toBe(1);
    expect(pageCount(9, 8)).toBe(2);
    expect(clampPage(5, 2)).toBe(1);
    expect(clampPage(-1, 2)).toBe(0);
    expect(pageItems([1, 2, 3, 4, 5], 1, 2)).toEqual([3, 4]);
    expect(pageOf(5, 3)).toBe(1);
  });
});
