import { describe, expect, it } from 'vitest';
import { copyOffset, repeatSamples, sliceExact } from './audioManifest';

describe('audio manifest helpers', () => {
  it('copyOffset picks the middle copy', () => {
    expect(copyOffset({ length: 100, copies: 1 })).toBe(0);
    expect(copyOffset({ length: 100, copies: 3 })).toBe(100);
  });
  it('repeatSamples + sliceExact round-trips the middle copy', () => {
    const a = Float32Array.from([1, 2, 3]);
    const r = repeatSamples(a, 3);
    expect(Array.from(r)).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3]);
    expect(Array.from(sliceExact(r, 3, 3))).toEqual([1, 2, 3]);
  });
  it('sliceExact zero-pads short input and trims long input', () => {
    expect(Array.from(sliceExact(Float32Array.from([1, 2]), 0, 4))).toEqual([1, 2, 0, 0]);
    expect(Array.from(sliceExact(Float32Array.from([1, 2, 3, 4, 5]), 1, 2))).toEqual([2, 3]);
    expect(sliceExact(Float32Array.from([1]), 5, 2).length).toBe(2);
  });
});
