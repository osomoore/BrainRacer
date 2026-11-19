import { describe, expect, it } from 'vitest';
import { FARM_CORN } from '../config/gameConfig';
import { Tile } from '../core/types';
import { insideAnyView, needsStamp, shouldSpringBack, speedMultFor, surfaceOfTile } from './cornTrack';

describe('cornTrack', () => {
  it('maps tiles to surfaces and slowdowns', () => {
    expect(surfaceOfTile(Tile.Corn)).toBe('corn');
    expect(surfaceOfTile(Tile.Mud)).toBe('mud');
    expect(surfaceOfTile(Tile.Road)).toBe('none');
    expect(speedMultFor('corn')).toBeCloseTo(0.6);
    expect(speedMultFor('mud')).toBeCloseTo(0.5);
    expect(speedMultFor('none')).toBe(1);
  });
  it('spaces stamps', () => {
    expect(needsStamp(0, 0, FARM_CORN.stampSpacing - 1, 0)).toBe(false);
    expect(needsStamp(0, 0, 0, FARM_CORN.stampSpacing)).toBe(true);
  });
  const views = [{ x: 0, y: 0, w: 1000, h: 1000 }, { x: 5000, y: 0, w: 1000, h: 1000 }];
  it('culls by view rects with margin', () => {
    expect(insideAnyView(500, 500, views)).toBe(true);
    expect(insideAnyView(1000 + FARM_CORN.viewMargin + 10, 500, views)).toBe(true);
    expect(insideAnyView(2500, 500, views)).toBe(false);
    expect(insideAnyView(5500, 500, views)).toBe(true);
    expect(insideAnyView(500, 500, [])).toBe(false);
  });
  it('springs back off-screen or when old', () => {
    expect(shouldSpringBack(500, 500, 1, views)).toBe(false);
    expect(shouldSpringBack(2500, 500, 1, views)).toBe(true);
    expect(shouldSpringBack(500, 500, FARM_CORN.stampLifeSec + 1, views)).toBe(true);
  });
});
