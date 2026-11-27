import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../../workshop/content';
import { defaultModel } from '../../workshop/logic/stats';
import { GEN, WORLD } from '../config';
import { BIOME_IDS, type HexCoord, type RoadSurface, type Vec } from '../core/types';
import { surfaceEffect } from '../logic/rules';
import { traitsOf } from '../logic/traits';
import { biomeAt, homeHexFor } from './biome';
import { polygonDistanceSquared } from './geometry';
import { distance, neighbor, ring } from './hex';
import { edgeCrossing, roadHub } from './roads';
import { generateHex, WorldGen } from './world';
import { surfaceAt } from './surface';

function bendRadius(a: Vec, b: Vec, c: Vec): number {
  const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const length = (p: Vec, q: Vec) => Math.hypot(p.x - q.x, p.y - q.y);
  return area < 1e-6 ? Infinity : length(a, b) * length(b, c) * length(c, a) / (2 * area);
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

  it('keeps the crossroad connected and shares its edge crossings exactly', () => {
    const world = new WorldGen(91234);
    for (const coord of disk(8)) {
      const plan = world.plan(coord);
      const roads = plan.roads.filter(road => road.kind === 'road');
      expect(roads).toHaveLength(2);
      const endpoints = roads.flatMap(road => [road.points[0], road.points.at(-1)]);
      const hub = roadHub(world.seed, coord);
      expect(roads.every(road => road.points.some(at => at.x === hub.x && at.y === hub.y))).toBe(true);
      for (const edge of plan.links) {
        const other = neighbor(coord, edge);
        const backEdge = (edge + 3) % 6;
        expect(world.plan(other).links).toContain(backEdge);
        expect(endpoints).toContainEqual(edgeCrossing(world.seed, coord, edge));
      }
    }
  });

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
        expect(frequency, `${biome} frequency for seed ${seed}`).toBeGreaterThanOrEqual(0.06);
        expect(frequency, `${biome} frequency for seed ${seed}`).toBeLessThanOrEqual(0.14);
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
      const nearby = [home, ...[1, 2, 3].flatMap(radius => ring(home, radius))];
      expect(new Set(nearby.map(coord => world.plan(coord).biome)).size).toBeGreaterThanOrEqual(6);
    }
    const owners = homes.map((home) => world.plan(home).home?.owner);
    expect(new Set(owners).size).toBe(profiles.length);
    expect(homeHexFor(seed, 'ada')).toEqual(world.homeFor('ada'));
    expect(homeHexFor(seed, 'ben', [world.homeFor('ada')!])).not.toEqual(world.homeFor('ada'));
  });

  it('keeps route samples drivable with broad bends', () => {
    const world = new WorldGen(6688);
    for (const coord of disk(4)) {
      const plan = world.plan(coord);
      for (const road of plan.roads) {
        expect(road.points.length).toBeGreaterThan(1);
        const minRadius = (road.kind === 'road' ? 600 : 350) * WORLD.hexSize / 1200;
        for (let i = 2; i < road.points.length; i++) {
          expect(bendRadius(road.points[i - 2], road.points[i - 1], road.points[i])).toBeGreaterThanOrEqual(minRadius);
        }
        for (const point of road.points) {
          const surface = world.surfaceAt(point.x, point.y);
          expect(['road', 'path', 'bridge'], `${coord.q},${coord.r} road point (${point.x},${point.y})`).toContain(surface.kind);
        }
      }
    }
  });

  it('reports paved, dirt and rocky roads with progressively slower handling for both default builds', () => {
    const world = new WorldGen(29, ['player']);
    const seen = new Set<RoadSurface>();
    for (const coord of disk(4)) {
      const plan = world.plan(coord);
      const { x, y } = roadHub(world.seed, coord);
      const surface = world.surfaceAt(x, y);
      expect(surface.kind).toBe('road');
      expect(surface.roadSurface).toBe(plan.roads[0].surface);
      seen.add(surface.roadSurface!);
      if (plan.home) expect(surface.roadSurface).toBe('paved');
    }
    expect(seen).toEqual(new Set(['paved', 'dirt', 'rocky']));
    for (const workshop of ['race', 'dino'] as const) {
      const traits = traitsOf({ workshop, model: defaultModel(CATALOGS[workshop]) });
      const speeds = (['paved', 'dirt', 'rocky'] as const).map(roadSurface => {
        const effect = surfaceEffect(traits.kind, { kind: 'road', biome: 'meadow', dark: 0, covered: false, roadSurface }, traits);
        expect(effect.passable).toBe(true);
        return effect.speedMult;
      });
      expect(speeds[0]).toBeGreaterThan(speeds[1]);
      expect(speeds[1]).toBeGreaterThan(speeds[2]);
      const rocky = { kind: 'road', biome: 'canyon', dark: 0, covered: false, roadSurface: 'rocky' } as const;
      const smooth = surfaceEffect(traits.kind, rocky, traits);
      const bump = surfaceEffect(traits.kind, { ...rocky, roadRoughness: 1 }, traits);
      expect(bump.drag).toBeGreaterThan(smooth.drag);
      expect(bump.grip).toBeLessThan(smooth.grip);
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
            expect(feature.bypassAt, feature.id).toBeDefined();
            const { x, y } = feature.bypassAt!;
            expect(polygonDistanceSquared(feature.area, x, y)).toBeGreaterThan(42 ** 2);
            expect(['cliff', 'deep']).not.toContain(world.surfaceAt(x, y).kind);
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
