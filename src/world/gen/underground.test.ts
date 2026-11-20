import { describe, expect, it } from 'vitest';
import { Tile } from '../../core/types';
import { signSceneFor } from '../../data/places';
import { isDrivable, tileAt } from '../geometry';
import { undergroundTileIndex } from '../undergroundTiles';
import { largestScc } from './analysis';
import { generateUnderground, isUndergroundLava, UNDERGROUND_CROSSINGS, UNDERGROUND_RAIL_LOOPS, undergroundRiverSpan } from './underground';

describe('Underground layout', () => {
  it('is seeded and connects spawns, ramps, and signed goals to one traffic network', () => {
    const world = generateUnderground(17), ts = world.tileSize;
    expect(generateUnderground(17)).toEqual(world);
    expect(generateUnderground(3).tiles).not.toEqual(world.tiles);
    expect(world.laneGraph.nodes.length).toBeGreaterThan(500);
    expect(largestScc(world.laneGraph)).toBe(world.laneGraph.nodes.length);
    expect(world.places.length).toBeGreaterThan(8);
    for (const p of world.places) expect(signSceneFor(p.word)).toBeTruthy();
    const approaches = [...world.places.map(p => p.front), ...world.playerSpawns, ...world.ramps];
    for (const p of approaches) expect(tileAt(world, Math.floor(p.x / ts), Math.floor(p.y / ts))).toBe(Tile.Road);
  });

  it('treats the lava as solid except on its three reinforced crossings', () => {
    for (const seed of [3, 17, 99]) {
      const world = generateUnderground(seed);
      for (let y = 0; y < world.heightTiles; y++) {
        const isCrossing = UNDERGROUND_CROSSINGS.some(row => y === row || y === row + 1);
        const [left, right] = undergroundRiverSpan(y, world.heightTiles, seed);
        for (let x = left; x < right; x++) {
          expect(tileAt(world, x, y)).toBe(isCrossing ? Tile.Road : Tile.Water);
          expect(isUndergroundLava(world, x, y)).toBe(!isCrossing);
          if (!isCrossing) expect(undergroundTileIndex(world, y * world.widthTiles + x)).toBe(5);
        }
      }
      expect(undergroundTileIndex(world, 0)).toBe(0); // rock is solid too, but has a different look
    }
  });

  it('keeps both minecart circuits on cavern floor', () => {
    for (const seed of [3, 17, 99]) {
      const world = generateUnderground(seed), ts = world.tileSize;
      for (const path of UNDERGROUND_RAIL_LOOPS) for (let i = 0; i < path.length; i++) {
        const start = path[i], end = path[(i + 1) % path.length];
        for (let j = 0; j <= 16; j++) {
          const t = j / 16;
          expect(isDrivable(world, (start.x + (end.x - start.x) * t) * ts, (start.y + (end.y - start.y) * t) * ts)).toBe(true);
        }
      }
    }
  });
});
