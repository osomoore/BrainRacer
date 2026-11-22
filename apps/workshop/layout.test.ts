import { describe, expect, it } from 'vitest';
import { fitScale } from './layout';

describe('fitScale', () => {
  it('is 1 at the stage size', () => {
    expect(fitScale(1920, 1080)).toBe(1);
  });

  it('scales down to fit the smaller side (16:9 window)', () => {
    expect(fitScale(1280, 720)).toBeCloseTo(2 / 3);
  });

  it('letterboxes a taller window by the width', () => {
    expect(fitScale(1000, 1000)).toBeCloseTo(1000 / 1920);
  });

  it('falls back to 1 for an empty window', () => {
    expect(fitScale(0, 720)).toBe(1);
  });
});
