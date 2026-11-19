import { TILE_SIZE, WORLD } from '../../config/gameConfig';
import type { Rng } from '../../core/rng';
import { DIRS, dirAngle, straightAxis, type Grid } from './grid';
import { offX, offY } from './lanes';

export interface Spawn { x: number; y: number; angle: number }

/** Pass 4: two cars in tandem on a seeded choice of straight roads near the map center. */
export function generateSpawns(rng: Rng, g: Grid): Spawn[] {
  const cx = g.w / 2 - 0.5, cy = g.h / 2 - 0.5;
  const candidates: { x: number; y: number; axis: 'h' | 'v'; distance: number }[] = [];
  let nearest = Infinity;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const axis = straightAxis(g, x, y);
      if (!axis) continue;
      const { dx, dy } = DIRS[axis === 'h' ? 0 : 1];
      if (straightAxis(g, x - dx, y - dy) !== axis || straightAxis(g, x + dx, y + dy) !== axis) continue;
      const distance = Math.hypot(x - cx, y - cy);
      nearest = Math.min(nearest, distance);
      candidates.push({ x, y, axis, distance });
    }
  }
  if (!candidates.length) throw new Error('cityGen: no straight road near center for spawns');
  const { x, y, axis } = rng.pick(candidates.filter((c) => c.distance <= nearest + WORLD.spawnRoadSearchTiles));
  const direction = (axis === 'h' ? 0 : 1) + (rng.chance(0.5) ? 2 : 0);
  const { dx, dy } = DIRS[direction];
  const px = (x + 0.5) * TILE_SIZE + offX(direction);
  const py = (y + 0.5) * TILE_SIZE + offY(direction);
  const halfSpacing = WORLD.spawnSpacingPx / 2;
  return [halfSpacing, -halfSpacing].map((along) => ({
    x: px + dx * along,
    y: py + dy * along,
    angle: dirAngle(direction),
  }));
}
