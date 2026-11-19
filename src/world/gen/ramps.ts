import type { Rng } from '../../core/rng';
import { TILE_SIZE, WORLD } from '../../config/gameConfig';
import type { Ramp } from '../../core/types';
import { straightAxis, type Grid } from './grid';
import type { Spawn } from './spawns';

/**
 * Pass 5: ramps sit centered on the road tile (middle of the road, 96 px across the 128 px road),
 * on a straight run (>= 2 straight tiles before and after), >= rampSpacingTiles apart.
 */
export function generateRamps(rng: Rng, g: Grid, spawns: Spawn[]): Ramp[] {
  const cands: { x: number; y: number; axis: 'h' | 'v' }[] = [];
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const axis = straightAxis(g, x, y);
      if (!axis) continue;
      const ok = [-2, -1, 1, 2].every((k) => straightAxis(g, axis === 'h' ? x + k : x, axis === 'h' ? y : y + k) === axis);
      if (ok) cands.push({ x, y, axis });
    }
  }
  const sp = spawns[0];
  const picked: typeof cands = [];
  for (const c of rng.shuffle(cands)) {
    if (picked.length >= WORLD.rampCount) break;
    if (Math.hypot(c.x + 0.5 - sp.x / TILE_SIZE, c.y + 0.5 - sp.y / TILE_SIZE) < 3) continue;
    if (picked.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < WORLD.rampSpacingTiles)) continue;
    picked.push(c);
  }
  return picked.map((c) => {
    const flip = rng.chance(0.5);
    const angle = c.axis === 'h' ? (flip ? Math.PI : 0) : flip ? -Math.PI / 2 : Math.PI / 2;
    return { x: (c.x + 0.5) * TILE_SIZE, y: (c.y + 0.5) * TILE_SIZE, angle, w: WORLD.rampW, h: WORLD.rampH };
  });
}
