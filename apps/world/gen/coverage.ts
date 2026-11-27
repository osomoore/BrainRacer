import { GEN, WORLD } from '../config';
import type { BiomeId, HexPlan, SurfaceKind } from '../core/types';
import { hexInset } from './layout';
import { prepareSurface } from './surface';

/** The distinguishing off-road surface for each biome's coverage readout. */
export const COVERAGE_KIND = {
  meadow: 'shallow', mud: 'deepMud', rocky: 'cliff', lake: 'deep', darkwood: 'tallGrass',
  snow: 'ice', desert: 'rough', jungle: 'tallGrass', canyon: 'cliff', geyser: 'hotSpring',
} as const satisfies Record<BiomeId, SurfaceKind>;

export function offRoadCoverage(plan: HexPlan): Record<SurfaceKind, number> {
  const sample = prepareSurface(plan);
  const counts: Record<SurfaceKind, number> = {
    road: 0, path: 0, bridge: 0, grass: 0, tallGrass: 0, sand: 0, snow: 0, ice: 0,
    mud: 0, deepMud: 0, rough: 0, shallow: 0, deep: 0, hotSpring: 0, cliff: 0,
  };
  let offRoad = 0;
  for (let dy = -WORLD.hexSize + GEN.coverageStep / 2; dy < WORLD.hexSize; dy += GEN.coverageStep) {
    for (let dx = -WORLD.hexSize + GEN.coverageStep / 2; dx < WORLD.hexSize; dx += GEN.coverageStep) {
      const at = { x: plan.center.x + dx, y: plan.center.y + dy };
      if (hexInset(plan.center, at) <= 0) continue;
      const { kind } = sample(at.x, at.y);
      if (kind === 'road' || kind === 'path' || kind === 'bridge') continue;
      counts[kind]++;
      offRoad++;
    }
  }
  for (const kind of Object.keys(counts) as SurfaceKind[]) counts[kind] /= offRoad;
  return counts;
}
