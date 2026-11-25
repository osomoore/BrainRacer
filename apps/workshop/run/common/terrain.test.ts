import { describe, expect, it } from 'vitest';
import { WS_RUN } from '../../config';
import { clearanceGap, sagProfile, slopeProfile, slopeRise } from './terrain';

describe('slopeProfile', () => {
  const spec = { x0: 800, length: 1000, tan: 0.5, ease: 100 };
  const f = slopeProfile(spec);
  it('is flat before and after, with the declared rise', () => {
    expect(f(0)).toBe(0);
    expect(f(800)).toBe(0);
    expect(f(5000)).toBeCloseTo(-slopeRise(spec), 5);
    expect(slopeRise(spec)).toBeCloseTo(0.5 * 900, 5);
  });
  it('rises monotonically', () => {
    let prev = 0;
    for (let x = 800; x <= 1800; x += 20) { const y = f(x); expect(y).toBeLessThanOrEqual(prev + 1e-9); prev = y; }
  });
  it('has slope tan in the middle', () => {
    expect((f(1301) - f(1300)) / 1).toBeCloseTo(-0.5, 2);
  });
});

describe('sagProfile', () => {
  it('is zero outside and maximal in the middle', () => {
    const f = sagProfile(0, 100, 40);
    expect(f(-5)).toBe(0); expect(f(100)).toBe(0); expect(f(50)).toBeCloseTo(40);
  });
});

describe('clearanceGap', () => {
  it.each([WS_RUN.lowBridge, WS_RUN.narrow])('tightens the opening with each level for either outcome', ({ clearance, overlap }) => {
    const size = 160;
    for (const passed of [true, false]) {
      const gaps = clearance.map((_, i) => clearanceGap(size, i + 1, passed, clearance, overlap));
      expect(gaps.every((gap) => passed ? gap > size : gap < size)).toBe(true);
      expect(gaps.every((gap, i) => i === 0 || gap < gaps[i - 1])).toBe(true);
      expect(clearanceGap(size, 0, passed, clearance, overlap)).toBe(gaps[0]);
      expect(clearanceGap(size, 99, passed, clearance, overlap)).toBe(gaps.at(-1));
    }
  });

  it('keeps a positive opening for a small silhouette', () => {
    expect(clearanceGap(10, 3, false, WS_RUN.lowBridge.clearance, WS_RUN.lowBridge.overlap)).toBe(1);
  });
});
