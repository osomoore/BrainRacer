import { Rng } from '../../workshop/core/rng';
import { GEN } from '../config';
import type { HexCoord, HexPlan, SurfaceSample } from '../core/types';
import { biomeAt, homeHexFor, isCamp } from './biome';
import { buildFeatures } from './features';
import { hexKey, hexToWorld, ring, worldToHex } from './hex';
import { HexLayout } from './layout';
import { hash } from './random';
import { buildRoads, linkedEdges } from './roads';
import { buildActivities, buildPickups } from './sites';
import { prepareSurface } from './surface';
import { buildTerrain } from './terrain';

export function generateHex(seed: number, coord: HexCoord): HexPlan {
  return buildPlan(seed, coord);
}

function buildPlan(seed: number, coord: HexCoord, owner?: string): HexPlan {
  const center = hexToWorld(coord);
  const hexSeed = hash(seed, 'hex', coord.q, coord.r);
  const rng = new Rng(hexSeed);
  const links = linkedEdges(seed, coord);
  const home = owner !== undefined || isCamp(seed, coord);
  const plan: HexPlan = {
    coord: { ...coord }, seed: hexSeed, center, biome: home ? 'meadow' : biomeAt(seed, coord),
    links, roads: buildRoads(seed, coord, links), terrain: [], features: [], obstacles: [], activities: [], items: [],
  };
  const layout = new HexLayout(plan);
  if (home) {
    plan.home = { id: `${hexKey(coord)}:home`, at: { ...center }, ...(owner !== undefined ? { owner } : {}) };
    layout.reserve(center, 180);
  }
  const featureSite = buildFeatures(layout, rng.fork(1));
  buildActivities(layout, rng.fork(2), featureSite);
  buildPickups(layout, rng.fork(3));
  buildTerrain(layout, rng.fork(4));
  return plan;
}

interface CachedHex {
  plan: HexPlan;
  sample?: (x: number, y: number) => SurfaceSample;
}

export class WorldGen {
  private readonly homes = new Map<string, HexCoord>();
  private readonly owners = new Map<string, string>();
  private readonly cache = new Map<string, CachedHex>();

  /** Pass the same roster on every device so profile-home collisions resolve in the same order. */
  constructor(readonly seed: number, profileIds: readonly string[] = []) {
    const occupied: HexCoord[] = [];
    for (const profileId of [...new Set(profileIds)].sort()) {
      const coord = homeHexFor(seed, profileId, occupied);
      const key = hexKey(coord);
      this.homes.set(profileId, coord);
      if (!this.owners.has(key)) this.owners.set(key, profileId);
      occupied.push(coord);
    }
  }

  homeFor(profileId: string): HexCoord | undefined {
    const coord = this.homes.get(profileId);
    return coord && { ...coord };
  }

  plan(coord: HexCoord): HexPlan {
    return this.cachedHex(coord).plan;
  }

  surfaceAt(x: number, y: number): SurfaceSample {
    const entry = this.cachedHex(worldToHex(x, y));
    entry.sample ??= prepareSurface(entry.plan);
    return entry.sample(x, y);
  }

  /** The containing hex followed by concentric rings, each in the order defined in hex.ts. */
  hexesNear(x: number, y: number, rings: number): HexCoord[] {
    const center = worldToHex(x, y);
    const coords = [center];
    for (let radius = 1; radius <= rings; radius++) coords.push(...ring(center, radius));
    return coords;
  }

  private cachedHex(coord: HexCoord): CachedHex {
    const key = hexKey(coord);
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    const entry = { plan: buildPlan(this.seed, coord, this.owners.get(key)) };
    this.cache.set(key, entry);
    if (this.cache.size > GEN.planCacheSize) {
      const oldest = this.cache.keys().next().value!;
      this.cache.delete(oldest);
    }
    return entry;
  }
}
