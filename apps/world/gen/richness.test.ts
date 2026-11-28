import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../../workshop/content';
import { Rng } from '../../workshop/core/rng';
import { defaultModel } from '../../workshop/logic/stats';
import { GEN, WORLD, WORLD_DRIVE } from '../config';
import { BIOME_IDS, type BiomeId, type HexPlan, type Obstacle, type Vec } from '../core/types';
import { featurePassable, obstaclePassable, surfaceEffect } from '../logic/rules';
import { traitsOf } from '../logic/traits';
import { COVERAGE_KIND, offRoadCoverage } from './coverage';
import { isPathLog, touchesPath } from './errandSites';
import { circleBounds, inPolygon, polygonDistanceSquared, SpatialGrid } from './geometry';
import { hexKey } from './hex';
import { hexInset } from './layout';
import { roadHub, roadOverlap } from './roads';
import { prepareGround, prepareSurface } from './surface';
import { WorldGen } from './world';

const COVERAGE: Record<BiomeId, readonly [number, number]> = {
  meadow: [0.015, 0.14], mud: [0.28, 0.47], rocky: [0.04, 0.115], lake: [0.34, 0.49], darkwood: [0.20, 0.43],
  snow: [0.29, 0.48], desert: [0.075, 0.22], jungle: [0.45, 0.66], canyon: [0.15, 0.30], geyser: [0.12, 0.27],
};

const SEEDS = [1, 3, 7, 29, 71, 99, 701, 5288, 5981, 8128];

function* samplePlans() {
  for (const seed of SEEDS) {
    const world = new WorldGen(seed);
    for (const coord of world.hexesNear(0, 0, 6)) yield { seed, world, plan: world.plan(coord) };
  }
}

function destinations(plan: HexPlan, canSwim = true): Vec[] {
  return [
    ...plan.activities.flatMap(site => [site.at,
      ...(!canSwim && site.kind === 'islandSwim' ? [] : site.targets.map(target => target.at))]),
    ...plan.items.map(item => item.at),
    ...[plan.giver, plan.home, plan.treasure].flatMap(spot => spot ? [spot.at] : []),
  ];
}

function unreachable(world: WorldGen, plan: HexPlan, canSwim = false): Vec[] {
  const traits = traitsOf({ workshop: 'race', model: defaultModel(CATALOGS.race) });
  if (canSwim) traits.water = 2;
  // Reachability inside a restricted hex is measured with the entry ability equipped.
  if (plan.biome === 'darkwood') traits.light = 3;
  if (plan.biome === 'desert') traits.heat = 3;
  const goals = [...destinations(plan, canSwim),
    ...plan.features.flatMap(feature => feature.bypassAt ? [feature.bypassAt] : [])];
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
  if (!reachable(hub.x, hub.y)) return goals;
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

  return goals.filter(at => {
    const gx = Math.round((at.x - hub.x) / step), gy = Math.round((at.y - hub.y) / step);
    for (let y = gy - 1; y <= gy + 1; y++) {
      for (let x = gx - 1; x <= gx + 1; x++) {
        if (seen[indexAt(x, y)] && connected(fromHub(x, y), at)) return false;
      }
    }
    return true;
  });
}

function decksOverlap(a: Vec[], b: Vec[]): boolean {
  const turn = (p: Vec, q: Vec, r: Vec) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return a.some(p => inPolygon(b, p.x, p.y)) || b.some(p => inPolygon(a, p.x, p.y))
    || a.some((p, i) => b.some((r, j) => {
      const q = a[(i + 1) % a.length], s = b[(j + 1) % b.length];
      return turn(p, q, r) * turn(p, q, s) < 0 && turn(r, s, p) * turn(r, s, q) < 0;
    }));
}

