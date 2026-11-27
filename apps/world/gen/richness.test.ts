import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../../workshop/content';
import { Rng } from '../../workshop/core/rng';
import { defaultModel } from '../../workshop/logic/stats';
import { GEN, WORLD, WORLD_DRIVE } from '../config';
import { BIOME_IDS, type BiomeId, type HexPlan, type Obstacle, type Vec } from '../core/types';
import { featurePassable, obstaclePassable, surfaceEffect } from '../logic/rules';
import { traitsOf } from '../logic/traits';
import { COVERAGE_KIND, offRoadCoverage } from './coverage';
import { circleBounds, polygonDistanceSquared, SpatialGrid } from './geometry';
import { hexKey } from './hex';
import { hexInset } from './layout';
import { roadHub, roadOverlap } from './roads';
import { prepareGround, prepareSurface } from './surface';
import { WorldGen } from './world';

const COVERAGE: Record<BiomeId, readonly [number, number]> = {
  meadow: [0.005, 0.14], mud: [0.22, 0.50], rocky: [0.012, 0.12], lake: [0.36, 0.66], darkwood: [0.11, 0.38],
  snow: [0.22, 0.46], desert: [0.03, 0.22], jungle: [0.40, 0.66], canyon: [0.003, 0.11], geyser: [0.055, 0.22],
};

const SEEDS = [1, 3, 7, 29, 71, 99, 701, 5288, 5981, 8128];

function* samplePlans() {
  for (const seed of SEEDS) {
    const world = new WorldGen(seed);
    for (const coord of world.hexesNear(0, 0, 6)) yield { seed, world, plan: world.plan(coord) };
  }
}

function destinations(plan: HexPlan): Vec[] {
  return [
    ...plan.activities.flatMap(site => [site.at, ...site.targets.map(target => target.at)]),
    ...plan.items.map(item => item.at),
    ...[plan.giver, plan.home, plan.treasure].flatMap(spot => spot ? [spot.at] : []),
  ];
}

function unreachable(world: WorldGen, plan: HexPlan): Vec[] {
  const traits = traitsOf({ workshop: 'race', model: defaultModel(CATALOGS.race) });
  const radius = WORLD_DRIVE.colliderRadius[traits.width - 1];
  const solids = new SpatialGrid<Obstacle>();
  for (const obstacle of plan.obstacles) {
    if (!obstaclePassable(obstacle, traits)) {
      solids.insert(circleBounds(obstacle.at.x, obstacle.at.y, obstacle.radius + radius), obstacle);
    }
  }
  const gates = plan.features.filter(feature => !featurePassable(feature, traits));
  const sample = prepareSurface(plan);
  const hub = roadHub(world.seed, plan.coord);
  const step = 60;
  const extent = Math.ceil(WORLD.hexSize / step) + 9;
  const width = extent * 2 + 1;
  const seen = new Uint8Array(width * width);
  const reachable = (x: number, y: number) =>
    hexInset(plan.center, { x, y }) > 0 && surfaceEffect(traits.kind, sample(x, y), traits).passable
    && gates.every(feature => polygonDistanceSquared(feature.area, x, y) > radius ** 2)
    && solids.at(x, y).every(obstacle =>
      (x - obstacle.at.x) ** 2 + (y - obstacle.at.y) ** 2 > (obstacle.radius + radius) ** 2);

  const fromHub = (gx: number, gy: number) => ({ x: hub.x + gx * step, y: hub.y + gy * step });
  const connected = (a: Vec, b: Vec) => [0.25, 0.5, 0.75, 1].every(t =>
    reachable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
  const indexAt = (gx: number, gy: number) => (gy + extent) * width + gx + extent;
  const queue = [{ gx: 0, gy: 0 }];
  if (!reachable(hub.x, hub.y)) return destinations(plan);
  seen[indexAt(0, 0)] = 1;
  for (let i = 0; i < queue.length; i++) {
    const { gx, gy } = queue[i];
    const a = fromHub(gx, gy);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = gx + dx, y = gy + dy;
      const index = indexAt(x, y);
      if (seen[index] || !connected(a, fromHub(x, y))) continue;
      seen[index] = 1;
      queue.push({ gx: x, gy: y });
    }
  }

  return destinations(plan).filter(at => {
    const gx = Math.round((at.x - hub.x) / step), gy = Math.round((at.y - hub.y) / step);
    for (let y = gy - 1; y <= gy + 1; y++) {
      for (let x = gx - 1; x <= gx + 1; x++) {
        if (seen[indexAt(x, y)] && connected(fromHub(x, y), at)) return false;
      }
    }
    return true;
  });
}

