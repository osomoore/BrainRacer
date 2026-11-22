import { describe, expect, it } from 'vitest';
import { sagProfile, slopeProfile, slopeRise } from './terrain';

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
