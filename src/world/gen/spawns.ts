import { TILE_SIZE } from '../../config/gameConfig';
import { straightAxis, type Grid } from './grid';

export interface Spawn { x: number; y: number; angle: number }

/**
 * Pass 4: two cars side by side (one per lane, both facing the same way along the road)
 * on the straight road tile nearest the map center.
 */
export function generateSpawns(g: Grid): Spawn[] {
  const cx = g.w / 2 - 0.5, cy = g.h / 2 - 0.5;
  let best: { x: number; y: number; axis: 'h' | 'v' } | null = null, bestD = Infinity;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const axis = straightAxis(g, x, y);
      if (!axis) continue;
      const a = axis === 'h' ? [x - 1, y, x + 1, y] : [x, y - 1, x, y + 1];
      if (straightAxis(g, a[0], a[1]) !== axis || straightAxis(g, a[2], a[3]) !== axis) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestD) { bestD = d; best = { x, y, axis }; }
    }
  }
  if (!best) throw new Error('cityGen: no straight road near center for spawns');
  const px = (best.x + 0.5) * TILE_SIZE, py = (best.y + 0.5) * TILE_SIZE, q = TILE_SIZE / 4;
  return best.axis === 'h'
    ? [{ x: px, y: py + q, angle: 0 }, { x: px, y: py - q, angle: 0 }]
    : [{ x: px - q, y: py, angle: Math.PI / 2 }, { x: px + q, y: py, angle: Math.PI / 2 }];
}
