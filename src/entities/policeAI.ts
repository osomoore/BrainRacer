/**
 * Police AI (package K). Phaser-free: lane-graph pathing, pure-pursuit steering, line of sight,
 * stuck recovery and heat math. All distances px, speeds px/s, angles rad (0 = +x, clockwise positive).
 */
import { POLICE } from '../config/gameConfig';
import type { CrashWith } from '../core/events';
import type { LaneGraph, Vec2, WorldData } from '../core/types';
import { isDrivable } from '../world/geometry';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const wrapAngle = (a: number): number => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

// ───────────────────────── heat math ─────────────────────────

/** Heat gained from one crash: base value scaled up to +50% by impact (px/s). */
export function heatGain(withKind: CrashWith, impact: number): number {
  const base = POLICE.heatPerCrash[withKind] ?? 0;
  if (base <= 0) return 0;
  return base * (1 + (clamp(impact, 0, POLICE.heatImpactRef) / POLICE.heatImpactRef) * 0.5);
}

export function decayHeat(heat: number, dtSec: number): number {
  return Math.max(0, heat - POLICE.heatDecayPerSec * dtSec);
}

export function addHeat(heat: number, withKind: CrashWith, impact: number): number {
  return clamp(heat + heatGain(withKind, impact), 0, POLICE.heatMax);
}

/** How many chasers a heat level calls for (0 below the threshold; 1..max above it). */
export function desiredChasers(heat: number): number {
  if (heat < POLICE.heatChaseThreshold) return 0;
  const t = clamp((heat - POLICE.heatChaseThreshold) / Math.max(1, POLICE.heatMax - POLICE.heatChaseThreshold), 0, 1);
  return Math.round(1 + (POLICE.maxChasersPerPlayer - 1) * t);
}

export interface EscapeState { farSec: number }

/**
 * Advance the "got away" tracker. `minDist` = distance of the nearest chaser (Infinity if none).
 * Returns true when the chase should end.
 */
export function updateEscape(st: EscapeState, minDist: number, turbo: boolean, dtSec: number): boolean {
  if (minDist > POLICE.loseDistance) st.farSec += dtSec; else st.farSec = 0;
  if (st.farSec >= POLICE.loseHoldSec) return true;
  return turbo && minDist > POLICE.turboEscapeDistance;
}

// ───────────────────────── lane graph helpers ─────────────────────────

/** Uniform-grid index over lane nodes for fast nearest-node queries. */
export class NodeIndex {
  private cells = new Map<number, number[]>();
  constructor(private readonly graph: LaneGraph, private readonly cell = 256) {
    for (const n of graph.nodes) {
      const k = this.key(Math.floor(n.x / cell), Math.floor(n.y / cell));
      const arr = this.cells.get(k);
      if (arr) arr.push(n.id); else this.cells.set(k, [n.id]);
    }
  }
  private key(cx: number, cy: number) { return (cx + 1000) * 4096 + (cy + 1000); }
  /** Nearest node id, or -1 if the graph is empty. */
  nearest(x: number, y: number): number {
    const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
    let best = -1, bd = Infinity;
    for (let r = 0; r <= 60; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const arr = this.cells.get(this.key(cx + dx, cy + dy));
        if (!arr) continue;
        for (const id of arr) {
          const n = this.graph.nodes[id];
          const d = (n.x - x) ** 2 + (n.y - y) ** 2;
          if (d < bd) { bd = d; best = id; }
        }
      }
      if (best >= 0 && Math.sqrt(bd) <= r * this.cell) break;
    }
    return best;
  }
}

