import { describe, expect, it } from 'vitest';
import { clampPage, pageCount, pageItems } from './paging';

describe('paging', () => {
  it('counts pages', () => {
    expect(pageCount(0, 2)).toBe(1);
    expect(pageCount(4, 2)).toBe(2);
    expect(pageCount(5, 2)).toBe(3);
  });
  it('clamps', () => {
    expect(clampPage(5, 3)).toBe(2);
    expect(clampPage(-1, 3)).toBe(0);
    expect(clampPage(0, 0)).toBe(0);
  });
  it('slices', () => {
    expect(pageItems([1, 2, 3, 4, 5], 2, 2)).toEqual([5]);
  });
});
