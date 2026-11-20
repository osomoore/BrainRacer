import type { Vec2, WorldData } from '../core/types';
import { isDrivableTile } from '../world/geometry';

/** Four-way shortest path through drivable tiles. Null means the target is unreachable. */
export function bombPath(world: WorldData, from: Vec2, to: Vec2): Vec2[] | null {
  const { widthTiles: w, heightTiles: h, tileSize: s, tiles } = world;
  const index = (p: Vec2) => Math.floor(p.y / s) * w + Math.floor(p.x / s);
  const inside = (p: Vec2) => p.x >= 0 && p.y >= 0 && p.x < w * s && p.y < h * s;
  if (!inside(from) || !inside(to)) return null;
  const start = index(from), goal = index(to);
  if (!isDrivableTile(tiles[start]) || !isDrivableTile(tiles[goal])) return null;
  const prev = new Int32Array(w * h).fill(-1), queue = new Int32Array(w * h);
  let head = 0, tail = 0; queue[tail++] = start; prev[start] = start;
  while (head < tail && prev[goal] === -1) {
    const cur = queue[head++], x = cur % w, y = Math.floor(cur / w);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || prev[n] !== -1 || !isDrivableTile(tiles[n])) continue;
      prev[n] = cur; queue[tail++] = n;
    }
  }
  if (prev[goal] === -1) return null;
  const path: Vec2[] = [];
  for (let n = goal; n !== start; n = prev[n]) path.push({ x: (n % w + 0.5) * s, y: (Math.floor(n / w) + 0.5) * s });
  return path.reverse();
}

export function nearestBombTarget<T extends Vec2>(position: Vec2, targets: readonly T[]): T | undefined {
  let best: T | undefined, distance = Infinity;
  for (const target of targets) {
    const d = (position.x - target.x) ** 2 + (position.y - target.y) ** 2;
    if (d < distance) { best = target; distance = d; }
  }
  return best;
}
