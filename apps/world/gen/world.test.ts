import { describe, expect, it } from 'vitest';
import { GEN } from '../config';
import { BIOME_IDS, type HexCoord, type Vec } from '../core/types';
import { biomeAt, homeHexFor } from './biome';
import { distance, neighbor, ring } from './hex';
import { edgeCrossing } from './roads';
import { generateHex, WorldGen } from './world';
import { surfaceAt } from './surface';

function withinConvexPolygon(point: Vec, polygon: Vec[]): boolean {
  const sides = polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
  });
  return sides.every(side => side >= 0) || sides.every(side => side <= 0);
}

function disk(radius: number): HexCoord[] {
  const coords: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const coord = { q, r };
      if (distance(coord, { q: 0, r: 0 }) <= radius) coords.push(coord);
    }
  }
  return coords;
}

describe('world generation', () => {
  it('is deterministic for the same seed and coordinate', () => {
    for (const coord of [{ q: 0, r: 0 }, { q: -4, r: 2 }, { q: 17, r: -12 }]) {
      expect(generateHex(481516, coord)).toEqual(generateHex(481516, coord));
    }
    expect(new WorldGen(481516).plan({ q: 3, r: -2 })).toEqual(new WorldGen(481516).plan({ q: 3, r: -2 }));
  });

  it('keeps shared edge links symmetric', () => {
    const world = new WorldGen(91234);
    for (const coord of disk(8)) {
      const plan = world.plan(coord);
      expect(plan.links.length, `${coord.q},${coord.r} link count`).toBeGreaterThanOrEqual(2);
      for (const edge of plan.links) {
        const other = neighbor(coord, edge);
        const backEdge = (edge + 3) % 6;
        expect(world.plan(other).links).toContain(backEdge);
      }
    }
  }, 60_000);

  it('shares exactly the same crossing point from either side of each edge', () => {
    const seed = 53021;
    for (const coord of disk(7)) {
      for (let edge = 0; edge < 6; edge++) {
        expect(edgeCrossing(seed, coord, edge)).toEqual(
          edgeCrossing(seed, neighbor(coord, edge), (edge + 3) % 6),
        );
      }
    }
  });

  it('keeps all ten biomes in the specified frequency over multiple seeds', () => {
    const coords = disk(20);
    for (const seed of [1, 29, 8128]) {
      const counts = new Map(BIOME_IDS.map((biome) => [biome, 0]));
      for (const coord of coords) counts.set(biomeAt(seed, coord), counts.get(biomeAt(seed, coord))! + 1);
      for (const biome of BIOME_IDS) {
        const frequency = counts.get(biome)! / coords.length;
        expect(frequency, `${biome} frequency for seed ${seed}`).toBeGreaterThanOrEqual(0.04);
        expect(frequency, `${biome} frequency for seed ${seed}`).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it('connects every hex in a six-ring disk by linked edges', () => {
    const world = new WorldGen(20261127);
    const coords = disk(6);
    const keys = new Set(coords.map(({ q, r }) => `${q},${r}`));
    const seen = new Set(['0,0']);
    const queue: HexCoord[] = [{ q: 0, r: 0 }];
    while (queue.length) {
      const coord = queue.shift()!;
      for (const edge of world.plan(coord).links) {
        const next = neighbor(coord, edge);
        const key = `${next.q},${next.r}`;
        if (keys.has(key) && !seen.has(key)) {
          seen.add(key);
          queue.push(next);
        }
      }
    }
    expect(seen.size).toBe(coords.length);
  });

  it('returns rings with the expected six-sided counts', () => {
    expect(ring({ q: 2, r: -1 }, 0)).toEqual([{ q: 2, r: -1 }]);
    expect(ring({ q: 0, r: 0 }, 5)).toHaveLength(30);
  });

  it('places every personalized home in a distinct meadow hex in rings two through four', () => {
    const seed = 7241;
    const profiles = ['ada', 'ben', 'cy', 'dee', 'eli', 'fay'];
    const world = new WorldGen(seed, profiles);
    const homes = profiles.map((id) => world.homeFor(id)!);
    expect(new WorldGen(seed, [...profiles].reverse()).homeFor('ada')).toEqual(world.homeFor('ada'));
    expect(new Set(homes.map(({ q, r }) => `${q},${r}`)).size).toBe(homes.length);
    for (const home of homes) {
      expect(distance(home, { q: 0, r: 0 })).toBeGreaterThanOrEqual(2);
      expect(distance(home, { q: 0, r: 0 })).toBeLessThanOrEqual(4);
      expect(world.plan(home).biome).toBe('meadow');
    }
    const owners = homes.map((home) => world.plan(home).home?.owner);
    expect(new Set(owners).size).toBe(profiles.length);
    expect(homeHexFor(seed, 'ada')).toEqual(world.homeFor('ada'));
    expect(homeHexFor(seed, 'ben', [world.homeFor('ada')!])).not.toEqual(world.homeFor('ada'));
  });

  it('keeps every generated road sample on drivable road, path or bridge surface', () => {
    const world = new WorldGen(6688);
    for (const coord of disk(4)) {
      const plan = world.plan(coord);
      for (const road of plan.roads) {
        expect(road.points.length).toBeGreaterThan(1);
        for (const point of road.points) {
          const surface = world.surfaceAt(point.x, point.y);
          expect(['road', 'path', 'bridge'], `${coord.q},${coord.r} road point (${point.x},${point.y})`).toContain(surface.kind);
        }
      }
    }
  });

  it('places activity targets outside cliffs', () => {
    const world = new WorldGen(345678);
    for (const coord of disk(5)) {
      for (const site of world.plan(coord).activities) {
        for (const target of site.targets) {
          expect(world.surfaceAt(target.at.x, target.at.y).kind, site.id).not.toBe('cliff');
        }
      }
    }
  });

  it('gives ordinary hexes activities and item spots across several seeds', () => {
    for (const seed of [7, 71, 701]) {
      const world = new WorldGen(seed);
      for (const coord of disk(5)) {
        const plan = world.plan(coord);
        if (plan.home) continue;
        expect(plan.activities.length, `activities at ${seed}:${coord.q},${coord.r}`).toBeGreaterThanOrEqual(2);
        expect(plan.activities.length).toBeLessThanOrEqual(3);
        expect(plan.items.length, `items at ${seed}:${coord.q},${coord.r}`).toBeGreaterThanOrEqual(2);
        expect(plan.items.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it('samples bridges and covered dark features with their surface effects', () => {
    const seeds = [3, 31, 313];
    let foundBridge = false;
    let foundCovered = false;
    for (const seed of seeds) {
      const world = new WorldGen(seed);
      for (const coord of disk(8)) {
        const plan = world.plan(coord);
        for (const feature of plan.features) {
          if (feature.kind === 'bridge') {
            foundBridge = true;
            expect(world.surfaceAt(feature.at.x, feature.at.y).kind).toBe('bridge');
          }
          if (feature.kind === 'cave' || feature.kind === 'tunnel') {
            foundCovered = true;
            const sample = world.surfaceAt(feature.at.x, feature.at.y);
            expect(sample.covered).toBe(true);
            expect(sample.dark).toBeGreaterThan(0);
          }
          if (feature.needs?.length) {
            expect(feature.bypass).toBe(true);
            const bypass = plan.roads.find(road => road.kind === 'path' && road.points.length > 2);
            expect(bypass, feature.id).toBeDefined();
            const route = bypass!.points;
            expect(plan.roads.some(road => road !== bypass
              && road.points[0].x === route[0].x && road.points[0].y === route[0].y
              && road.points.at(-1)?.x === route.at(-1)?.x
              && road.points.at(-1)?.y === route.at(-1)?.y)).toBe(true);
            expect(route.every(point => !withinConvexPolygon(point, feature.area))).toBe(true);
          }
        }
      }
    }
    expect(foundBridge).toBe(true);
    expect(foundCovered).toBe(true);
  }, 20000);

  it('reuses recent plans and reproduces the same surface after eviction', () => {
    const seed = 47;
    const world = new WorldGen(seed);
    const origin = { q: 0, r: 0 };
    const original = world.plan(origin);
    expect(world.plan(origin)).toBe(original);
    const sample = world.surfaceAt(0, 0);
    for (let q = 1; q <= GEN.planCacheSize; q++) world.plan({ q, r: 0 });
    expect(world.plan(origin)).not.toBe(original);
    expect(world.plan(origin)).toEqual(original);
    expect(world.surfaceAt(0, 0)).toEqual(sample);
    expect(surfaceAt(seed, 0, 0)).toEqual(sample);
  });
});
