import { describe, expect, it } from 'vitest';
import { Tile, type WorldData } from '../core/types';
import { bombPath, nearestBombTarget } from './homingBombAI';

function world(rows: number[][]): WorldData {
  return { widthTiles: rows[0].length, heightTiles: rows.length, tileSize: 100, tiles: Uint8Array.from(rows.flat()) } as WorldData;
}

describe('homing bomb navigation', () => {
  it('routes around buildings and never crosses water', () => {
    const w = world([[2, 4, 2], [2, 0, 2], [2, 2, 2]]);
    const path = bombPath(w, { x: 50, y: 50 }, { x: 250, y: 50 });
    expect(path).toEqual([{ x: 50, y: 150 }, { x: 50, y: 250 }, { x: 150, y: 250 }, { x: 250, y: 250 }, { x: 250, y: 150 }, { x: 250, y: 50 }]);
  });
  it('returns null for unreachable or outside targets', () => {
    const w = world([[Tile.Road, Tile.Water, Tile.Road]]);
    expect(bombPath(w, { x: 50, y: 50 }, { x: 250, y: 50 })).toBeNull();
    expect(bombPath(w, { x: -1, y: 50 }, { x: 50, y: 50 })).toBeNull();
  });
  it('chooses nearest player deterministically', () => {
    const players = [{ x: 10, y: 0 }, { x: 3, y: 4 }];
    expect(nearestBombTarget({ x: 0, y: 0 }, players)).toBe(players[1]);
    expect(nearestBombTarget({ x: 0, y: 0 }, [])).toBeUndefined();
  });
});
