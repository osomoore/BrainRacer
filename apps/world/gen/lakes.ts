import type { Rng } from '../../workshop/core/rng';
import { GEN, WORLD } from '../config';
import type { Feature, HexPlan, RoadPath, Vec } from '../core/types';
import type { FeatureSite } from './features';
import { inPolygon, polygonDistanceSquared } from './geometry';
import { hexKey } from './hex';
import { hexInset, offset, organic, type HexLayout } from './layout';
import { pathThrough } from './roads';
import { prepareGround } from './surface';
import { insideHex } from './terrain';

/** Hard-coded gen distances were tuned for a 2400 px hex. */
const K = WORLD.hexSize / 2400;

export function buildLakeIsland(layout: HexLayout, rng: Rng): FeatureSite | undefined {
  const { plan } = layout;
  const groundAt = prepareGround(plan);
  // Give the backbone roads a wide, wadeable landing where a lobe reaches their shoreline.
  for (const road of plan.roads) {
    const edge = road.points.at(-1)!;
    if (hexInset(plan.center, edge) > 1) continue;
    const landing = road.points.find(at => hexInset(plan.center, at) < 320 * K);
    if (!landing || groundAt(landing.x, landing.y).kind === 'grass') continue;
    plan.terrain.push({ kind: 'shallow', poly: insideHex(plan.center, organic(landing, 430 * K, 405 * K, rng)) });
  }

  const lakeGround = prepareGround(plan);
  const islands = plan.roads.flatMap(road => road.points
    .filter(at => Math.hypot(at.x - layout.hub.x, at.y - layout.hub.y) > 700 * K
      && hexInset(plan.center, at) > 540 * K && lakeGround(at.x, at.y).kind === 'deep')
    .map(at => ({ at, road })));
  if (!islands.length) return;
  const { at: island, road } = rng.pick(islands);
  plan.terrain.push({ kind: 'grass', poly: organic(island, 260 * K, 220 * K, rng) });
  const approaches = road.points.filter(at => Math.hypot(at.x - island.x, at.y - island.y) > 420 * K
    && hexInset(plan.center, at) > GEN.activityRadius);
  const at = approaches.findLast(p => lakeGround(p.x, p.y).kind !== 'deep') ?? approaches.at(-1) ?? layout.hub;
  layout.reserve(at, GEN.activityRadius);
  layout.reserve(island, GEN.activityRadius);
  return { kind: 'islandSwim', at, targets: [{ at: island, role: 'island' }] };
}

export function buildWaterCrossings(plan: HexPlan, rng: Rng): void {
  if (plan.biome !== 'lake' && plan.biome !== 'meadow') return;
  const currentGround = prepareGround(plan);
  let ford: [RoadPath, RoadPath] | undefined;
  for (const road of plan.roads) {
    if (road.kind !== 'road') continue;
    const points = road.points;
    let start = -1;
    for (let i = 1; i <= points.length; i++) {
      const wet = i < points.length && segmentOverWater(points[i - 1], points[i], road.width / 2);
      if (wet && start === -1) start = i - 1;
      if (!wet && start !== -1) {
        const span = points.slice(start, i);
        const bridge = addBridge(plan, span, road.width);
        // At a tight bend the two rails can fold over one another. Fill any
        // uncovered part of the deck with an overlapping straight span.
        for (let j = 1; j < span.length; j++) {
          const a = span[j - 1], b = span[j];
          if (![a, offset(a, (b.x - a.x) / 2, (b.y - a.y) / 2), b]
            .every(p => inPolygon(bridge.area, p.x, p.y))) addBridge(plan, [a, b], road.width);
        }
        if (!ford && rng.chance(0.5)) {
          ford = shallowFord(plan, road, start, i - 1, bridge, currentGround);
          if (ford) {
            bridge.needs = [{ trait: 'height', max: 2 }, { trait: 'width', max: 3 }];
            bridge.bypass = true;
          }
        }
        start = -1;
      }
    }
  }
  if (ford) {
    const insertAt = plan.roads.findIndex(road => road.kind === 'path');
    plan.roads.splice(insertAt < 0 ? plan.roads.length : insertAt, 0, ...ford);
  }

  function segmentOverWater(a: Vec, b: Vec, radius: number): boolean {
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
    const steps = Math.ceil(length / 24);
    for (let i = 0; i <= steps; i++) {
      for (const margin of [-radius, 0, radius]) {
        const kind = currentGround(a.x + dx * i / steps - dy / length * margin,
          a.y + dy * i / steps + dx / length * margin).kind;
        if (kind === 'deep' || kind === 'shallow') return true;
      }
    }
    return false;
  }
}

function addBridge(plan: HexPlan, points: Vec[], width: number): Feature {
  const rails = [1, -1].map(sign => points.map((at, i) => {
    const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy) || 1;
    const radius = width / 2 + 12;
    const cap = i === 0 ? -radius : i === points.length - 1 ? radius : 0;
    return offset(at, (dx * cap - dy * radius * sign) / length, (dy * cap + dx * radius * sign) / length);
  }));
  const mid = Math.floor((points.length - 1) / 2);
  const from = points[mid], to = points[mid + 1];
  const bridge: Feature = {
    id: `${hexKey(plan.coord)}:f${plan.features.length}`, kind: 'bridge',
    at: offset(from, (to.x - from.x) / 2, (to.y - from.y) / 2),
    dir: Math.atan2(to.y - from.y, to.x - from.x), area: [...rails[0], ...rails[1].reverse()],
  };
  plan.features.push(bridge);
  return bridge;
}

/** A low bridge is optional and only used when a wide vehicle has an open ford alongside it. */
function shallowFord(plan: HexPlan, road: RoadPath, first: number, last: number, bridge: Feature,
    groundAt: ReturnType<typeof prepareGround>): [RoadPath, RoadPath] | undefined {
  const points = road.points;
  const margin = GEN.pathWidth / 2 + GEN.placementClearance;
  const outside = (p: Vec) => polygonDistanceSquared(bridge.area, p.x, p.y) > margin * margin;
  const a = points.slice(0, first).findLast(outside);
  const b = points.slice(last + 1).find(outside);
  if (!a || !b) return;
  if (hexInset(plan.center, a) <= margin || hexInset(plan.center, b) <= margin) return;
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
  if (length < 275 * K || length > 1080 * K) return;
  const traversable = (p: Vec) => {
    const kind = groundAt(p.x, p.y).kind;
    return kind !== 'deep' && kind !== 'cliff';
  };
  if (!points.slice(first, last + 1).every(traversable)) return;
  for (const sign of [1, -1]) {
    const bend = sign * (road.width / 2 + margin + 135 * K);
    const bypass = pathThrough([a, offset(a, dx * 0.22 - dy / length * bend, dy * 0.22 + dx / length * bend),
      offset(a, dx * 0.78 - dy / length * bend, dy * 0.78 + dx / length * bend), b]);
    if (bypass.points.every(p => outside(p) && hexInset(plan.center, p) > margin && traversable(p)
      && traversable(offset(p, -dy / length * margin, dx / length * margin))
      && traversable(offset(p, dy / length * margin, -dx / length * margin)))) {
      return [bypass, { kind: 'path', width: GEN.pathWidth, points: points.slice(points.indexOf(a), points.indexOf(b) + 1) }];
    }
  }
}
