import { Rng } from '../../workshop/core/rng';
import { GEN } from '../config';
import type { HexCoord, HexPlan, Obstacle, SurfaceSample } from '../core/types';
import { biomeAt, homeHexFor, isCamp } from './biome';
import { buildFeatures } from './features';
import { circleBounds } from './geometry';
import { hexKey, hexToWorld, ring, worldToHex } from './hex';
import { buildLakeIsland, buildWaterCrossings } from './lakes';
import { HexLayout } from './layout';
import { hash } from './random';
import { buildRoads, curvedPath, linkedEdges, roadHub } from './roads';
import { buildActivities, buildPickups } from './sites';
import { prepareGround, prepareObstacles, prepareSurface } from './surface';
import { buildTerrain, scatterObstacles } from './terrain';

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
  const hub = roadHub(seed, coord);
  const layout = new HexLayout(plan, hub);
  if (home) {
    plan.home = { id: `${hexKey(coord)}:home`, at: { ...center }, ...(owner !== undefined ? { owner } : {}) };
    layout.reserve(center, 180);
    plan.roads.push(curvedPath(hub, center, 1));
  }
  const featureRng = rng.fork(1);
  const activityRng = rng.fork(2);
  const pickupRng = rng.fork(3);
  buildTerrain(layout, rng.fork(4));
  const featureSite = plan.biome === 'lake' ? buildLakeIsland(layout, featureRng) : buildFeatures(layout, featureRng);
  const obstacleRng = rng.fork(5);
  buildWaterCrossings(plan, rng.fork(6));
  // Site connections may join a bridge, but may not cross terrain outside the public road network.
  const groundAt = prepareGround(plan);
  const publicNetwork = { ...plan, roads: plan.roads.filter(road => road.kind === 'road') };
  layout.setTerrain(groundAt, plan.biome === 'lake' ? prepareSurface(publicNetwork) : groundAt);
  buildActivities(layout, activityRng, featureSite);
  buildPickups(layout, pickupRng);
  scatterObstacles(layout, obstacleRng);
  return plan;
}

interface CachedHex {
  plan: HexPlan;
  sample?: (x: number, y: number) => SurfaceSample;
  obstacles?: ReturnType<typeof prepareObstacles>;
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

  /** Static obstacle candidates in one plan. The host still owns moved or removed obstacle state. */
  obstaclesNear(coord: HexCoord, x: number, y: number, radius: number): Obstacle[] {
    const entry = this.cachedHex(coord);
    entry.obstacles ??= prepareObstacles(entry.plan.obstacles);
    const matches: Obstacle[] = [];
    for (const obstacle of entry.obstacles.within(circleBounds(x, y, radius))) {
      if ((obstacle.at.x - x) ** 2 + (obstacle.at.y - y) ** 2 <= (obstacle.radius + radius) ** 2) matches.push(obstacle);
    }
    return matches;
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
