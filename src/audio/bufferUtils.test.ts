import { describe, expect, it } from 'vitest';
import { foldTail, loopOffsetSec, makeSeamlessLoop, planChunks, RenderQueue, trimSilenceLength } from './bufferUtils';

describe('trimSilenceLength', () => {
  it('drops trailing near-silence across channels and keeps a pad', () => {
    const a = new Float32Array(100); a[40] = 0.5;
    const b = new Float32Array(100); b[60] = -0.2;
    expect(trimSilenceLength([a, b])).toBe(61);
    expect(trimSilenceLength([a, b], 0.0005, 10)).toBe(71);
    expect(trimSilenceLength([a, b], 0.0005, 1000)).toBe(100);
    expect(trimSilenceLength([new Float32Array(10)])).toBe(0);
  });
});

describe('foldTail', () => {
  it('adds the tail back onto the start', () => {
    const src = Float32Array.from([1, 2, 3, 4, 10, 20, 30]);
    expect(Array.from(foldTail(src, 4))).toEqual([11, 22, 33, 4]);
  });
  it('pads when shorter than the loop', () => {
    expect(Array.from(foldTail(Float32Array.from([1, 2]), 4))).toEqual([1, 2, 0, 0]);
  });
});

describe('makeSeamlessLoop', () => {
  it('makes the wrap point continuous for a periodic-with-glitch signal', () => {
    const N = 1000, X = 100;
    const src = new Float32Array(N + X);
    for (let i = 0; i < src.length; i++) src[i] = Math.sin(i * 0.05 + 1.3); // phase does not return to start at N
    const out = makeSeamlessLoop(src, N, X);
    expect(out.length).toBe(N);
    // last sample -> first sample is as smooth as neighbouring samples
    expect(Math.abs(out[0] - out[N - 1])).toBeLessThan(0.06);
    expect(out[500]).toBe(src[500]);
    // start of loop is the continuation of the end
    expect(out[0]).toBeCloseTo(src[N], 5);
  });
});

describe('loopOffsetSec', () => {
  it('wraps phase and converts beats to seconds', () => {
    expect(loopOffsetSec(0, 120, 16)).toBe(0);
    expect(loopOffsetSec(4, 120, 16)).toBeCloseTo(2);
    expect(loopOffsetSec(20, 120, 16)).toBeCloseTo(2);
    expect(loopOffsetSec(-4, 120, 16)).toBeCloseTo(6);
  });
});

describe('RenderQueue', () => {
  it('runs one job at a time, by priority then FIFO', async () => {
    const q = new RenderQueue();
    const order: string[] = [];
    let concurrent = 0, maxConcurrent = 0;
    const job = (name: string) => async () => {
      concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 2));
      order.push(name); concurrent--;
      return name;
    };
    const ps = [q.add(5, job('a')), q.add(5, job('b')), q.add(0, job('c')), q.add(5, job('d'))];
    expect(await Promise.all(ps)).toEqual(['a', 'b', 'c', 'd']);
    // 'a' starts immediately (queue was idle); then c (priority 0) jumps ahead of b and d
    expect(order).toEqual(['a', 'c', 'b', 'd']);
    expect(maxConcurrent).toBe(1);
    expect(q.pending).toBe(0);
  });
  it('rejects only the failing job', async () => {
    const q = new RenderQueue();
    const bad = q.add(0, async () => { throw new Error('x'); });
    const good = q.add(0, async () => 7);
    await expect(bad).rejects.toThrow('x');
    expect(await good).toBe(7);
  });
});

describe('planChunks', () => {
  it('covers the whole range once, with lead clamped at zero', () => {
    const chunks = planChunks(10, 4, 3);
    expect(chunks).toEqual([
      { start: 0, end: 4, winStart: 0 },
      { start: 4, end: 8, winStart: 1 },
      { start: 8, end: 10, winStart: 5 },
    ]);
  });
});
