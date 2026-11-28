import { describe, expect, it } from 'vitest';
import { WORLD_BUDDIES } from '../config';
import { ring } from './hex';
import { roadOverlap } from './roads';
import { WorldGen } from './world';

describe('World buddy spots', () => {
  it('places a seeded sample near one in ten hexes and clear of homes and roads', () => {
    const gen = new WorldGen(29, ['world-quick-1', 'world-quick-2']);
    const home = gen.homeFor('world-quick-1')!;
    expect(gen.plan(home).buddySpot).toBeUndefined();
    const hexes = Array.from({ length: 9 }, (_, i) => ring({ q: 0, r: 0 }, i)).flat();
    const spots = hexes.flatMap(hex => {
      const { home, roads, buddySpot } = gen.plan(hex);
      if (!buddySpot) return [];
      expect(home).toBeUndefined();
      expect(roads.some(road => roadOverlap(road, buddySpot.at, WORLD_BUDDIES.handRadius / 2))).toBe(false);
      return [buddySpot];
    });
    expect(spots.length / hexes.length).toBeGreaterThan(0.06);
    expect(spots.length / hexes.length).toBeLessThan(0.15);
    const repeated = new WorldGen(29, ['world-quick-1', 'world-quick-2']);
    expect(hexes.flatMap(hex => repeated.plan(hex).buddySpot ?? [])).toEqual(spots);
  });
});
