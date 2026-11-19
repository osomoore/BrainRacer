import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { LaneGraph } from '../core/types';
import { cityGen } from '../world/gen';
import {
  followLane, nearestNode, newFollowResult, nodesWithin, pickSpawnNode, spawnOk, type FollowState, type SpawnQuery,
} from './laneFollow';

/** Straight east-going lane of nodes every 64 px, then a fork at node 5 (up / down branches). */
function straightGraph(): LaneGraph {
  const nodes = [];
  for (let i = 0; i < 6; i++) nodes.push({ id: i, x: i * 64, y: 0, next: [i + 1] });
  nodes[5].next = [6, 7];
  nodes.push({ id: 6, x: 340, y: -60, next: [] });
  nodes.push({ id: 7, x: 340, y: 60, next: [] });
  return { nodes };
}

describe('followLane', () => {
  it('drives straight with ~zero steer and throttle below desired speed', () => {
    const g = straightGraph();
    const st: FollowState = { target: 1, next: -1 };
    const out = followLane(g, st, 0, 0, 0, 50, 200, new Rng(1), newFollowResult());
    expect(Math.abs(out.steer)).toBeLessThan(0.05);
    expect(out.throttle).toBeGreaterThan(0.5);
    expect(out.brake).toBe(0);
  });

  it('steers toward a lane it is offset from (y>0 means lane is up => negative steer)', () => {
    const g = straightGraph();
    const st: FollowState = { target: 2, next: -1 };
    const out = followLane(g, st, 10, 30, 0, 100, 200, new Rng(1), newFollowResult());
    expect(out.steer).toBeLessThan(-0.05);
  });

  it('brakes when above the desired speed', () => {
    const g = straightGraph();
    const out = followLane(g, { target: 1, next: -1 }, 0, 0, 0, 300, 100, new Rng(1), newFollowResult());
    expect(out.brake).toBeGreaterThan(0.3);
    expect(out.throttle).toBe(0);
  });

  it('advances targets and picks only valid next nodes at a junction', () => {
    const g = straightGraph();
    const seen = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const st: FollowState = { target: 4, next: -1 };
      const rng = new Rng(seed);
      const out = newFollowResult();
      followLane(g, st, 256, 0, 0, 100, 200, rng, out); // at node 4 => advance to 5
      expect(st.target).toBe(5);
      followLane(g, st, 320, 0, 0, 100, 200, rng, out); // at node 5 => advance to 6 or 7
      expect([6, 7]).toContain(st.target);
      seen.add(st.target);
    }
    expect(seen.size).toBe(2);
  });

  it('slows for sharp turns', () => {
    const g: LaneGraph = { nodes: [
      { id: 0, x: 0, y: 0, next: [1] }, { id: 1, x: 100, y: 0, next: [2] }, { id: 2, x: 100, y: 100, next: [] },
    ] };
    const straight = followLane(straightGraph(), { target: 2, next: -1 }, 70, 0, 0, 150, 200, new Rng(1), newFollowResult());
    const turn = followLane(g, { target: 1, next: -1 }, 70, 0, 0, 150, 200, new Rng(1), newFollowResult());
    expect(turn.speedLimit).toBeLessThan(straight.speedLimit);
  });

  it('follows real generated lanes without leaving them (kinematic sim)', () => {
    const world = cityGen(3);
    const g = world.laneGraph;
    const rng = new Rng(9);
    const start = g.nodes.find((n) => n.next.length === 1)!;
    const nxt = g.nodes[start.next[0]];
    let x = start.x, y = start.y, h = Math.atan2(nxt.y - start.y, nxt.x - start.x), v = 150;
    const st: FollowState = { target: nxt.id, next: -1 };
    const out = newFollowResult();
    let worst = 0;
    for (let i = 0; i < 60 * 40; i++) {
      followLane(g, st, x, y, h, v, 180, rng, out);
      v += (out.throttle * 260 - out.brake * 700) / 60;
      h += out.steer * 2.4 * Math.min(1, v / 70) / 60;
      x += Math.cos(h) * v / 60; y += Math.sin(h) * v / 60;
      const near = nearestNode(g, x, y);
      worst = Math.max(worst, Math.hypot(g.nodes[near].x - x, g.nodes[near].y - y));
    }
    expect(worst).toBeLessThan(60);
  });
});

describe('nearestNode / nodesWithin', () => {
  const world = cityGen(5);
  const g = world.laneGraph;
  it('matches brute force', () => {
    const rng = new Rng(4);
    for (let i = 0; i < 100; i++) {
      const x = rng.range(0, 6000), y = rng.range(0, 6000);
      let best = -1, bd = Infinity;
      for (const n of g.nodes) { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n.id; } }
      const got = nearestNode(g, x, y);
      expect((g.nodes[got].x - x) ** 2 + (g.nodes[got].y - y) ** 2).toBeCloseTo(bd, 3);
      expect(best).toBeGreaterThanOrEqual(0);
    }
  });
  it('nodesWithin matches brute force', () => {
    const x = 3000, y = 3000, r = 500;
    const exp = g.nodes.filter((n) => Math.hypot(n.x - x, n.y - y) <= r).map((n) => n.id).sort((a, b) => a - b);
    expect(nodesWithin(g, x, y, r).sort((a, b) => a - b)).toEqual(exp);
  });
  it('respects maxR', () => {
    expect(nearestNode(g, -99999, -99999, 100)).toBe(-1);
  });
});

describe('spawn ring', () => {
  const world = cityGen(5);
  const g = world.laneGraph;
  const p = { x: 3000, y: 3000 };
  const view = { x: p.x - 960, y: p.y - 540, w: 1920, h: 1080 };
  const q: SpawnQuery = { players: [p], views: [view], occupied: [], minR: 1300, maxR: 2000, margin: 160, gap: 140 };

  it('spawnOk enforces ring, view and gap', () => {
    expect(spawnOk(p.x + 100, p.y, q)).toBe(false);          // too close / on screen
    expect(spawnOk(p.x + 1500, p.y, q)).toBe(true);
    expect(spawnOk(p.x + 2500, p.y, q)).toBe(false);         // too far
    expect(spawnOk(p.x + 1500, p.y, { ...q, occupied: [{ x: p.x + 1550, y: p.y }] })).toBe(false);
    expect(spawnOk(p.x, p.y + 1500, { ...q, views: [{ x: p.x - 100, y: p.y + 1400, w: 200, h: 200 }] })).toBe(false);
  });

  it('pickSpawnNode returns valid off-screen nodes in the ring', () => {
    const rng = new Rng(2);
    let found = 0;
    for (let i = 0; i < 50; i++) {
      const id = pickSpawnNode(g, q, rng);
      if (id < 0) continue;
      found++;
      const n = g.nodes[id];
      expect(n.next.length).toBeGreaterThan(0);
      expect(spawnOk(n.x, n.y, q)).toBe(true);
    }
    expect(found).toBeGreaterThan(30);
  });
});
