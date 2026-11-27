import { WORLD, WORLD_ACTIVITIES } from '../../config';
import type { WorldPlayer, WorldQuery } from '../../core/runtime';
import type { ActivityKind, ActivitySite, Vec } from '../../core/types';
import { hexToWorld, ring } from '../../gen/hex';

export function nearestActivity(world: WorldQuery, origin: Vec, kind: ActivityKind): ActivitySite | undefined {
  const center = world.hexAt(origin.x, origin.y);
  const midpoint = hexToWorld(center);
  const offset = Math.hypot(midpoint.x - origin.x, midpoint.y - origin.y);
  let nearest: ActivitySite | undefined;
  let bestDistance = Infinity;
  for (let radius = 0; radius <= WORLD_ACTIVITIES.quickSearchRings; radius++) {
    for (const coord of ring(center, radius)) {
      for (const site of world.plan(coord).activities) {
        if (site.kind !== kind) continue;
        const distance = Math.hypot(site.at.x - origin.x, site.at.y - origin.y);
        if (distance >= bestDistance) continue;
        nearest = site;
        bestDistance = distance;
      }
    }
    // Axial ring n has center distance at least 1.5 * n * hexSize. Sites lie within one hex radius.
    if (bestDistance <= (1.5 * (radius + 1) - 1) * WORLD.hexSize - offset) break;
  }
  return nearest;
}

export function placeAtActivity(world: WorldQuery, player: WorldPlayer, site: ActivitySite): void {
  const target = site.targets[0]?.at ?? site.at;
  const angle = Math.atan2(target.y - site.at.y, target.x - site.at.x);
  const inset = site.radius * WORLD_ACTIVITIES.quickSpawnInset;
  const x = site.at.x - inset * Math.cos(angle);
  const y = site.at.y - inset * Math.sin(angle);
  Object.assign(player.move, { x, y, angle, vx: 0, vy: 0, airborne: 0, jump: undefined });
  player.hex = world.hexAt(x, y);
  player.surface = world.surfaceAt(x, y);
}
