import { WORLD } from '../config';
import type { HexLive, WorldPlayer, WorldQuery } from '../core/runtime';
import type { Feature, HexCoord } from '../core/types';
import { hexKey, worldToHex } from '../gen/hex';
import type { WorldGen } from '../gen/world';

type LiveObstacle = HexLive['obstacles'] extends Map<string, infer Value> ? Value : never;
type Bounds = { left: number; right: number; top: number; bottom: number };

export function nearbyHexes(world: WorldQuery, players: readonly WorldPlayer[], rings: number): Map<string, HexCoord> {
  const coords = new Map<string, HexCoord>();
  for (const { move } of players) {
    for (const coord of world.hexesNear(move.x, move.y, rings)) coords.set(hexKey(coord), coord);
  }
  return coords;
}

export class LiveWorld implements WorldQuery {
  private readonly loaded = new Map<string, HexLive>();
  private readonly changes = new Map<string, { obstacles: LiveObstacle[]; takenItems: Set<string> }>();
  private readonly owners = new WeakMap<LiveObstacle, HexCoord>();
  private readonly bounds = new WeakMap<Feature, Bounds>();
  private kept = new Map<string, HexCoord>();
  private lastCenters = '';

  constructor(private readonly gen: WorldGen) {}

  get seed(): number { return this.gen.seed; }
  hexAt = worldToHex;
  homeFor(profileId: string) { return this.gen.homeFor(profileId); }
  plan(coord: HexCoord) { return this.gen.plan(coord); }
  surfaceAt(x: number, y: number) { return this.gen.surfaceAt(x, y); }
  hexesNear(x: number, y: number, rings: number) { return this.gen.hexesNear(x, y, rings); }

  live(coord: HexCoord): HexLive {
    const key = hexKey(coord);
    const loaded = this.loaded.get(key);
    if (loaded) return loaded;
    const plan = this.plan(coord);
    const changed = this.changes.get(key);
    const obstacles = new Map(plan.obstacles.map(obstacle => [obstacle.id, { ...obstacle, at: { ...obstacle.at } }]));
    for (const obstacle of changed?.obstacles ?? []) obstacles.set(obstacle.id, obstacle);
    for (const obstacle of obstacles.values()) this.owners.set(obstacle, plan.coord);
    const live = { plan, obstacles, takenItems: changed?.takenItems ?? new Set<string>() };
    this.loaded.set(key, live);
    this.changes.delete(key);
    return live;
  }

  ownerOf(obstacle: LiveObstacle): HexCoord | undefined {
    return this.owners.get(obstacle);
  }

  nearbySolids(x: number, y: number, radius: number) {
    const obstacles: LiveObstacle[] = [];
    const features: Feature[] = [];
    const rings = 1 + Math.floor(2 * radius / (3 * WORLD.hexSize));
    for (const coord of this.hexesNear(x, y, rings)) {
      const live = this.live(coord);
      for (const obstacle of live.obstacles.values()) {
        const reach = radius + obstacle.radius;
        if (!obstacle.gone && (obstacle.at.x - x) ** 2 + (obstacle.at.y - y) ** 2 <= reach ** 2) {
          obstacles.push(obstacle);
        }
      }
      for (const feature of live.plan.features) {
        const { left, right, top, bottom } = this.footprint(feature);
        if (x + radius >= left && x - radius <= right && y + radius >= top && y - radius <= bottom) {
          features.push(feature);
        }
      }
    }
    return { obstacles, features };
  }

  prune(players: readonly WorldPlayer[]): void {
    const centers = players.map(player => hexKey(player.hex)).join('|');
    if (centers !== this.lastCenters) {
      this.kept = nearbyHexes(this, players, WORLD.keepRings);
      this.lastCenters = centers;
    }
    for (const [key, live] of this.loaded) {
      if (this.kept.has(key)) continue;
      const changed: LiveObstacle[] = [];
      for (const original of live.plan.obstacles) {
        const obstacle = live.obstacles.get(original.id);
        if (!obstacle) changed.push({ ...original, gone: true });
        else if (obstacle.gone || obstacle.at.x !== original.at.x || obstacle.at.y !== original.at.y) changed.push(obstacle);
      }
      if (changed.length || live.takenItems.size) {
        this.changes.set(key, { obstacles: changed, takenItems: live.takenItems });
      }
      this.loaded.delete(key);
    }
  }

  private footprint(feature: Feature): Bounds {
    let bounds = this.bounds.get(feature);
    if (!bounds) {
      bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
      for (const point of feature.area) {
        bounds.left = Math.min(bounds.left, point.x);
        bounds.right = Math.max(bounds.right, point.x);
        bounds.top = Math.min(bounds.top, point.y);
        bounds.bottom = Math.max(bounds.bottom, point.y);
      }
      this.bounds.set(feature, bounds);
    }
    return bounds;
  }
}
