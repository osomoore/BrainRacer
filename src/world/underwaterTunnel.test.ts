import { describe, expect, it } from 'vitest';
import { UNDERWATER_CROSSING, UNDERWATER_TUNNEL } from '../config/gameConfig';
import { Tile } from '../core/types';
import { largestScc } from './gen/analysis';
import { generateUnderwater, isUnderwaterCrossing, UNDERWATER_GLASS_ROADS, UNDERWATER_VIEWING_POOLS } from './gen/underwater';
import { isDrivableTile } from './geometry';
import { underwaterTileIndex } from './underwaterTiles';
import { advanceUnderwaterTunnel, setUnderwaterTunnelOpen, underwaterCrossingOccupied, underwaterTunnelFrame } from './underwaterTunnel';

describe('underwater city and submarine crossing', () => {
  it('keeps places on roads and routes ambient traffic through the linked bypasses', () => {
    const world = generateUnderwater(3);
    const { laneGraph, tileSize, tiles, widthTiles } = world;
    const tileAt = (x: number, y: number) => tiles[Math.floor(y / tileSize) * widthTiles + Math.floor(x / tileSize)];
    expect(world.places.length).toBeGreaterThan(10);
    expect(world.places.every(({ front }) => tileAt(front.x, front.y) === Tile.Road)).toBe(true);
    expect(world.playerSpawns.every(({ x, y }) => tileAt(x, y) === Tile.Road)).toBe(true);
    expect(laneGraph.nodes.length).toBeGreaterThan(100);
    expect(largestScc(laneGraph)).toBe(laneGraph.nodes.length);
    setUnderwaterTunnelOpen(world, true);
    expect(laneGraph.nodes.every(({ x, y }) => tileAt(x, y) === Tile.Road && !isUnderwaterCrossing(x, y, tileSize))).toBe(true);
    setUnderwaterTunnelOpen(world, false);
    expect(tiles).toEqual(generateUnderwater(3).tiles);
  });

  it('warns, waits for a clear tube, then retracts and closes on driving time', () => {
    const openAt = UNDERWATER_TUNNEL.cycleSec - UNDERWATER_TUNNEL.openSec;
    const phase = openAt - 0.02;
    expect(underwaterTunnelFrame(phase)).toMatchObject({ warning: true, open: false });
    expect(advanceUnderwaterTunnel(phase, 0.03, true)).toBe(phase);
    expect(underwaterTunnelFrame(advanceUnderwaterTunnel(phase, 0.03, false)).open).toBe(true);
    expect(underwaterTunnelFrame(openAt + UNDERWATER_TUNNEL.openSec / 2).retract).toBe(1);
    expect(underwaterTunnelFrame(advanceUnderwaterTunnel(UNDERWATER_TUNNEL.cycleSec - 0.02, 0.03, false))).toMatchObject({
      warning: false, open: false, retract: 0,
    });
  });

  it('assigns clear tiles to glass roads and open pools while keeping solid city tiles opaque', () => {
    const world = generateUnderwater(3);
    const index = (x: number, y: number) => y * world.widthTiles + x;
    for (const { start, end, center, vertical } of UNDERWATER_GLASS_ROADS) {
      for (let coord = start; coord < end; coord++) for (const across of [center - 1, center]) {
        const i = vertical ? index(across, coord) : index(coord, across);
        expect(world.tiles[i]).toBe(Tile.Road);
        expect(underwaterTileIndex(world, i)).toBe(0);
      }
    }
    for (const { x, y, w, h } of UNDERWATER_VIEWING_POOLS) {
      for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
        const i = index(col, row);
        expect(underwaterTileIndex(world, i)).toBe(0);
        expect(isDrivableTile(world.tiles[i])).toBe(false);
      }
    }
    expect(world.tiles[index(10, 14)]).toBe(Tile.Plaza);
    expect(underwaterTileIndex(world, index(10, 14))).toBe(3);
    expect(underwaterTileIndex(world, index(8, 11))).toBe(2);
    expect(underwaterTileIndex(world, index(6, 8))).toBeGreaterThanOrEqual(6);
  });

  it('treats a vehicle overhanging the mouth as occupying the tube', () => {
    const { left, top, bottom } = UNDERWATER_CROSSING;
    const s = generateUnderwater(3).tileSize;
    const y = (top + bottom) * s / 2;
    expect(underwaterCrossingOccupied({ x: left * s - 20, y }, 22, s)).toBe(true);
    expect(underwaterCrossingOccupied({ x: left * s - 30, y }, 22, s)).toBe(false);
  });
});
