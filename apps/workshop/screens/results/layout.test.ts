import { describe, expect, it } from 'vitest';
import { fitResults, paginate } from './layout';

describe('paginate', () => {
  it('packs rows greedily', () => {
    expect(paginate([100, 100, 100, 100, 100], 250)).toEqual([[0, 1], [2, 3], [4]]);
  });
  it('gives an oversized row its own page and keeps empty lists valid', () => {
    expect(paginate([50, 400, 50], 200)).toEqual([[0], [1], [2]]);
    expect(paginate([], 200)).toEqual([[]]);
  });
});

describe('fitResults', () => {
  const measure = (font: number) => ({ rows: [font * 2, font * 2, font * 2], extras: 100 });
  it('picks the largest font that fits on one page', () => {
    const plan = fitResults({ fonts: [48, 44, 40], measure, fullHeight: 600, pagedHeight: 400, gap: 10 });
    expect(plan.font).toBe(48);
    expect(plan.pages).toEqual([[0, 1, 2]]);
  });
  it('shrinks, then pages at the minimum font', () => {
    const shrunk = fitResults({ fonts: [48, 44, 40], measure, fullHeight: 380, pagedHeight: 300, gap: 10 });
    expect(shrunk.font).toBe(44);
    const paged = fitResults({ fonts: [48, 44, 40], measure, fullHeight: 100, pagedHeight: 300, gap: 10 });
    expect(paged.font).toBe(40);
    expect(paged.pages.length).toBeGreaterThan(1);
  });
});
