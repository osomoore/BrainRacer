import type { Rng } from '../../workshop/core/rng';
import { GEN, WORLD } from '../config';
import type { HexPlan, Vec } from '../core/types';
import type { FeatureSite } from './features';
import { hexKey } from './hex';
import { offset, organic, type HexLayout } from './layout';
import { roadOverlap } from './roads';
import { prepareGround } from './surface';
import { insideHex } from './terrain';

export function buildLakeIsland(layout: HexLayout, rng: Rng): FeatureSite | undefined {
  const { plan, hub } = layout;
  const ground = prepareGround(plan);
  const scale = WORLD.hexSize / 1200;
  for (const sign of rng.shuffle([-1, 1])) {
    const island = offset(plan.center, sign * GEN.lakeLobeOffset * scale, -sign * 310 * scale);
    if (ground(island.x, island.y).kind !== 'deep' || plan.roads.some(road => roadOverlap(road, island, 140 * scale))) continue;
    plan.terrain.push({ kind: 'grass', poly: organic(island, 107 * scale, 91 * scale, rng) });
    layout.reserve(island, 120 * scale);
    layout.reserve(hub, GEN.activityRadius);
    return { kind: 'islandSwim', at: hub, targets: [{ at: island, role: 'island' }] };
  }
}

/** One narrow deck per contiguous wet run, with extra deck length at the approaches. */
export function buildWaterCrossings(plan: HexPlan): void {
  if (plan.biome !== 'lake' && plan.biome !== 'meadow') return;
  const ground = prepareGround(plan);
  for (const road of plan.roads) {
    if (road.kind !== 'road') continue;
    const { points, width } = road;
    let start = -1;
    for (let i = 1; i <= points.length; i++) {
      if (i < points.length && wet(points[i - 1], points[i], width / 2)) {
        if (start === -1) start = i - 1;
      } else if (start !== -1) {
        addBridge(plan, points.slice(start, i), GEN.bridgeWidth);
        start = -1;
      }
    }
  }

  function wet(a: Vec, b: Vec, radius: number): boolean {
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    const steps = Math.ceil(length / 18);
    for (let i = 0; i <= steps; i++) {
      for (const margin of [-radius, 0, radius]) {
        const kind = ground(a.x + dx * i / steps - dy / length * margin,
          a.y + dy * i / steps + dx / length * margin).kind;
        if (kind === 'deep' || kind === 'shallow') return true;
      }
    }
    return false;
  }
}

function addBridge(plan: HexPlan, points: Vec[], width: number): void {
  const rails = [1, -1].map(sign => points.map((at, i) => {
    const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy);
    const radius = width / 2;
    const cap = i === 0 ? -18 : i === points.length - 1 ? 18 : 0;
    return offset(at, (dx * cap - dy * radius * sign) / length, (dy * cap + dx * radius * sign) / length);
  }));
  const mid = Math.floor((points.length - 1) / 2);
  const from = points[mid], to = points[mid + 1];
  plan.features.push({
    id: `${hexKey(plan.coord)}:f${plan.features.length}`, kind: 'bridge',
    at: offset(from, (to.x - from.x) / 2, (to.y - from.y) / 2),
    dir: Math.atan2(to.y - from.y, to.x - from.x), area: insideHex(plan.center, [...rails[0], ...rails[1].reverse()]),
  });
}
