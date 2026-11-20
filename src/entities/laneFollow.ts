/**
 * Pure lane-following helpers (Phaser-free). Pure-pursuit over the lane graph, plus a spatial
 * grid index for nearest-node queries and the spawn-ring selection logic.
 */
import { TRAFFIC } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type { LaneGraph } from '../core/types';

export interface LaneControls { throttle: number; brake: number; steer: number }

/** Per-vehicle follower state. `target` = node being driven to; `next` = chosen node after it (-1 = not chosen yet). */
export interface FollowState { target: number; next: number }

export class NodeIndex {
  private readonly cells = new Map<number, number[]>();
  private readonly stride = 4096;
  constructor(readonly graph: LaneGraph, private readonly cell: number = TRAFFIC.nodeCell) {
    for (const n of graph.nodes) {
      const k = this.key(Math.floor(n.x / cell), Math.floor(n.y / cell));
      let a = this.cells.get(k);
      if (!a) { a = []; this.cells.set(k, a); }
      a.push(n.id);
    }
  }
  private key(cx: number, cy: number) { return (cy + 2048) * this.stride + (cx + 2048); }

  nearest(x: number, y: number, maxR = Infinity): number {
    const { nodes } = this.graph;
    const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
    let best = -1;
    let bestD = maxR === Infinity ? Infinity : maxR * maxR;
    const maxRing = maxR === Infinity ? 64 : Math.ceil(maxR / this.cell) + 1;
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let j = -ring; j <= ring; j++) for (let i = -ring; i <= ring; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const a = this.cells.get(this.key(cx + i, cy + j));
        if (!a) continue;
        for (const id of a) {
          const dx = nodes[id].x - x, dy = nodes[id].y - y, d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = id; }
        }
      }
      // nodes in later rings are at least ring*cell away from the query point
      if (best >= 0 && bestD <= ring * this.cell * ring * this.cell) break;
    }
    return best;
  }

  within(x: number, y: number, r: number, out: number[] = []): number[] {
    const { nodes } = this.graph;
    const x0 = Math.floor((x - r) / this.cell), x1 = Math.floor((x + r) / this.cell);
    const y0 = Math.floor((y - r) / this.cell), y1 = Math.floor((y + r) / this.cell);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const a = this.cells.get(this.key(cx, cy));
      if (!a) continue;
      for (const id of a) {
        const dx = nodes[id].x - x, dy = nodes[id].y - y;
        if (dx * dx + dy * dy <= r2) out.push(id);
      }
    }
    return out;
  }
}

const indexCache = new WeakMap<LaneGraph, NodeIndex>();
export function nodeIndex(graph: LaneGraph): NodeIndex {
  let i = indexCache.get(graph);
  if (!i) { i = new NodeIndex(graph); indexCache.set(graph, i); }
  return i;
}

/** Id of the node nearest (x, y), or -1 for an empty graph / nothing within maxR. */
export function nearestNode(graph: LaneGraph, x: number, y: number, maxR = Infinity): number {
  return nodeIndex(graph).nearest(x, y, maxR);
}
/** Ids of all nodes within r of (x, y). Pass `out` to avoid allocating. */
export function nodesWithin(graph: LaneGraph, x: number, y: number, r: number, out: number[] = []): number[] {
  return nodeIndex(graph).within(x, y, r, out);
}

export const wrapAngle = (a: number): number => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function chooseNext(graph: LaneGraph, id: number, rng: Rng): number {
  const nx = graph.nodes[id].next;
  if (nx.length === 0) return -1;
  return nx.length === 1 ? nx[0] : nx[Math.floor(rng.next() * nx.length)];
}

export interface FollowResult extends LaneControls {
  /** Speed (px/s) the lane geometry allows (turn slowing applied). */
  speedLimit: number;
}
export function newFollowResult(): FollowResult { return { throttle: 0, brake: 0, steer: 0, speedLimit: 0 }; }

/** Convert a target speed into throttle/brake (brake is not used below ~8 px/s so it never reverses). */
export function trackSpeed(target: number, speed: number, out: LaneControls): void {
  const e = target - speed;
  out.throttle = e > 0 ? clamp(e / 40, 0, 1) : 0;
  out.brake = e < -15 && speed > 8 ? clamp(-e / 120, 0, 1) : 0;
}

/**
 * Advance `st` along the lane graph and compute controls (written into `out`, no allocation).
 * @param speed current forward speed (px/s)
 * @param desiredSpeed cruise speed (px/s); controls track min(desiredSpeed, turn limit).
 */
