import { describe, expect, it } from 'vitest';
import { QUEUED_MAPS } from '../../config/queuedMaps';
import { Tile, type WorldData } from '../../core/types';
import { scenesForWord } from '../../data/scenes';
import { measureCircuit } from '../../systems/freightTiming';
import { DIRS } from './grid';
import {
  generateQueuedWorld, hasQueuedRail, QUEUED_SHOWCASE_STYLE, queuedBuildingQuarterTurns, queuedFeatureSites,
  queuedIceAt, queuedMushroomFeatures, queuedRailRoute,
} from './queuedWorlds';

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

  it('varies footprints and styles and puts a landmark on the closest destination to the start', () => {
    const world = generateQueuedWorld(map, 3);
    const spawn = world.playerSpawns[0];
    const distance = (point: { x: number; y: number }) => Math.hypot(point.x - spawn.x, point.y - spawn.y);
    expect(new Set(world.buildings.map(({ style }) => style)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(world.buildings.map(({ tw, th }) => `${tw}×${th}`)).size).toBeGreaterThanOrEqual(3);
    const showcases = world.buildings.filter(({ style }) => style === QUEUED_SHOWCASE_STYLE);
    expect(showcases).toHaveLength(1);
    const site = world.places.find(({ buildingId }) => buildingId === showcases[0].id)!;
    expect(distance(site.front)).toBeCloseTo(Math.min(...world.places.map(place => distance(place.front))), 0);
    for (const place of world.places) {
      const lot = world.buildings[place.buildingId];
      expect(queuedBuildingQuarterTurns(map, world, lot)).toBe(place.front.y < lot.ty * world.tileSize ? 2 : 0);
    }
  });

  it('adds deterministic, themed knockable props off the road and building footprints', () => {
    const world = generateQueuedWorld(map, 17);
    expect(world.props.length).toBeGreaterThanOrEqual(8);
    expect(generateQueuedWorld(map, 17).props).toEqual(world.props);
    for (const prop of world.props) {
      const x = Math.floor(prop.x / world.tileSize), y = Math.floor(prop.y / world.tileSize);
      expect([Tile.Grass, Tile.Park, Tile.Dirt]).toContain(world.tiles[y * world.widthTiles + x]);
      expect(world.tiles[y * world.widthTiles + x]).not.toBe(Tile.Road);
    }
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
      if (!hasQueuedRail(map)) {
        const clear = mover.length / 2 + ts;
        for (let x = mover.x - clear; x <= mover.x + clear; x += ts) {
          expect(world.tiles[roadAt(world, x, mover.y)]).toBe(Tile.Sidewalk);
        }
      }
      for (const { x, y } of world.laneGraph.nodes) {
        expect(reachable.has(roadAt(world, x, y))).toBe(true);
      }
    }
  });
});

it('connects Mushroom Island’s waterfront boardwalk to the road beside the start', () => {
  const world = generateQueuedWorld('mushroom', 3);
  const { boardwalk, cove, garden } = queuedMushroomFeatures(world.seed);
  const { widthTiles: width } = world;
  const at = (x: number, y: number) => world.tiles[y * width + x];
  const [[dockX, dockY]] = boardwalk;
  expect(at(dockX, dockY - 1)).toBe(Tile.Road);
  for (const [bx, by, w, h] of boardwalk) {
    for (let y = by; y < by + h; y++) for (let x = bx; x < bx + w; x++) expect(at(x, y)).toBe(Tile.Sidewalk);
  }
  const [[cx, cy, cw]] = cove;
  expect(at(cx + cw - 1, cy + 2)).toBe(Tile.Water);
  expect(at(garden[0], garden[1])).toBe(Tile.Plaza);
});

describe.each(QUEUED_MAPS.filter(hasQueuedRail))('%s loop', map => {
  it('keeps rolling stock clear of terrain and lets road traffic detour around occupied crossings', () => {
    for (const seed of [1, 2, 3, 7, 42, 88, 2026]) {
      const world = generateQueuedWorld(map, seed);
      const route = queuedRailRoute(map, world);
      const circuit = measureCircuit(route);
      const ts = world.tileSize;
      expect(circuit.crossings).toHaveLength(2);
      expect(circuit.sample(circuit.length)).toEqual(circuit.sample(0));
      for (let d = 0; d < circuit.length; d += ts / 8) {
        const { x, y } = circuit.sample(d);
        for (const ox of [-ts / 3, 0, ts / 3]) for (const oy of [-ts / 3, 0, ts / 3]) {
          const tile = world.tiles[roadAt(world, x + ox, y + oy)];
          expect(tile === Tile.Road || tile === Tile.Sidewalk).toBe(true);
        }
      }
      const crossingTiles = circuit.crossings.flatMap(({ center }) => [-ts / 2, ts / 2]
        .map(offset => roadAt(world, center.x, center.y + offset)));
      expect(crossingTiles.every(i => world.tiles[i] === Tile.Road)).toBe(true);
      const { gate } = queuedFeatureSites(map, world);
      const reachable = roadsFromSpawn(world, [...gate.tiles, ...crossingTiles]);
      expect(world.places.every(({ front }) => reachable.has(roadAt(world, front.x, front.y)))).toBe(true);
      expect(world.playerSpawns.every(({ x, y }) => reachable.has(roadAt(world, x, y)))).toBe(true);
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
