import { describe, expect, it } from 'vitest';
import { QUEUED_MAPS } from '../../config/queuedMaps';
import { Tile, type WorldData } from '../../core/types';
import { scenesForWord } from '../../data/scenes';
import { DIRS } from './grid';
import { generateQueuedWorld, queuedFeatureSites, queuedIceAt } from './queuedWorlds';

const roadAt = (world: WorldData, x: number, y: number): number => (
  Math.floor(y / world.tileSize) * world.widthTiles + Math.floor(x / world.tileSize)
);

function roadsFromSpawn(world: WorldData, closed: readonly number[]): Set<number> {
  const spawn = world.playerSpawns[0];
  const queue = [roadAt(world, spawn.x, spawn.y)], visited = new Set(queue);
  while (queue.length > 0) {
    const road = queue.pop()!;
    const x = road % world.widthTiles, y = Math.floor(road / world.widthTiles);
    for (const { dx, dy } of DIRS) {
      const tx = x + dx, ty = y + dy;
      if (tx < 0 || tx >= world.widthTiles || ty < 0 || ty >= world.heightTiles) continue;
      const i = ty * world.widthTiles + tx;
      if (world.tiles[i] !== Tile.Road || closed.includes(i) || visited.has(i)) continue;
      visited.add(i);
      queue.push(i);
    }
  }
  return visited;
}

describe.each(QUEUED_MAPS)('%s', map => {
  it('generates repeatable terrain and changes road locations across seeds', () => {
    expect(generateQueuedWorld(map, 7)).toEqual(generateQueuedWorld(map, 7));
    expect(generateQueuedWorld(map, 7).roadMask).not.toEqual(generateQueuedWorld(map, 8).roadMask);
  });

  it('keeps all destinations reachable with the shortcut shut, away from the mover track', () => {
    for (const seed of [1, 2, 3, 7, 42, 88, 2026]) {
      const world = generateQueuedWorld(map, seed), ts = world.tileSize;
      const { gate, mover } = queuedFeatureSites(map, world);
      const reachable = roadsFromSpawn(world, gate.tiles);
      expect(gate.tiles.every(index => world.tiles[index] === Tile.Road)).toBe(true);
      expect(world.tiles[roadAt(world, gate.x, gate.y - 1.2 * ts)]).toBe(Tile.Water);
      expect(world.tiles[roadAt(world, gate.x, gate.y + 1.2 * ts)]).toBe(Tile.Water);
      expect(world.playerSpawns.every(({ x, y }) => reachable.has(roadAt(world, x, y)))).toBe(true);
      expect(world.places.length).toBeGreaterThanOrEqual(9);
      expect(new Set(world.places.map(place => place.word)).size).toBeGreaterThanOrEqual(6);
      for (const { word, front } of world.places) {
        expect(scenesForWord(word).length).toBeGreaterThan(0);
        expect(reachable.has(roadAt(world, front.x, front.y))).toBe(true);
      }
      const clear = mover.length / 2 + ts;
      for (let x = mover.x - clear; x <= mover.x + clear; x += ts) {
        expect(world.tiles[roadAt(world, x, mover.y)]).toBe(Tile.Sidewalk);
      }
      for (const { x, y } of world.laneGraph.nodes) {
        expect(reachable.has(roadAt(world, x, y))).toBe(true);
      }
    }
  });
});

it('detects icy patches only inside the Tundra ice tiles', () => {
  const world = generateQueuedWorld('tundra', 7);
  const { tileSize: ts, widthTiles: w, tiles, playerSpawns } = world;
  const ice = tiles.indexOf(Tile.Dirt);
  expect(queuedIceAt(world, (ice % w + 0.5) * ts, (Math.floor(ice / w) + 0.5) * ts)).toBe(true);
  expect(queuedIceAt(world, playerSpawns[0].x, playerSpawns[0].y)).toBe(false);
  expect(queuedIceAt(world, -1, playerSpawns[0].y)).toBe(false);
});