describe('world terrain richness', () => {
  it('keeps all ten biomes in their off-road coverage ranges with dense, clear scatter', () => {
    const seen = new Set<BiomeId>();
    let lowBridges = 0;
    for (const { seed, plan } of samplePlans()) {
      const { biome } = plan;
      const context = `${seed}:${hexKey(plan.coord)} (${biome})`;
      seen.add(biome);
      const [min, max] = COVERAGE[biome];
      const coverage = offRoadCoverage(plan)[COVERAGE_KIND[biome]];
      expect(coverage, context).toBeGreaterThanOrEqual(min);
      expect(coverage, context).toBeLessThanOrEqual(max);
      expect(plan.obstacles.length, context).toBeGreaterThanOrEqual(4);
      const points = destinations(plan);
      const bridges = plan.features.filter(feature => feature.kind === 'bridge');
      lowBridges += bridges.filter(feature => feature.bypass).length;
      if (biome === 'lake' || biome === 'meadow') {
        const ground = prepareGround(plan);
        const sampled = prepareSurface(plan);
        for (const road of plan.roads.filter(road => road.kind === 'road')) {
          for (const at of road.points) {
            const kind = ground(at.x, at.y).kind;
            if (kind === 'deep' || kind === 'shallow') expect(sampled(at.x, at.y).kind, context).toBe('bridge');
          }
        }
      }
      for (const obstacle of plan.obstacles) {
        const clearance = obstacle.radius + GEN.placementClearance;
        expect(plan.roads.some(road => roadOverlap(road, obstacle.at, clearance)), obstacle.id).toBe(false);
        expect(points.every(at => Math.hypot(at.x - obstacle.at.x, at.y - obstacle.at.y) >= clearance), obstacle.id)
          .toBe(true);
      }
      if (biome === 'darkwood') {
        expect(prepareSurface(plan)(plan.center.x, plan.center.y).dark, context).toBeGreaterThanOrEqual(0.6);
        expect(plan.features.some(feature => feature.kind === 'cave'), context).toBe(true);
      }
      if (biome === 'lake') {
        expect(plan.terrain.filter(blob => blob.kind === 'deep'), context).toHaveLength(2);
        expect(plan.terrain.some(blob => blob.kind === 'grass'), context).toBe(true);
        expect(plan.activities.length, context).toBeGreaterThanOrEqual(2);
        expect(plan.items.length, context).toBeGreaterThanOrEqual(2);
      }
      if (biome === 'canyon') {
        const walls = plan.terrain.filter(blob => blob.kind === 'cliff' && blob.poly.length >= 24);
        expect(walls, context).toHaveLength(2);
        expect(plan.features.some(feature => feature.kind === 'narrow' && feature.bypass), context).toBe(true);
        expect(plan.features.some(feature => feature.kind === 'jump' && feature.bypass), context).toBe(true);
      }
      if (biome === 'geyser') {
        const vents = plan.obstacles.filter(obstacle => obstacle.kind === 'vent');
        const ground = prepareGround(plan);
        expect(vents.length, context).toBeGreaterThanOrEqual(1);
        expect(vents.every(vent => vent.effect === 'pass' && ground(vent.at.x, vent.at.y).kind === 'hotSpring')).toBe(true);
      }
    }
    expect(seen).toEqual(new Set(BIOME_IDS));
    expect(lowBridges).toBeGreaterThan(0);
  }, 60_000);

  it('connects each site, target, pickup and home to its hub for the default car', () => {
    for (const seed of [29, 71, 8128]) {
      const world = new WorldGen(seed, ['player']);
      for (const coord of world.hexesNear(0, 0, 4)) {
        const plan = world.plan(coord);
        expect(unreachable(world, plan), `${seed}:${hexKey(coord)} (${plan.biome})`).toEqual([]);
      }
    }
  }, 60_000);

  it('matches indexed obstacle queries against the full plan', () => {
    const world = new WorldGen(29);
    const rng = new Rng(8080);
    for (const coord of world.hexesNear(0, 0, 2)) {
      const plan = world.plan(coord);
      for (let i = 0; i < 10; i++) {
        const x = plan.center.x + rng.range(-1500, 1500), y = plan.center.y + rng.range(-1500, 1500);
        const radius = rng.range(10, 450);
        const expected = plan.obstacles
          .filter(obstacle => Math.hypot(obstacle.at.x - x, obstacle.at.y - y) <= obstacle.radius + radius)
          .map(obstacle => obstacle.id).sort();
        expect(world.obstaclesNear(coord, x, y, radius).map(obstacle => obstacle.id).sort()).toEqual(expected);
      }
    }
  });

  it('samples 10,000 random points from warm plans in well under 120 ms', () => {
    const world = new WorldGen(29);
    const rng = new Rng(9084);
    const centers = world.hexesNear(0, 0, 4).map(coord => world.plan(coord).center);
    const samples = Array.from({ length: 10_000 }, () => {
      const center = rng.pick(centers);
      let at: Vec;
      do {
        at = { x: center.x + rng.range(-WORLD.hexSize, WORLD.hexSize),
          y: center.y + rng.range(-WORLD.hexSize, WORLD.hexSize) };
      } while (hexInset(center, at) <= 0);
      return at;
    });
    for (const { x, y } of samples) world.surfaceAt(x, y);
    const timings = Array.from({ length: 3 }, () => {
      const start = performance.now();
      for (const { x, y } of samples) world.surfaceAt(x, y);
      return performance.now() - start;
    });
    // A median avoids treating a single GC pause as sampler work.
    const elapsed = timings.sort((a, b) => a - b)[1];
    expect(elapsed, `10,000 surface samples took ${elapsed.toFixed(1)} ms`).toBeLessThan(120); // alone ~40-60 ms; generous because the full parallel suite slows it. W1c: bring back near 50 alone.
  });
});
