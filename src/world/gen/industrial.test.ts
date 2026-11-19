import { describe, expect, it } from 'vitest';
import { GOALS, WORLD } from '../../config/gameConfig';
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

describe('generateIndustrial walls', () => {
  it('never has a building run longer than WORLD.maxBuildingRun, and gaps are open ground', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const w = generateIndustrial(seed);
      const W = w.widthTiles, H = w.heightTiles;
      let best = 0;
      for (let y = 0; y < H; y++) { let r = 0; for (let x = 0; x < W; x++) { r = w.tiles[y * W + x] === Tile.Building ? r + 1 : 0; best = Math.max(best, r); } }
      for (let x = 0; x < W; x++) { let r = 0; for (let y = 0; y < H; y++) { r = w.tiles[y * W + x] === Tile.Building ? r + 1 : 0; best = Math.max(best, r); } }
      expect(best).toBeLessThanOrEqual(WORLD.maxBuildingRun);
      expect(w.buildings.filter((b) => b.placeWord).length).toBe(4);
      for (const b of w.buildings) expect(w.tiles[b.ty * W + b.tx]).toBe(Tile.Building);
    }
    expect(generateIndustrial(5)).toEqual(generateIndustrial(5));
  });
});

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
    expect(bridges).toHaveLength(5);
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

describe('generateIndustrial props and bridges', () => {
  const corners = (d: { x: number; y: number; w: number; h: number; angle: number }) => {
    const c = Math.cos(d.angle), s = Math.sin(d.angle);
    const pts: Vec2[] = [];
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
      pts.push({ x: d.x + (u * d.w / 2) * c - (v * d.h / 2) * s, y: d.y + (u * d.w / 2) * s + (v * d.h / 2) * c });
    }
    return pts;
  };
  const landmarkKinds = new Set(['bridge', 'factoryBay', 'gantry', 'loadingYard', 'waterTower']);

  it('has five or six bridges, each with road on both sides, for many seeds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const world = generateIndustrial(seed);
      const ts = world.tileSize;
      const bridges = world.industrial!.decorations.filter((d) => d.kind === 'bridge');
      expect(bridges.length).toBeGreaterThanOrEqual(5);
      expect(bridges.length).toBeLessThanOrEqual(6);
      for (const b of bridges) {
        expect(isRoadAt(world, { x: b.x - b.w / 2 - ts / 2, y: b.y - ts / 2 })).toBe(true);
        expect(isRoadAt(world, { x: b.x + b.w / 2 + ts / 2, y: b.y + ts / 2 })).toBe(true);
      }
      expect(largestScc(world.laneGraph)).toBe(world.laneGraph.nodes.length);
    }
  });

  it('is deterministic and places plenty of clutter', () => {
    expect(generateIndustrial(9).industrial).toEqual(generateIndustrial(9).industrial);
    for (const seed of [3, 7, 11]) {
      const props = generateIndustrial(seed).industrial!.decorations.filter((d) => !landmarkKinds.has(d.kind));
      expect(props.length).toBeGreaterThan(80);
      expect(new Set(props.map((d) => d.kind)).size).toBeGreaterThanOrEqual(10);
    }
  });

  it('never overlaps roads, buildings, rail, goal fronts, spawn or other clutter', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const world = generateIndustrial(seed);
      const ts = world.tileSize;
      const { decorations, rail } = world.industrial!;
      const props = decorations.filter((d) => !landmarkKinds.has(d.kind) && d.kind !== 'roofLights');
      for (const d of props) {
        for (const p of corners(d)) {
          expect(world.tiles[Math.floor(p.y / ts) * world.widthTiles + Math.floor(p.x / ts)]).toBe(Tile.Plaza);
          for (let i = 0; i < rail.points.length; i++) {
            const a = rail.points[i], b = rail.points[(i + 1) % rail.points.length];
            const dx = b.x - a.x, dy = b.y - a.y;
            const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
            expect(Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)).toBeGreaterThan(ts);
          }
          for (const { front } of world.places) expect(Math.hypot(p.x - front.x, p.y - front.y)).toBeGreaterThan(GOALS.radius);
          for (const sp of world.playerSpawns) expect(Math.hypot(p.x - sp.x, p.y - sp.y)).toBeGreaterThan(2 * ts);
          for (const { center } of rail.crossings) expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeGreaterThan(2 * ts);
        }
      }
      for (const r of decorations.filter((d) => d.kind === 'roofLights')) {
        expect(world.tiles[Math.floor(r.y / ts) * world.widthTiles + Math.floor(r.x / ts)]).toBe(Tile.Building);
      }
      // Footprint cells never share a tile, so props cannot stack or wall in a lane.
      const seen = new Set<number>();
      for (const d of props) {
        const key = Math.floor(d.y / ts) * world.widthTiles + Math.floor(d.x / ts);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});
