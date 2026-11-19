import { FARM_TRAFFIC } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import { Tile, type LaneNode, type WorldData } from '../core/types';
import { spawnOk, type SpawnQuery } from '../entities/laneFollow';
import { isDrivable } from '../world/geometry';

export interface FarmSpawn {
  node: LaneNode;
  next: LaneNode;
  angle: number;
}

export interface FarmStarts {
  /** Dirt-lane starts for tractors (straight run behind for the wagon). */
  tractor: FarmSpawn[];
  /** Dirt-lane starts beside corn when any exist, else any dirt-lane start. */
  combine: FarmSpawn[];
}

export function tileAtPx(world: WorldData, x: number, y: number): number {
  const tx = Math.floor(x / world.tileSize), ty = Math.floor(y / world.tileSize);
  if (tx < 0 || ty < 0 || tx >= world.widthTiles || ty >= world.heightTiles) return -1;
  return world.tiles[ty * world.widthTiles + tx];
}

/** A dirt farm-lane node sits over Dirt or Mud (bridge decks are Road tiles and count as paved). */
export function isFarmLaneNode(world: WorldData, node: { x: number; y: number }): boolean {
  const t = tileAtPx(world, node.x, node.y);
  return t === Tile.Dirt || t === Tile.Mud;
}

export function cornNear(world: WorldData, x: number, y: number, tiles: number): boolean {
  const s = world.tileSize;
  for (let dy = -tiles; dy <= tiles; dy++) {
    for (let dx = -tiles; dx <= tiles; dx++) {
      if (tileAtPx(world, x + dx * s, y + dy * s) === Tile.Corn) return true;
    }
  }
  return false;
}

/** Find straight dirt-lane segments with a drivable run behind them (room for a trailer). */
export function findFarmStarts(world: WorldData): FarmStarts {
  const tractor: FarmSpawn[] = [], besideCorn: FarmSpawn[] = [];
  const { nodes } = world.laneGraph;
  for (const node of nodes) {
    if (!isFarmLaneNode(world, node)) continue;
    for (const id of node.next) {
      const next = nodes[id];
      if (!isFarmLaneNode(world, next)) continue;
      const dx = next.x - node.x, dy = next.y - node.y;
      const len = Math.hypot(dx, dy);
      if (len < world.tileSize / 2) continue;
      const ux = dx / len, uy = dy / len;
      let ok = true;
      for (let d = 30; d <= FARM_TRAFFIC.trailerRunPx && ok; d += 30) {
        const bx = node.x - ux * d, by = node.y - uy * d;
        // Same strip behind (dirt, mud or bridge deck); never grass or water.
        const t = tileAtPx(world, bx, by);
        ok = (t === Tile.Dirt || t === Tile.Mud || t === Tile.Road) && isDrivable(world, bx, by);
      }
      if (!ok) continue;
      const spawn = { node, next, angle: Math.atan2(dy, dx) };
      tractor.push(spawn);
      if (cornNear(world, node.x, node.y, FARM_TRAFFIC.cornNearTiles)) besideCorn.push(spawn);
    }
  }
  return { tractor, combine: besideCorn.length ? besideCorn : tractor };
}

export function pickFarmStart(candidates: readonly FarmSpawn[], query: SpawnQuery, rng: Rng): FarmSpawn | undefined {
  if (!candidates.length) return undefined;
  const start = rng.int(0, candidates.length - 1);
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[(start + i) % candidates.length];
    if (spawnOk(c.node.x, c.node.y, query)) return c;
  }
  return undefined;
}

export interface TrailerPose { x: number; y: number; angle: number }

/**
 * Trailing point follower: the trailer front edge is pinned to the hitch, and it swings to point
 * from its previous centre toward the hitch. `halfLen` is half the trailer length.
 */
export function trailerPose(hitchX: number, hitchY: number, prevX: number, prevY: number, halfLen: number, fallbackAngle: number): TrailerPose {
  const dx = hitchX - prevX, dy = hitchY - prevY;
  const d = Math.hypot(dx, dy);
  const angle = d < 1e-3 ? fallbackAngle : Math.atan2(dy, dx);
  return { x: hitchX - Math.cos(angle) * halfLen, y: hitchY - Math.sin(angle) * halfLen, angle };
}

/** World position of the rear hitch (plus the wagon gap). */
export function hitchPoint(x: number, y: number, angle: number, length: number, gap: number = FARM_TRAFFIC.wagonGapPx): { x: number; y: number } {
  const r = length / 2 + gap;
  return { x: x - Math.cos(angle) * r, y: y - Math.sin(angle) * r };
}
