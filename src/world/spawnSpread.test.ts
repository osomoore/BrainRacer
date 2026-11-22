import { describe, expect, it } from 'vitest';
import { spreadSpawns } from './spawnSpread';

const base = [{ x: 100, y: 90, angle: 0 }, { x: 100, y: 190, angle: 0 }];

describe('spreadSpawns', () => {
  it('keeps the world spawns for 1-2 players', () => {
    expect(spreadSpawns(base, 1, () => true, 160)).toEqual([base[0]]);
    expect(spreadSpawns(base, 2, () => true, 160)).toEqual(base);
  });
  it('puts players 3-4 in a second row behind the first', () => {
    const s = spreadSpawns(base, 4, () => true, 160);
    expect(s).toHaveLength(4);
    expect(s[2]).toEqual({ x: -60, y: 90, angle: 0 });   // one row back
    expect(s[3]).toEqual({ x: -60, y: 190, angle: 0 });
  });
  it('goes ahead when behind is blocked', () => {
    const s = spreadSpawns(base, 3, (x) => x > 0, 160);
    expect(s[2]).toEqual({ x: 260, y: 90, angle: 0 });
  });
  it('falls back to the base spawn when nothing is free', () => {
    expect(spreadSpawns(base, 3, () => false, 160)[2]).toEqual(base[0]);
  });
});
