import { WORLD_BUDDIES } from '../config';
import type { Obstacle, Vec } from '../core/types';

const C = WORLD_BUDDIES.follower;
type Leader = Vec & { angle: number };
type Clear = (at: Vec) => boolean;

/** Try the center of the trail first, then either rear corner when the center is against a wall. */
export function followBuddy(previous: Vec | undefined, leader: Leader, dt: number, clear: Clear): Vec | undefined {
  const targets = [0, -Math.PI / 3, Math.PI / 3].map(offset => ({
    x: leader.x - Math.cos(leader.angle + offset) * C.distance,
    y: leader.y - Math.sin(leader.angle + offset) * C.distance,
  }));
  if (!previous || Math.hypot(previous.x - leader.x, previous.y - leader.y) > C.catchUpDistance || !clear(previous)) {
    return targets.find(clear);
  }
  const blend = 1 - Math.exp(-dt / C.smoothingSeconds);
  let moved: Vec | undefined;
  for (const target of targets) {
    if (!clear(target)) continue;
    const dx = (target.x - previous.x) * blend, dy = (target.y - previous.y) * blend;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / C.probeStride));
    let at: Vec = previous;
    let i = 1;
    for (; i <= steps; i++) {
      const next = { x: previous.x + dx * i / steps, y: previous.y + dy * i / steps };
      if (!clear(next)) break;
      at = next;
    }
    if (i > steps) return at;
    if (at !== previous) moved ??= at;
  }
  return moved ?? previous;
}

/** Props affect the visual hop only. There is no buddy collider in World. */
export function buddyHop(at: Vec, obstacles: readonly Obstacle[]): number {
  let lift = 0;
  for (const obstacle of obstacles) {
    const edge = Math.hypot(at.x - obstacle.at.x, at.y - obstacle.at.y) - obstacle.radius;
    const t = Math.min(1, Math.max(0, 1 - edge / C.hopMargin));
    lift = Math.max(lift, t * t * (3 - 2 * t) * C.hopHeight);
  }
  return lift;
}

