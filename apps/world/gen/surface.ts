import type { BiomeId, HexPlan, Obstacle, RoadPath, SurfaceKind, SurfaceSample } from '../core/types';
import type { RoadSurfaceSample } from '../logic/rules';
import { boundsOf, circleBounds, inBounds, inPolygon, segmentDistanceSquared, SpatialGrid } from './geometry';
import { WorldGen } from './world';

const DEFAULT_KIND: Record<BiomeId, SurfaceKind> = {
  meadow: 'grass', mud: 'mud', rocky: 'rough', lake: 'grass', darkwood: 'grass',
  snow: 'snow', desert: 'sand', jungle: 'grass', canyon: 'rough', geyser: 'rough',
};

/** Ambient surface where there is no terrain polygon. */
export function biomeDefault(biome: BiomeId): SurfaceSample {
  return { kind: DEFAULT_KIND[biome], biome, dark: biome === 'darkwood' ? 0.65 : 0, covered: false };
}

export function prepareGround(plan: HexPlan): (x: number, y: number) => SurfaceSample {
  const blobs = new SpatialGrid<{ blob: HexPlan['terrain'][number]; bounds: ReturnType<typeof boundsOf> }>();
  for (const blob of plan.terrain) {
    const bounds = boundsOf(blob.poly);
    blobs.insert(bounds, { blob, bounds });
  }
  return (x, y) => {
    const sample = biomeDefault(plan.biome);
    const cell = blobs.at(x, y);
    for (let i = cell.length - 1; i >= 0; i--) {
      const { blob, bounds } = cell[i];
      if (!inBounds(bounds, x, y) || !inPolygon(blob.poly, x, y)) continue;
      sample.kind = blob.kind;
      sample.dark = blob.dark ?? sample.dark;
      sample.covered = blob.covered ?? false;
      break;
    }
    return sample;
  };
}

export function prepareObstacles(obstacles: readonly Obstacle[]): SpatialGrid<Obstacle> {
  const grid = new SpatialGrid<Obstacle>();
  for (const obstacle of obstacles) {
    grid.insert(circleBounds(obstacle.at.x, obstacle.at.y, obstacle.radius), obstacle);
  }
  return grid;
}

/** Build a reusable, pre-indexed surface sampler for one immutable hex plan. */
export function prepareSurface(plan: HexPlan): (x: number, y: number) => RoadSurfaceSample {
  const groundAt = prepareGround(plan);
  const segments = new SpatialGrid<{
    a: RoadPath['points'][number]; b: RoadPath['points'][number];
    kind: RoadPath['kind']; surface: RoadPath['surface']; limit: number; bounds: ReturnType<typeof boundsOf>;
  }>();
  for (const road of plan.roads) {
    const radius = road.width / 2;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const bounds = {
        minX: Math.min(a.x, b.x) - radius, minY: Math.min(a.y, b.y) - radius,
        maxX: Math.max(a.x, b.x) + radius, maxY: Math.max(a.y, b.y) + radius,
      };
      segments.insert(bounds, { a, b, bounds, kind: road.kind, surface: road.surface, limit: radius * radius });
    }
  }
  const bridges = new SpatialGrid<{ area: HexPlan['features'][number]['area']; bounds: ReturnType<typeof boundsOf> }>();
  for (const { kind, area } of plan.features) {
    if (kind !== 'bridge') continue;
    const bounds = boundsOf(area);
    bridges.insert(bounds, { area, bounds });
  }

  return (x, y) => {
    const sample: RoadSurfaceSample = groundAt(x, y);
    for (const { area, bounds } of bridges.at(x, y)) {
      if (inBounds(bounds, x, y) && inPolygon(area, x, y)) {
        sample.kind = 'bridge';
        return sample;
      }
    }
    // Route paint cannot turn a cliff or unbridged deep water into drivable ground.
    if (sample.kind === 'cliff' || sample.kind === 'deep') return sample;
    for (const { a, b, kind, surface, bounds, limit } of segments.at(x, y)) {
      if (inBounds(bounds, x, y) && segmentDistanceSquared(x, y, a, b) <= limit) {
        sample.kind = kind;
        sample.roadSurface = surface ?? (kind === 'road' ? 'paved' : undefined);
        if (surface === 'rocky') sample.roadRoughness = (1 + Math.sin(x / 15 + y / 19)) / 2;
        break;
      }
    }
    return sample;
  };
}

// Keep only a few seed worlds alive; each instance owns all bounded plan and sampler LRUs.
const WORLD_CACHE_LIMIT = 3;
const worlds = new Map<number, WorldGen>();

function worldFor(seed: number): WorldGen {
  let world = worlds.get(seed);
  if (world) worlds.delete(seed);
  else world = new WorldGen(seed);
  worlds.set(seed, world);
  if (worlds.size > WORLD_CACHE_LIMIT) worlds.delete(worlds.keys().next().value!);
  return world;
}

/** Sample the deterministic world surface through a bounded, reused world generator. */
export function surfaceAt(seed: number, x: number, y: number): RoadSurfaceSample {
  return worldFor(seed).surfaceAt(x, y);
}