/** A* shortest path (node ids, inclusive of both ends) on the directed lane graph; null if unreachable. */
export function findPath(graph: LaneGraph, from: number, to: number, maxExpand = 30000): number[] | null {
  const nodes = graph.nodes;
  if (from < 0 || to < 0 || from >= nodes.length || to >= nodes.length) return null;
  if (from === to) return [from];
  const g = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, number>();
  const closed = new Set<number>();
  const heap: [number, number][] = [];
  const push = (f: number, id: number) => {
    heap.push([f, id]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const h = (id: number) => Math.hypot(nodes[id].x - nodes[to].x, nodes[id].y - nodes[to].y);
  push(h(from), from);
  let expanded = 0;
  while (heap.length && expanded++ < maxExpand) {
    const [, cur] = pop();
    if (cur === to) {
      const path = [cur];
      let c = cur;
      while (prev.has(c)) { c = prev.get(c)!; path.push(c); }
      return path.reverse();
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    const cn = nodes[cur];
    for (const nx of cn.next) {
      if (closed.has(nx)) continue;
      const nn = nodes[nx];
      const ng = g.get(cur)! + Math.hypot(nn.x - cn.x, nn.y - cn.y);
      if (ng < (g.get(nx) ?? Infinity)) {
        g.set(nx, ng);
        prev.set(nx, cur);
        push(ng + h(nx), nx);
      }
    }
  }
  return null;
}

// ───────────────────────── steering ─────────────────────────

/** Steer value (-1..1, positive = clockwise) to turn from `angle` toward the point (tx, ty). */
export function steerToward(x: number, y: number, angle: number, tx: number, ty: number): number {
  return clamp(wrapAngle(Math.atan2(ty - y, tx - x) - angle) * 2.2, -1, 1);
}

/** Where to aim at a moving target: its position led by velocity * leadSec. */
export function leadPoint(target: Vec2, vel: Vec2, leadSec: number): Vec2 {
  return { x: target.x + vel.x * leadSec, y: target.y + vel.y * leadSec };
}

/**
 * Pure pursuit along a node path: starting from `cursor`, skip nodes closer than `lookahead`
 * and return the first one beyond it (or the last node).
 */
export function pursuitTarget(graph: LaneGraph, path: number[], cursor: number, x: number, y: number, lookahead: number): { x: number; y: number; cursor: number } {
  let c = clamp(cursor, 0, path.length - 1);
  while (c < path.length - 1) {
    const n = graph.nodes[path[c]];
    if (Math.hypot(n.x - x, n.y - y) >= lookahead) break;
    c++;
  }
  const n = graph.nodes[path[c]];
  return { x: n.x, y: n.y, cursor: c };
}

/** True if the straight segment a->b stays on drivable tiles (buildings/water block it). */
export function lineOfSight(world: WorldData, a: Vec2, b: Vec2, step = 32): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.ceil(d / step);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (!isDrivable(world, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

// ───────────────────────── per-car brain ─────────────────────────

export type PoliceMode = 'patrol' | 'chase' | 'leave';
export interface DriveCommand { throttle: number; brake: number; steer: number }
export interface PoliceBrain {
  path: number[];
  cursor: number;
  repathSec: number;
  stuckSec: number;
  reverseSec: number;
  /** Steer that was wanted when the stuck recovery started. */
  lastSteer: number;
  /** Destination node for patrol/leave modes (-1 = none). */
  goal: number;
}
export const newBrain = (): PoliceBrain => ({ path: [], cursor: 0, repathSec: 0, stuckSec: 0, reverseSec: 0, lastSteer: 0, goal: -1 });

export interface ThinkEnv {
  world: WorldData;
  index: NodeIndex;
  /** Picks a fresh destination node for patrol/leave modes. */
  pickGoal: (fromNode: number) => number;
}
export interface Mover { x: number; y: number; angle: number; forwardSpeed: number }
export interface TargetState { x: number; y: number; vx: number; vy: number }

/** One AI step. `speedCap` is the desired cruising speed (px/s). In chase mode `target` is required. */
export function think(
  brain: PoliceBrain, env: ThinkEnv, me: Mover, mode: PoliceMode, target: TargetState | null, speedCap: number, dt: number,
): DriveCommand {
  const graph = env.world.laneGraph;
  if (brain.reverseSec > 0) {
    brain.reverseSec -= dt;
    // Reversing flips steering, so steer the opposite way to swing the nose toward the aim.
    return { throttle: 0, brake: 1, steer: -brain.lastSteer };
  }

  let aim: Vec2 | null = null;
  let direct = false;
  if (mode === 'chase' && target) {
    const dist = Math.hypot(target.x - me.x, target.y - me.y);
    if (dist < POLICE.directChaseDist && lineOfSight(env.world, me, target)) {
      aim = leadPoint(target, { x: target.vx, y: target.vy }, POLICE.leadSec);
      direct = true;
    }
  }

  if (!direct) {
    brain.repathSec -= dt;
    const meNode = env.index.nearest(me.x, me.y);
    let goalNode = brain.goal;
    if (mode === 'chase' && target) goalNode = env.index.nearest(target.x, target.y);
    else if (goalNode < 0 || (goalNode < graph.nodes.length && Math.hypot(graph.nodes[goalNode].x - me.x, graph.nodes[goalNode].y - me.y) < 150)) {
      goalNode = brain.goal = env.pickGoal(meNode);
      brain.repathSec = 0;
    }
    if (brain.repathSec <= 0 || brain.path.length === 0) {
      brain.repathSec = POLICE.repathSec;
      brain.path = meNode >= 0 && goalNode >= 0 ? findPath(graph, meNode, goalNode) ?? [] : [];
      brain.cursor = 0;
      if (mode !== 'chase' && brain.path.length === 0) brain.goal = -1;
    }
    if (brain.path.length > 0) {
      const p = pursuitTarget(graph, brain.path, brain.cursor, me.x, me.y, POLICE.lookaheadPx);
      brain.cursor = p.cursor;
      aim = p;
    } else if (target) {
      aim = target;
    }
  }

  if (!aim) return { throttle: 0, brake: 0.3, steer: 0 };
  const steer = steerToward(me.x, me.y, me.angle, aim.x, aim.y);
  const off = Math.abs(wrapAngle(Math.atan2(aim.y - me.y, aim.x - me.x) - me.angle));
  let throttle = me.forwardSpeed < speedCap ? 1 : 0;
  let brake = me.forwardSpeed > speedCap + 80 ? 0.6 : 0;
  if (off > 1.1 && me.forwardSpeed > 220) { throttle = 0; brake = Math.max(brake, 0.5); } // slow into sharp turns

  // Stuck detection: pushing but not moving -> back up briefly.
  if (throttle > 0 && Math.abs(me.forwardSpeed) < POLICE.stuckSpeed) brain.stuckSec += dt; else brain.stuckSec = 0;
  if (brain.stuckSec >= POLICE.stuckSec) {
    brain.stuckSec = 0;
    brain.reverseSec = POLICE.reverseSec;
    brain.lastSteer = steer;
    brain.repathSec = 0;
  }
  return { throttle, brake, steer };
}
