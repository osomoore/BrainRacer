import { describe, expect, it, vi } from 'vitest';
import { Tile } from '../core/types';
import { snowTrackAlpha, traceWheel, wrapFront } from './queuedAtmosphereMath';

describe('queued world atmosphere', () => {
  it('wraps weather completely outside the visible extent in either direction', () => {
    expect(wrapFront(1000, 6000, 960)).toBe(1000);
    expect(wrapFront(6970, 6000, 960)).toBe(-950);
    expect(wrapFront(-970, 6000, 960)).toBe(6950);
  });

  it('samples steady wheel movement by distance across several short frames', () => {
    const mark = vi.fn();
    const start = { x: 0, y: 0 };
    expect(traceWheel(start, { x: 12, y: 0 }, 20, mark)).toBe(start);
    expect(mark).not.toHaveBeenCalled();
    const partial = traceWheel(start, { x: 47, y: 0 }, 20, mark);
    expect(partial).toEqual({ x: 40, y: 0 });
    expect(mark.mock.calls).toEqual([[{ x: 10, y: 0 }, 0], [{ x: 30, y: 0 }, 0]]);
    expect(traceWheel(partial, { x: 40, y: 20 }, 20, mark)).toEqual({ x: 40, y: 20 });
    expect(mark).toHaveBeenLastCalledWith({ x: 40, y: 10 }, Math.PI / 2);
  });

  it('compresses snow more visibly than ice or road frost and skips solid or out-of-bounds terrain', () => {
    const tiles = new Uint8Array([Tile.Grass, Tile.Road, Tile.Dirt, Tile.Building, Tile.Water]);
    const world = { tiles, heightTiles: 1, widthTiles: 5, tileSize: 128 };
    const alpha = (tile: number) => snowTrackAlpha(world, (tile + .5) * world.tileSize, 64);
    expect(alpha(0)).toBeGreaterThan(alpha(1));
    expect(alpha(1)).toBeGreaterThan(alpha(2));
    expect(alpha(2)).toBeGreaterThan(0);
    expect([alpha(3), alpha(4), alpha(-1), alpha(5)]).toEqual([0, 0, 0, 0]);
  });
});
