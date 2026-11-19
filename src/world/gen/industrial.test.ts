import { describe, expect, it } from 'vitest';
import { GOALS } from '../../config/gameConfig';
import { Tile, type Vec2, type WorldData } from '../../core/types';
import { signSceneFor } from '../../data/places';
import { isDrivable, tileAt } from '../geometry';
import { largestScc } from './analysis';
import { DIRS } from './grid';
import { generateIndustrial } from './industrial';

function isRoadAt(world: WorldData, { x, y }: Vec2): boolean {
  return tileAt(world, Math.floor(x / world.tileSize), Math.floor(y / world.tileSize)) === Tile.Road;
}

function reachableRoadTiles(world: WorldData, blocked: ReadonlySet<number>): number {
  const { widthTiles, tiles } = world;
  const start = tiles.indexOf(Tile.Road);
  const visited = new Set([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const x = queue[i] % widthTiles;
    const y = Math.floor(queue[i] / widthTiles);
    for (const { dx, dy } of DIRS) {
      const next = (y + dy) * widthTiles + x + dx;
      if (tileAt(world, x + dx, y + dy) !== Tile.Road || blocked.has(next) || visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited.size;
}

describe('generateIndustrial', () => {
  it('repeats a seed and varies the warehouse footprints with the seed', () => {
    expect(generateIndustrial(3)).toEqual(generateIndustrial(3));
    expect(generateIndustrial(3).tiles).not.toEqual(generateIndustrial(17).tiles);
  });

  it.each([3, 17, 92])('connects the loops and both bridge decks even with the grade crossing closed (seed %d)', (seed) => {
    const world = generateIndustrial(seed);
    const { decorations, rail } = world.industrial!;
    const { tileSize: ts, widthTiles } = world;
    const crossingTiles = new Set<number>();
    const left = rail.crossing.x - rail.crossingWidth / 2;
    const right = rail.crossing.x + rail.crossingWidth / 2;
    for (let x = rail.start.x + ts / 2; x < rail.end.x; x += ts) {
      for (const y of [rail.crossing.y - ts / 2, rail.crossing.y + ts / 2]) {
        const road = isRoadAt(world, { x, y });
        expect(road).toBe(x > left && x < right);
        if (road) crossingTiles.add(Math.floor(y / ts) * widthTiles + Math.floor(x / ts));
      }
    }
    expect(crossingTiles.size).toBeGreaterThan(0);
    const roadCount = world.tiles.filter((tile) => tile === Tile.Road).length;
    expect(reachableRoadTiles(world, new Set())).toBe(roadCount);
    expect(reachableRoadTiles(world, crossingTiles)).toBe(roadCount - crossingTiles.size);
    expect(largestScc(world.laneGraph)).toBe(world.laneGraph.nodes.length);
    expect(world.laneGraph.nodes.every((node) => isRoadAt(world, node))).toBe(true);

    const bridges = decorations.filter(({ kind }) => kind === 'bridge');
    expect(bridges).toHaveLength(2);
    for (const bridge of bridges) {
      for (let x = bridge.x - bridge.w / 2 + ts / 2; x < bridge.x + bridge.w / 2; x += ts) {
        expect(isRoadAt(world, { x, y: bridge.y - ts / 2 })).toBe(true);
        expect(isRoadAt(world, { x, y: bridge.y + ts / 2 })).toBe(true);
        expect(isDrivable(world, x, bridge.y - bridge.h / 2 - ts / 2)).toBe(false);
        expect(isDrivable(world, x, bridge.y + bridge.h / 2 + ts / 2)).toBe(false);
      }
    }
  });

  it('keeps both factory portals, open goal approaches and the ramp run on usable ground', () => {
    const world = generateIndustrial(3);
    const { decorations, rail } = world.industrial!;
    const { tileSize: ts } = world;
    const bays = decorations.filter(({ kind }) => kind === 'factoryBay');
    expect(bays).toHaveLength(2);
    for (const { x, y, w } of bays) {
      for (let along = x - w / 2 - ts / 2; along <= x + w / 2 + ts / 2; along += ts) {
        expect(isRoadAt(world, { x: along, y: y - ts / 2 })).toBe(true);
        expect(isRoadAt(world, { x: along, y: y + ts / 2 })).toBe(true);
      }
    }
    expect(world.places.length).toBeGreaterThanOrEqual(4);
    for (const { front, sign, word } of world.places) {
      expect(signSceneFor(word)).toBeTruthy();
      expect(isRoadAt(world, front)).toBe(true);
      expect(Math.abs(front.y - rail.crossing.y)).toBeGreaterThan(GOALS.radius);
      expect(isDrivable(world, sign.x, sign.y)).toBe(false);
      for (const { dx, dy } of DIRS) {
        expect(isDrivable(world, front.x + dx * GOALS.radius, front.y + dy * GOALS.radius)).toBe(true);
      }
    }
    for (const spawn of world.playerSpawns) expect(isRoadAt(world, spawn)).toBe(true);
    const [ramp] = world.ramps;
    for (let x = ramp.x - 3 * ts; x < ramp.x + 5 * ts; x += ts / 2) {
      expect(isRoadAt(world, { x, y: ramp.y })).toBe(true);
    }
  });
});
