/** Guide-buddy maths (Phaser-free): route look-ahead, hover spot, spring flight, goal orbit. */
import type { LaneGraph, Rect, Vec2 } from '../core/types';

export interface GuideTuning {
  lookAhead: number; holdDist: number; spring: number; damping: number; maxSpeed: number;
  nearGoal: number; leaveGoal: number; offRouteDist: number;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** Drop leading path nodes that lie behind the car so the look-ahead never points backwards along the lane. */
export function trimPath(graph: LaneGraph, path: number[], pos: Vec2, maxScan = 10): number[] {
  let best = 0, bd = Infinity;
  for (let i = 0; i < Math.min(path.length, maxScan); i++) {
    const d = dist(graph.nodes[path[i]], pos);
    if (d < bd) { bd = d; best = i; }
  }
  // the car is already past the nearest node (along the segment to the next one): skip it
  if (best + 1 < path.length) {
    const a = graph.nodes[path[best]], b = graph.nodes[path[best + 1]];
    const abx = b.x - a.x, aby = b.y - a.y;
    if ((pos.x - a.x) * abx + (pos.y - a.y) * aby > 0) best++;
  }
  return path.slice(best);
}

/** Point `ahead` px along the polyline pos -> path nodes. Returns the final node if the path is shorter. */
export function pointAlongPath(graph: LaneGraph, path: number[], pos: Vec2, ahead: number): Vec2 {
  let prev: Vec2 = pos, left = ahead;
  for (const id of path) {
    const n = graph.nodes[id];
    const seg = dist(prev, n);
    if (seg >= left && seg > 1e-6) {
      const t = left / seg;
      return { x: prev.x + (n.x - prev.x) * t, y: prev.y + (n.y - prev.y) * t };
    }
    left -= seg;
    prev = n;
  }
  return { x: prev.x, y: prev.y };
}

/** Shortest distance from pos to the polyline of the first `maxNodes` path nodes (Infinity if empty). */
export function distToPath(graph: LaneGraph, path: number[], pos: Vec2, maxNodes = 14): number {
  let best = Infinity;
  const n = Math.min(path.length, maxNodes);
  if (n === 1) return dist(graph.nodes[path[0]], pos);
  for (let i = 0; i + 1 < n; i++) {
    const a = graph.nodes[path[i]], b = graph.nodes[path[i + 1]];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((pos.x - a.x) * dx + (pos.y - a.y) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(pos.x - (a.x + dx * t), pos.y - (a.y + dy * t)));
  }
  return best;
}

/** Spot `hold` px from the car toward `target` (falls back to `fallbackDir` radians if target ~ car). */
export function hoverSpot(car: Vec2, target: Vec2, hold: number, fallbackDir = 0): Vec2 {
  let dx = target.x - car.x, dy = target.y - car.y;
  const l = Math.hypot(dx, dy);
  if (l < 1e-3) { dx = Math.cos(fallbackDir); dy = Math.sin(fallbackDir); } else { dx /= l; dy /= l; }
  return { x: car.x + dx * hold, y: car.y + dy * hold };
}

/** Goal mode with hysteresis: enter within nearGoal (or once arrived), leave beyond leaveGoal. */
export function nextGoalMode(inGoalMode: boolean, carToGoal: number, arrived: boolean, t: Pick<GuideTuning, 'nearGoal' | 'leaveGoal'>): boolean {
  if (arrived) return true;
  return carToGoal < (inGoalMode ? t.leaveGoal : t.nearGoal);
}

export function orbitPoint(center: Vec2, angle: number, radius: number): Vec2 {
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

/** The goal ring can be in view with its center past an edge. */
export function goalRingInView(center: Vec2, radius: number, view: Rect): boolean {
  const x = Math.max(view.x, Math.min(view.x + view.w, center.x));
  const y = Math.max(view.y, Math.min(view.y + view.h, center.y));
  return Math.hypot(center.x - x, center.y - y) <= radius;
}

/** Distance from `origin` (inside `rect`) along unit `dir` to the rect edge (Infinity if dir ~ 0). */
export function viewEdgeDist(origin: Vec2, dir: Vec2, rect: { x: number; y: number; w: number; h: number }): number {
  let best = Infinity;
  if (dir.x > 1e-6) best = Math.min(best, (rect.x + rect.w - origin.x) / dir.x);
  else if (dir.x < -1e-6) best = Math.min(best, (rect.x - origin.x) / dir.x);
  if (dir.y > 1e-6) best = Math.min(best, (rect.y + rect.h - origin.y) / dir.y);
  else if (dir.y < -1e-6) best = Math.min(best, (rect.y - origin.y) / dir.y);
  return Math.max(0, best);
}

/** Distance along a unit ray to enter a HUD obstacle, or Infinity if it misses. */
export function obstacleDist(origin: Vec2, dir: Vec2, rect: Rect): number {
  let enter = 0;
  let exit = Infinity;
  for (const { offset, span, speed } of [
    { offset: rect.x - origin.x, span: rect.w, speed: dir.x },
    { offset: rect.y - origin.y, span: rect.h, speed: dir.y },
  ]) {
    if (Math.abs(speed) < 1e-6) {
      if (offset > 0 || offset + span < 0) return Infinity;
      continue;
    }
    const a = offset / speed, b = (offset + span) / speed;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }
  return enter <= exit ? enter : Infinity;
}

/** World-px hover distance: `frac` of the screen distance to the view edge minus a margin, converted by zoom. */
export function edgeHoldDist(edgeScreenDist: number, frac: number, marginScreen: number, zoom: number, minHold: number, maxHold: number): number {
  if (!isFinite(edgeScreenDist)) return minHold;
  const screen = Math.max(0, Math.min(edgeScreenDist * frac, edgeScreenDist - marginScreen));
  return Math.max(minHold, Math.min(maxHold, screen / Math.max(zoom, 1e-3)));
}

export interface FlyState { x: number; y: number; vx: number; vy: number }

/**
 * Spring toward `target`; damping acts on velocity relative to `frameVel` (the car), so the buddy keeps
 * pace with a moving car without lagging. Speed is clamped to maxSpeed.
 */
export function stepFly(s: FlyState, target: Vec2, frameVel: Vec2, dt: number, t: Pick<GuideTuning, 'spring' | 'damping' | 'maxSpeed'>): void {
  if (dt <= 0) return;
  const h = Math.min(dt, 1 / 30);
  const ax = t.spring * (target.x - s.x) - t.damping * (s.vx - frameVel.x);
  const ay = t.spring * (target.y - s.y) - t.damping * (s.vy - frameVel.y);
  s.vx += ax * h; s.vy += ay * h;
  const sp = Math.hypot(s.vx, s.vy);
  if (sp > t.maxSpeed) { s.vx *= t.maxSpeed / sp; s.vy *= t.maxSpeed / sp; }
  s.x += s.vx * h; s.y += s.vy * h;
}
