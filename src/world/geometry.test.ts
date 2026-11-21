import { describe, expect, it } from 'vitest';
import { Tile, type WorldData } from '../core/types';
import { isDrivable, mergeRects, nearestRoadPoint, pointInRamp, pxToTile, registerBuildingFootprints, tileCenter, tileToPx } from './geometry';

function mk(rows: number[][]): WorldData {
  const h = rows.length, w = rows[0].length;
  return {
    seed: 0, widthTiles: w, heightTiles: h, tileSize: 128,
    tiles: Uint8Array.from(rows.flat()), roadMask: new Uint8Array(w * h),
    buildings: [], places: [], ramps: [], props: [], laneGraph: { nodes: [] }, playerSpawns: [],
  };
}

describe('geometry', () => {
  it('converts tiles and pixels', () => {
    expect(tileToPx(3, 128)).toBe(384);
    expect(pxToTile(383.9, 128)).toBe(2);
    expect(pxToTile(-1, 128)).toBe(-1);
    expect(tileCenter(1, 128)).toBe(192);
  });
  it('isDrivable', () => {
    const w = mk([[Tile.Road, Tile.Building, Tile.Water, Tile.Grass]]);
    expect(isDrivable(w, 10, 10)).toBe(true);
    expect(isDrivable(w, 150, 10)).toBe(false);
    expect(isDrivable(w, 300, 10)).toBe(false);
    expect(isDrivable(w, 400, 10)).toBe(true);
    expect(isDrivable(w, -5, 10)).toBe(false);
  });
  it('admits unpainted lot corners and passages between solid building parts', () => {
    const world = mk([[Tile.Building, Tile.Building, Tile.Water]]);
    world.buildings.push({ id: 7, tx: 0, ty: 0, tw: 2, th: 1, style: 0 });
    const wings = [0, 128].map(dx => [
      { x: 16 + dx, y: 28 }, { x: 88 + dx, y: 28 }, { x: 109 + dx, y: 52 },
      { x: 109 + dx, y: 104 }, { x: 16 + dx, y: 104 },
    ]);
    registerBuildingFootprints(world, new Map([[7, wings]]));
    expect(isDrivable(world, 108, 30)).toBe(true);
    expect(isDrivable(world, 128, 62)).toBe(true);
    expect(isDrivable(world, 32, 62)).toBe(false);
    expect(isDrivable(world, 228, 62)).toBe(false);
    expect(isDrivable(world, 256, 62)).toBe(false);
  });
  it('mergeRects covers exactly the set', () => {
    const g = [1, 1, 0, 1, 1, 1, 0, 1, 1];
    const rs = mergeRects(g, 3, 3);
    const cover = new Array(9).fill(0);
    for (const r of rs) for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) cover[(r.y + j) * 3 + r.x + i]++;
    expect(cover).toEqual(g);
    expect(rs.length).toBeLessThanOrEqual(3);
    expect(mergeRects([0, 0], 2, 1)).toEqual([]);
  });
  it('nearestRoadPoint', () => {
    const w = mk([[Tile.Grass, Tile.Road, Tile.Grass, Tile.Road]]);
    expect(nearestRoadPoint(w, 10, 10)).toEqual({ x: 192, y: 64 });
    expect(nearestRoadPoint(w, 500, 10)).toEqual({ x: 448, y: 64 });
    expect(nearestRoadPoint(mk([[Tile.Grass]]), 0, 0)).toBeNull();
  });
  it('pointInRamp oriented', () => {
    const r = { x: 100, y: 100, angle: Math.PI / 2, w: 128, h: 96 };
    expect(pointInRamp(r, 100, 100 + 60)).toBe(true);
    expect(pointInRamp(r, 100 + 60, 100)).toBe(false);
    expect(pointInRamp(r, 100 + 40, 100)).toBe(true);
  });
});
