import type { Vec2, WorldData } from '../core/types';
import { isDrivable, isDrivableTile } from './geometry';

const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
const LOOKAHEAD_TILES = 5;

/** Check clearance along a straight route, including the turns at the edges of platforms. */
function clearRoute(world: WorldData, from: Vec2, to: Vec2): boolean {
  const dx = to.x - from.x, dy = to.y - from.y;
  const steps = Math.ceil(Math.hypot(dx, dy) / (world.tileSize / 4));
  const pad = world.tileSize / 5;
  for (let n = 1; n <= steps; n++) {
    const x = from.x + dx * n / steps, y = from.y + dy * n / steps;
    if (!isDrivable(world, x - pad, y) || !isDrivable(world, x + pad, y)
      || !isDrivable(world, x, y - pad) || !isDrivable(world, x, y + pad)) return false;
  }
  return true;
}

/** One shared route field per goal, used by both players. Rebuild after a moving span changes. */
export function guideRoute(world: WorldData, goal: Vec2): (car: Vec2) => Vec2 {
  const { widthTiles: w, heightTiles: h, tileSize: size, tiles } = world;
  const indexAt = (p: Vec2) => {
    const x = Math.floor(p.x / size), y = Math.floor(p.y / size);
    return x >= 0 && y >= 0 && x < w && y < h ? y * w + x : -1;
  };
  const goalIndex = indexAt(goal);
  if (!isDrivableTile(tiles[goalIndex])) return () => goal;
  const predecessor = new Int32Array(tiles.length).fill(-1);
  const queue = new Int32Array(tiles.length);
  queue[0] = goalIndex;
  predecessor[goalIndex] = goalIndex;
  for (let head = 0, tail = 1; head < tail; head++) {
    const i = queue[head], x = i % w, y = Math.floor(i / w);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (predecessor[j] >= 0 || !isDrivableTile(tiles[j])) continue;
      predecessor[j] = i;
      queue[tail++] = j;
    }
  }

  return car => {
    if (Math.hypot(goal.x - car.x, goal.y - car.y) < size * LOOKAHEAD_TILES && clearRoute(world, car, goal)) return goal;
    let tile = indexAt(car);
    if (tile < 0 || predecessor[tile] < 0 || tile === goalIndex) return goal;
    let toward: Vec2 | undefined;
    for (let step = 0; step < LOOKAHEAD_TILES && tile !== goalIndex; step++) {
      tile = predecessor[tile];
      const waypoint = { x: (tile % w + 0.5) * size, y: (Math.floor(tile / w) + 0.5) * size };
      if (toward && !clearRoute(world, car, waypoint)) break;
      toward = waypoint;
    }
    return toward ?? goal;
  };
}
