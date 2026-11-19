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

function reachableRoadTiles(world: WorldData, blocked: ReadonlySet<number>): Set<number> {
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
  return visited;
}

describe('generateIndustrial', () => {
  it('repeats a seed and varies the warehouse footprints with the seed', () => {
    expect(generateIndustrial(3)).toEqual(generateIndustrial(3));
    expect(generateIndustrial(3).tiles).not.toEqual(generateIndustrial(17).tiles);
  });

  it.each([3, 17, 92])('keeps the road network connected while either crossing is closed (seed %d)', (seed) => {
    const world = generateIndustrial(seed);
    const { decorations, rail } = world.industrial!;
    const { tileSize: ts, widthTiles } = world;
    const tileId = ({ x, y }: Vec2) => Math.floor(y / ts) * widthTiles + Math.floor(x / ts);
    const roadCount = world.tiles.filter((tile) => tile === Tile.Road).length;
    expect(reachableRoadTiles(world, new Set()).size).toBe(roadCount);
    const allCrossings = new Set<number>();
    expect(rail.crossings).toHaveLength(2);
    for (const { center, width } of rail.crossings) {
      const blocked = new Set<number>();
      for (let x = center.x - width / 2 + ts / 2; x < center.x + width / 2; x += ts) {
        for (const y of [center.y - ts / 2, center.y + ts / 2]) {
          expect(isRoadAt(world, { x, y })).toBe(true);
          blocked.add(tileId({ x, y }));
          allCrossings.add(tileId({ x, y }));
        }
      }
      expect(reachableRoadTiles(world, blocked).size).toBe(roadCount - blocked.size);
    }
    const reachable = reachableRoadTiles(world, allCrossings);
    for (const point of [...world.places.map((p) => p.front), ...world.playerSpawns, ...world.ramps]) {
      expect(reachable.has(tileId(point))).toBe(true);
    }
    expect(largestScc(world.laneGraph)).toBe(world.laneGraph.nodes.length);
    expect(world.laneGraph.nodes.every((node) => isRoadAt(world, node))).toBe(true);

    const bridges = decorations.filter(({ kind }) => kind === 'bridge');
    expect(bridges).toHaveLength(3);
    for (const bridge of bridges) {
      expect(reachable.has(tileId(bridge))).toBe(true);
      for (let x = bridge.x - bridge.w / 2 + ts / 2; x < bridge.x + bridge.w / 2; x += ts) {
        expect(isRoadAt(world, { x, y: bridge.y - ts / 2 })).toBe(true);
        expect(isRoadAt(world, { x, y: bridge.y + ts / 2 })).toBe(true);
        expect(isDrivable(world, x, bridge.y - bridge.h / 2 - ts / 2)).toBe(false);
        expect(isDrivable(world, x, bridge.y + bridge.h / 2 + ts / 2)).toBe(false);
      }
    }
  });

  it('runs the entire rail circuit over usable ground and marks every road crossing', () => {
    const world = generateIndustrial(3);
    const { points, crossings } = world.industrial!.rail;
    const { tileSize: ts } = world;
    const seen = new Set<number>();
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      expect(length).toBeGreaterThan(ts);
      const samples = Math.ceil(length / (ts / 8));
      for (let j = 0; j < samples; j++) {
        const t = (j + 0.5) / samples;
        const x = a.x + t * dx, y = a.y + t * dy;
        expect(isDrivable(world, x, y)).toBe(true);
        const crossing = crossings.findIndex(({ center, width }) =>
          center.y === y && Math.abs(center.x - x) < width / 2);
        expect(isRoadAt(world, { x, y })).toBe(crossing !== -1);
        if (crossing !== -1) seen.add(crossing);
      }
    }
    expect(seen.size).toBe(crossings.length);
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
      for (const { center } of rail.crossings) {
        expect(Math.hypot(front.x - center.x, front.y - center.y)).toBeGreaterThan(GOALS.radius);
      }
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