export function followLane(
  graph: LaneGraph, st: FollowState,
  x: number, y: number, heading: number, speed: number,
  desiredSpeed: number, rng: Rng, out: FollowResult,
): FollowResult {
  const nodes = graph.nodes;
  if (st.next < 0) st.next = chooseNext(graph, st.target, rng);
  for (let guard = 0; guard < 3 && st.next >= 0; guard++) {
    const t = nodes[st.target], n = nodes[st.next];
    const reached = Math.hypot(t.x - x, t.y - y) < TRAFFIC.advanceRadius;
    // "passed" = beyond the target along the target->next segment
    const passed = (x - t.x) * (n.x - t.x) + (y - t.y) * (n.y - t.y) > 0;
    if (!reached && !passed) break;
    st.target = st.next;
    st.next = chooseNext(graph, st.target, rng);
  }

  const t = nodes[st.target];
  const L = clamp(Math.abs(speed) * 0.3, TRAFFIC.lookAheadMin, TRAFFIC.lookAheadMax);
  const d = Math.hypot(t.x - x, t.y - y);
  let ax = t.x, ay = t.y;
  let turn = 0; // 0 straight .. 1 sharp
  if (st.next >= 0) {
    const n = nodes[st.next];
    if (d < L) {
      const sx = n.x - t.x, sy = n.y - t.y, sl = Math.hypot(sx, sy) || 1;
      const k = Math.min(L - d, sl) / sl;
      ax = t.x + sx * k; ay = t.y + sy * k;
    }
    const a1 = Math.atan2(t.y - y, t.x - x);
    const a2 = Math.atan2(n.y - t.y, n.x - t.x);
    turn = clamp(Math.abs(wrapAngle(a2 - a1)) / (Math.PI / 2), 0, 1);
    // look one node further: heading change between where we are going and the segment after next
    const after = nodes[st.next].next;
    if (after.length > 0) {
      const nn = nodes[after[0]];
      const a3 = Math.atan2(nn.y - n.y, nn.x - n.x);
      turn = Math.max(turn, clamp(Math.abs(wrapAngle(a3 - heading)) / (Math.PI / 2), 0, 1));
    }
  }
  const err = wrapAngle(Math.atan2(ay - y, ax - x) - heading);
  out.steer = clamp(err * 2.2, -1, 1);
  const slow = Math.max(turn * (d < 160 ? 1 : 0.6), Math.min(1, Math.abs(err) / 1.2));
  out.speedLimit = desiredSpeed * (1 - (1 - TRAFFIC.turnSlowFrac) * slow);
  trackSpeed(out.speedLimit, speed, out);
  return out;
}

export interface SpawnQuery {
  players: readonly { x: number; y: number }[];
  views: readonly { x: number; y: number; w: number; h: number }[];
  occupied: readonly { x: number; y: number }[];
  excluded?: { x: number; y: number; w: number; h: number };
  minR: number; maxR: number; margin: number; gap: number;
}

/** Whether a spawn at (x, y) satisfies the ring, off-screen and spacing rules. */
export function spawnOk(x: number, y: number, q: SpawnQuery): boolean {
  const excluded = q.excluded;
  if (excluded && x >= excluded.x && x <= excluded.x + excluded.w && y >= excluded.y && y <= excluded.y + excluded.h) return false;
  let nearest = Infinity;
  for (const p of q.players) nearest = Math.min(nearest, Math.hypot(p.x - x, p.y - y));
  if (nearest < q.minR || nearest > q.maxR) return false;
  for (const v of q.views) {
    if (x > v.x - q.margin && x < v.x + v.w + q.margin && y > v.y - q.margin && y < v.y + v.h + q.margin) return false;
  }
  for (const o of q.occupied) {
    if (Math.abs(o.x - x) < q.gap && Math.abs(o.y - y) < q.gap && Math.hypot(o.x - x, o.y - y) < q.gap) return false;
  }
  return true;
}

/** Pick a random lane node (with a successor) satisfying `spawnOk`, or -1. `scratch` avoids allocation. */
export function pickSpawnNode(graph: LaneGraph, q: SpawnQuery, rng: Rng, scratch: number[] = []): number {
  if (q.players.length === 0) return -1;
  const p = q.players[Math.floor(rng.next() * q.players.length)];
  scratch.length = 0;
  nodesWithin(graph, p.x, p.y, q.maxR, scratch);
  const len = scratch.length;
  if (len === 0) return -1;
  const nodes = graph.nodes;
  const start = Math.floor(rng.next() * len);
  const tries = Math.min(len, 300);
  for (let k = 0; k < tries; k++) {
    const id = scratch[(start + k * 2749) % len]; // coprime-ish stride scatters the samples
    const n = nodes[id];
    if (n.next.length > 0 && spawnOk(n.x, n.y, q)) return id;
  }
  return -1;
}
