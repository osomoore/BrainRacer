import type { BiomeId, HexPlan, RoadPath, SurfaceKind, SurfaceSample, TerrainBlob, Vec } from '../core/types';
import { WorldGen } from './world';

const DEFAULT_KIND: Record<BiomeId, SurfaceKind> = {
  meadow: 'grass', mud: 'mud', rocky: 'rough', lake: 'shallow', darkwood: 'grass',
  snow: 'snow', desert: 'sand', jungle: 'tallGrass', canyon: 'rough', geyser: 'rough',
};

/** Ambient, non-feature surface for a biome; exported for map coloring and previews. */
export function biomeDefault(biome: BiomeId): SurfaceSample {
  return { kind: DEFAULT_KIND[biome], biome, dark: biome === 'darkwood' ? 0.55 : 0, covered: false };
}

interface IndexedBlob { blob: TerrainBlob; bounds: Bounds }
interface IndexedRoad { kind: RoadPath['kind']; width: number; bounds: Bounds; segments: { a: Vec; b: Vec; bounds: Bounds }[] }
interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

function boundsOf(points: Vec[]): Bounds {
  return {
    minX: Math.min(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)), maxY: Math.max(...points.map((p) => p.y)),
  };
}

function inBounds(bounds: Bounds, x: number, y: number): boolean {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

function inPolygon(points: Vec[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function segmentDistanceSquared(point: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2));
  const px = point.x - (a.x + t * dx);
  const py = point.y - (a.y + t * dy);
  return px * px + py * py;
}

function indexRoad(path: RoadPath): IndexedRoad {
  const segments = [] as IndexedRoad['segments'];
  for (let i = 1; i < path.points.length; i += 1) {
    const a = path.points[i - 1];
    const b = path.points[i];
    segments.push({ a, b, bounds: {
      minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y),
      maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y),
    } });
  }
  return { kind: path.kind, width: path.width, bounds: boundsOf(path.points), segments };
}

function indexedPathContains(path: IndexedRoad, x: number, y: number): boolean {
  const threshold = path.width / 2;
  if (x < path.bounds.minX - threshold || x > path.bounds.maxX + threshold
    || y < path.bounds.minY - threshold || y > path.bounds.maxY + threshold) return false;
  const limit = threshold * threshold;
  for (const segment of path.segments) {
    if (x < segment.bounds.minX - threshold || x > segment.bounds.maxX + threshold
      || y < segment.bounds.minY - threshold || y > segment.bounds.maxY + threshold) continue;
    if (segmentDistanceSquared({ x, y }, segment.a, segment.b) <= limit) return true;
  }
  return false;
}

/** Build a reusable, pre-indexed surface sampler for one immutable hex plan. */
export function prepareSurface(plan: HexPlan): (x: number, y: number) => SurfaceSample {
  const blobs: IndexedBlob[] = plan.terrain.map((blob) => ({ blob, bounds: boundsOf(blob.poly) }));
  const roads = plan.roads.map(indexRoad);
  const bridges = plan.features
    .filter((feature) => feature.kind === 'bridge')
    .map((feature) => ({ area: feature.area, bounds: boundsOf(feature.area) }));
  return (x: number, y: number): SurfaceSample => {
    const sample = biomeDefault(plan.biome);
    let blob: TerrainBlob | undefined;
    for (let i = blobs.length - 1; i >= 0; i -= 1) {
      const candidate = blobs[i];
      if (inBounds(candidate.bounds, x, y) && inPolygon(candidate.blob.poly, x, y)) {
        blob = candidate.blob;
        sample.kind = blob.kind;
        if (blob.dark !== undefined) sample.dark = blob.dark;
        if (blob.covered !== undefined) sample.covered = blob.covered;
        break;
      }
    }

    const onBridge = bridges.some((bridge) => inBounds(bridge.bounds, x, y) && inPolygon(bridge.area, x, y));
    if (onBridge) sample.kind = 'bridge';
    else {
      const road = roads.find((candidate) => indexedPathContains(candidate, x, y));
      if (road) sample.kind = road.kind;
    }
    return sample;
  };
}

// Keep only a few seed worlds alive; each instance owns all bounded plan and sampler LRUs.
const WORLD_CACHE_LIMIT = 3;
const worlds = new Map<number, WorldGen>();

function worldFor(seed: number): WorldGen {
  let world = worlds.get(seed);
  if (!world) {
    world = new WorldGen(seed);
    worlds.set(seed, world);
    if (worlds.size > WORLD_CACHE_LIMIT) worlds.delete(worlds.keys().next().value as number);
  } else {
    worlds.delete(seed);
    worlds.set(seed, world);
  }
  return world;
}

/** Sample the deterministic world surface through a bounded, reused world generator. */
export function surfaceAt(seed: number, x: number, y: number): SurfaceSample {
  return worldFor(seed).surfaceAt(x, y);
}
