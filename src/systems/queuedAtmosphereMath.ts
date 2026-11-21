import { Tile, type Vec2, type WorldData } from '../core/types';
import { isQueuedParkTrackMap, type QueuedMap } from '../config/queuedMaps';

/** Wrap fronts beyond a padded map edge so they never jump while in view. */
export function wrapFront(value: number, extent: number, pad: number): number {
  const length = extent + pad * 2;
  return ((value + pad) % length + length) % length - pad;
}

/** Grass and parks are snow-covered, streets and ice hold a lighter dusting. */
export function snowTrackAlpha(world: Pick<WorldData, 'tileSize' | 'widthTiles' | 'heightTiles' | 'tiles'>, x: number, y: number): number {
  const tx = Math.floor(x / world.tileSize), ty = Math.floor(y / world.tileSize);
  if (tx < 0 || ty < 0 || tx >= world.widthTiles || ty >= world.heightTiles) return 0;
  switch (world.tiles[ty * world.widthTiles + tx]) {
    case Tile.Grass:
    case Tile.Park:
    case Tile.Plaza:
    case Tile.Sidewalk: return .9;
    case Tile.Road: return .47;
    case Tile.Dirt: return .29;
    default: return 0;
  }
}

/** Later queued-world surfaces leave impressions only on their open themed ground patches. */
export function parkTrackAlpha(map: QueuedMap, world: Pick<WorldData, 'tileSize' | 'widthTiles' | 'heightTiles' | 'tiles'>, x: number, y: number): number {
  if (!isQueuedParkTrackMap(map)) return 0;
  const tx = Math.floor(x / world.tileSize), ty = Math.floor(y / world.tileSize);
  if (tx < 0 || ty < 0 || tx >= world.widthTiles || ty >= world.heightTiles) return 0;
  return world.tiles[ty * world.widthTiles + tx] === Tile.Park ? .88 : 0;
}

/** Sample a wheel's actual path by distance, saving the unused length for the next frame. */
export function traceWheel(from: Vec2, to: Vec2, spacing: number, mark: (center: Vec2, angle: number) => void): Vec2 {
  const dx = to.x - from.x, dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const steps = Math.floor(distance / spacing);
  if (!steps) return from;
  const angle = Math.atan2(dy, dx);
  const stepX = dx * spacing / distance, stepY = dy * spacing / distance;
  for (let i = 0; i < steps; i++) mark({ x: from.x + (i + .5) * stepX, y: from.y + (i + .5) * stepY }, angle);
  return { x: from.x + steps * stepX, y: from.y + steps * stepY };
}
