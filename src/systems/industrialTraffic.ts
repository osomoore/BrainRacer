import { INDUSTRIAL_TRAFFIC } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type { LaneNode, WorldData } from '../core/types';
import { spawnOk, type SpawnQuery } from '../entities/laneFollow';

export interface FreightSpawn {
  node: LaneNode;
  next: LaneNode;
}

/** Spawn long chassis pointing down straight lanes beside the loading yards. */
export function findFreightStarts(world: WorldData): FreightSpawn[] {
  const yards = world.industrial?.decorations.filter((d) => d.kind === 'loadingYard');
  if (!yards?.length) return [];
  const pad = INDUSTRIAL_TRAFFIC.yardPaddingTiles * world.tileSize;
  const { nodes } = world.laneGraph;
  const candidates: FreightSpawn[] = [];
  for (const node of nodes) {
    if (!yards.some((yard) => Math.abs(node.x - yard.x) <= yard.w / 2 + pad
      && Math.abs(node.y - yard.y) <= yard.h / 2 + pad)) continue;
    for (const id of node.next) {
      const next = nodes[id];
      const dx = Math.abs(next.x - node.x), dy = Math.abs(next.y - node.y);
      if (Math.min(dx, dy) === 0 && Math.max(dx, dy) >= world.tileSize / 2) candidates.push({ node, next });
    }
  }
  return candidates;
}

export function pickFreightStart(candidates: readonly FreightSpawn[], query: SpawnQuery, rng: Rng): FreightSpawn | undefined {
  if (!candidates.length) return undefined;
  const start = rng.int(0, candidates.length - 1);
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[(start + i) % candidates.length];
    if (spawnOk(candidate.node.x, candidate.node.y, query)) return candidate;
  }
  return undefined;
}
