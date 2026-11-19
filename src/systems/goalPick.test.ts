import { describe, expect, it } from 'vitest';
import type { PlaceSite } from '../core/types';
import { pickGoal } from './goalPick';

const site = (word: string, x: number, y = 0): PlaceSite => ({ word, buildingId: 0, sign: { x, y }, front: { x, y } });
const opts = { min: 2200, max: 4200, firstMin: 1500, firstMax: 3000, recentWords: [] as string[] };
const r0 = () => 0;
const O = { x: 0, y: 0 };

describe('pickGoal', () => {
  const places = [site('a', 100), site('b', 2500), site('c', 3500), site('d', 6000)];
  it('respects distance window', () => {
    for (const r of [0, 0.4, 0.99]) expect(['b', 'c']).toContain(pickGoal(places, O, false, opts, () => r)!.word);
  });
  it('first goal uses the short window', () => {
    for (const r of [0, 0.99]) expect(pickGoal(places, O, true, opts, () => r)!.word).toBe('b');
  });
  it('avoids recent words', () => {
    expect(pickGoal(places, O, false, { ...opts, recentWords: ['b'] }, r0)!.word).toBe('c');
  });
  it('falls back when nothing in window', () => {
    expect(pickGoal([site('a', 100), site('z', 1200)], O, false, opts, r0)!.word).toBe('z');
  });
  it('allows repeat when it is the only option', () => {
    expect(pickGoal([site('b', 2500)], O, false, { ...opts, recentWords: ['b'] }, r0)!.word).toBe('b');
  });
  it('never picks the origin itself if others exist', () => {
    expect(pickGoal([site('a', 0), site('b', 50)], O, false, opts, r0)!.word).toBe('b');
  });
  it('empty list', () => expect(pickGoal([], O, false, opts, r0)).toBeNull());
});

import { segmentHitsCircle } from './goalPick';
describe('segmentHitsCircle', () => {
  it('detects a path that crosses the circle between frames', () => {
    expect(segmentHitsCircle(-500, 0, 500, 0, 0, 0, 170)).toBe(true);
    expect(segmentHitsCircle(-500, 0, 500, 0, 0, 100, 170)).toBe(true);
  });
  it('misses paths that stay outside or stop short', () => {
    expect(segmentHitsCircle(-500, 300, 500, 300, 0, 0, 170)).toBe(false);
    expect(segmentHitsCircle(-500, 0, -300, 0, 0, 0, 170)).toBe(false);
  });
  it('handles a zero-length segment', () => {
    expect(segmentHitsCircle(10, 10, 10, 10, 0, 0, 170)).toBe(true);
  });
});
