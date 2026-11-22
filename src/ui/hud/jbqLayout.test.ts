import { describe, expect, it } from 'vitest';
import { ellipsize, jbqGeometry, largestFit, planJbq, waterFill } from './jbqLayout';

// Fake measurer: ~0.55em per char, 1.2em line height.
const block = (chars: number, px: number, w: number) => Math.max(1, Math.ceil((chars * 0.55 * px) / w)) * px * 1.2;

describe('largestFit', () => {
  it('finds the largest fitting size', () => { expect(largestFit((p) => p <= 47, 30, 60)).toBe(47); });
  it('returns min when nothing fits and max when all fit', () => {
    expect(largestFit(() => false, 30, 60)).toBe(30);
    expect(largestFit(() => true, 30, 60)).toBe(60);
  });
});

describe('ellipsize', () => {
  const fitsLen = (n: number) => (s: string) => s.length <= n;
  it('keeps text that fits', () => { expect(ellipsize('hello world', fitsLen(20))).toBe('hello world'); });
  it('cuts at a word boundary and appends an ellipsis', () => {
    const out = ellipsize('one two three four five', fitsLen(14));
    expect(out).toBe('one two three…');
    expect(out.length).toBeLessThanOrEqual(14);
  });
  it('degrades to just an ellipsis', () => { expect(ellipsize('abcdefghij klm', fitsLen(1))).toBe('…'); });
});

describe('planJbq', () => {
  const run = (areaW: number, areaH: number, quad: boolean, q: number, a: number[]) => {
    const g = jbqGeometry({ areaW, areaH, quad, badge: true });
    const plan = planJbq(g, 4, (px) => block(q, px, g.qTextW), (i, px) => block(a[i], px, g.aTextW));
    return { g, plan };
  };
  it('short answers get big fonts and fill the area exactly', () => {
    const { g, plan } = run(1700, 800, false, 45, [2, 2, 2, 2]);
    expect(plan.ok).toBe(true);
    expect(plan.fa).toBe(g.fonts.answerMax);
    const bottom = plan.rowTop[3] + plan.rowH[3] + g.pad;
    expect(bottom).toBeCloseTo(g.areaH, 3);
  });
  it('rows are ordered and never overlap', () => {
    const { g, plan } = run(920, 780, false, 120, [45, 60, 20, 130]);
    for (let i = 1; i < 4; i++) expect(plan.rowTop[i]).toBeCloseTo(plan.rowTop[i - 1] + plan.rowH[i - 1] + g.rowGap, 3);
  });
  it('median answers stay large in a 2-player view', () => {
    const { plan } = run(920, 780, false, 120, [45, 45, 45, 45]);
    expect(plan.fa).toBeGreaterThanOrEqual(36);
    expect(plan.fq).toBeGreaterThanOrEqual(40);   // the question keeps its minimum; answers give a little
    expect(plan.ok).toBe(true);
  });
  it('long answers shrink before the question drops below its minimum', () => {
    const { g, plan } = run(1700, 800, false, 40, [150, 150, 150, 150]);
    expect(plan.fq).toBeGreaterThanOrEqual(g.fonts.questionMin);
    expect(plan.fa).toBeLessThan(g.fonts.answerMin);
    expect(plan.fa).toBeGreaterThanOrEqual(g.fonts.answerHard);
  });
  it('very long content shrinks to the hard floor and flags truncation instead of overflowing', () => {
    const { g, plan } = run(680, 520, true, 130, [160, 160, 160, 160]);
    expect(plan.fa).toBeLessThanOrEqual(g.fonts.answerMin);
    const bottom = plan.rowTop[3] + plan.rowH[3] + g.pad;
    expect(bottom).toBeLessThanOrEqual(g.areaH + 1);
    if (!plan.ok) expect(plan.truncate.some(Boolean)).toBe(true);
  });
});

describe('waterFill', () => {
  it('keeps small needs whole and shares the rest', () => {
    const out = waterFill([50, 400, 400], 600, 10);
    expect(out[0]).toBe(50);
    expect(out[1]).toBeCloseTo(275, 3);
    expect(out[1] + out[2] + out[0]).toBeCloseTo(600, 3);
  });
});
