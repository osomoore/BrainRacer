import { describe, expect, it } from 'vitest';
import { fadeEdges, foldTail, makeSeamlessLoop, normalizePeak, peakOf, trimSilenceLength } from './dsp';

describe('dsp helpers', () => {
  it('trims trailing silence', () => {
    const a = new Float32Array(100); a[40] = 0.5;
    expect(trimSilenceLength([a])).toBe(41);
    expect(trimSilenceLength([a], 0.0005, 10)).toBe(51);
  });
  it('folds the tail onto the start', () => {
    const src = new Float32Array([1, 1, 1, 1, 2, 3]);
    expect(Array.from(foldTail(src, 4))).toEqual([3, 4, 1, 1]);
  });
  it('seamless loop starts as a blend and keeps length', () => {
    const src = new Float32Array(12).fill(1);
    const out = makeSeamlessLoop(src, 10, 2);
    expect(out.length).toBe(10);
    expect(out[0]).toBeCloseTo(1, 5);
  });
  it('normalizes the peak', () => {
    const c = [new Float32Array([0.1, -0.2]), new Float32Array([0.05, 0])];
    normalizePeak(c, 0.8);
    expect(peakOf(c)).toBeCloseTo(0.8, 5);
  });
  it('fades the edges', () => {
    const c = new Float32Array(10).fill(1);
    fadeEdges(c, 2, 2);
    expect(c[0]).toBe(0);
    expect(c[9]).toBe(0);
    expect(c[5]).toBe(1);
  });
});