describe('world terrain richness', () => {
  it('keeps all ten biomes in their off-road coverage ranges with dense, clear scatter', () => {
    const seen = new Set<BiomeId>();
    for (const { seed, plan } of samplePlans()) {
      const { biome } = plan;
      const context = `${seed}:${hexKey(plan.coord)} (${biome})`;
      seen.add(biome);
      const [min, max] = COVERAGE[biome];
      const coverage = offRoadCoverage(plan)[COVERAGE_KIND[biome]];
      expect(coverage, context).toBeGreaterThanOrEqual(min);
      expect(coverage, context).toBeLessThanOrEqual(max);
      expect(plan.obstacles.length, context).toBeGreaterThanOrEqual(10);
      if (!plan.home) expect(plan.activities.length, context).toBeGreaterThanOrEqual(2);
      const points = destinations(plan);
      const bridges = plan.features.filter(feature => feature.kind === 'bridge');
      for (let i = 0; i < bridges.length; i++) {
        expect(bridges[i].area.every(at => hexInset(plan.center, at) > 0), context).toBe(true);
        for (const other of bridges.slice(i + 1)) expect(decksOverlap(bridges[i].area, other.area), context).toBe(false);
      }
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
        if (isPathLog(obstacle)) {
          expect(touchesPath(plan, obstacle), obstacle.id).toBe(true);
          expect(plan.roads.some(road => roadOverlap(road, obstacle.at, road.kind === 'path'
            ? obstacle.radius + Math.max(...WORLD_DRIVE.colliderRadius) - road.width / 2 : clearance)), obstacle.id).toBe(false);
        } else {
          expect(plan.roads.some(road => roadOverlap(road, obstacle.at, clearance)), obstacle.id).toBe(false);
        }
        expect(points.every(at => Math.hypot(at.x - obstacle.at.x, at.y - obstacle.at.y) >= clearance), obstacle.id)
          .toBe(true);
      }
      if (biome === 'darkwood') {
        expect(prepareSurface(plan)(plan.center.x, plan.center.y).dark, context).toBeGreaterThanOrEqual(0.6);
        expect(plan.features.some(feature => feature.kind === 'cave'), context).toBe(true);
      }
      if (biome === 'lake') {
        expect(bridges, context).toHaveLength(2);
        expect(plan.terrain.filter(blob => blob.kind === 'deep'), context).toHaveLength(2);
        expect(plan.activities.some(site => site.kind === 'islandSwim'), context).toBe(true);
        expect(plan.activities.length, context).toBeGreaterThanOrEqual(2);
        expect(plan.items.length, context).toBeGreaterThanOrEqual(2);
      }
      if (biome === 'canyon') {
        const walls = plan.terrain.filter(blob => blob.kind === 'cliff' && blob.poly.length >= 24);
        expect(walls, context).toHaveLength(5);
        const ground = prepareGround(plan);
        let cliff = 0, total = 0;
        for (let y = -WORLD.hexSize + 30; y < WORLD.hexSize; y += 60) {
          for (let x = -WORLD.hexSize + 30; x < WORLD.hexSize; x += 60) {
            const at = { x: plan.center.x + x, y: plan.center.y + y };
            if (hexInset(plan.center, at) <= 0) continue;
            total++;
            if (ground(at.x, at.y).kind === 'cliff') cliff++;
          }
        }
        expect(cliff / total, context).toBeGreaterThanOrEqual(0.15);
        expect(cliff / total, context).toBeLessThanOrEqual(0.30);
        expect(plan.features.some(feature => feature.kind === 'narrow' && feature.bypass), context).toBe(true);
        expect(plan.features.some(feature => feature.kind === 'jump' && feature.bypass), context).toBe(true);
      }
      if (biome === 'geyser') {
        const vents = plan.obstacles.filter(obstacle => obstacle.kind === 'vent');
        const ground = prepareGround(plan);
        expect(vents.length, context).toBeGreaterThanOrEqual(3);
        expect(vents.every(vent => vent.effect === 'pass' && ground(vent.at.x, vent.at.y).kind === 'hotSpring')).toBe(true);
      }
    }
    expect(seen).toEqual(new Set(BIOME_IDS));
  }, 15_000);

  it('connects sites, pickups, homes and bypasses to the hub with the terrain entry abilities', () => {
    for (const seed of [29, 71, 8128]) {
      const world = new WorldGen(seed, ['player']);
      for (const coord of world.hexesNear(0, 0, 4)) {
        const plan = world.plan(coord);
        expect(unreachable(world, plan), `${seed}:${hexKey(coord)} (${plan.biome})`).toEqual([]);
        if (plan.biome === 'lake') expect(unreachable(world, plan, true), `${seed}:${hexKey(coord)} swim`).toEqual([]);
      }
    }
  }, 15_000);

  it('places frogs in both wet biomes and gives each camp a bell off the road', () => {
    const world = new WorldGen(29);
    const frogBiomes = new Set<BiomeId>();
    for (const coord of world.hexesNear(0, 0, 5)) {
      const plan = world.plan(coord);
      if (plan.home) expect(plan.errands?.some(spot => spot.id.endsWith(':campBell'))).toBe(true);
      for (const spot of plan.errands ?? []) {
        expect(plan.roads.some(road => roadOverlap(road, spot.at)), spot.id).toBe(false);
        if (spot.kind !== 'frog') continue;
        frogBiomes.add(plan.biome);
        expect(world.surfaceAt(spot.at.x, spot.at.y).kind).toBe(plan.biome === 'lake' ? 'shallow' : 'mud');
      }
    }
    expect(frogBiomes).toEqual(new Set(['lake', 'mud']));
  });

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

  it('samples 10,000 random points from warm plans in under 70 ms', () => {
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
    expect(elapsed, `10,000 surface samples took ${elapsed.toFixed(1)} ms`).toBeLessThan(70);
  });
});
