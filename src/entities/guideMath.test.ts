import { describe, expect, it } from 'vitest';
import type { LaneGraph } from '../core/types';
import { distToPath, hoverSpot, nextGoalMode, orbitPoint, pointAlongPath, stepFly, trimPath, type FlyState } from './guideMath';
import { GUIDE } from '../config/gameConfig';

// L-shaped route: east along y=0 to x=400, then south to y=400
const graph: LaneGraph = {
  nodes: [
    { id: 0, x: 0, y: 0, next: [1] }, { id: 1, x: 200, y: 0, next: [2] },
    { id: 2, x: 400, y: 0, next: [3] }, { id: 3, x: 400, y: 200, next: [4] }, { id: 4, x: 400, y: 400, next: [] },
  ],
};
const path = [0, 1, 2, 3, 4];

describe('pointAlongPath', () => {
  it('walks along the first segment', () => {
    expect(pointAlongPath(graph, path, { x: 0, y: 0 }, 100)).toEqual({ x: 100, y: 0 });
  });
  it('turns the corner (look-ahead leads into the turn)', () => {
    const p = pointAlongPath(graph, [2, 3, 4], { x: 300, y: 0 }, 250);
    expect(p.x).toBeCloseTo(400); expect(p.y).toBeCloseTo(150);
  });
  it('returns the path end when shorter than the look-ahead', () => {
    expect(pointAlongPath(graph, [4], { x: 400, y: 300 }, 999)).toEqual({ x: 400, y: 400 });
  });
});

describe('trimPath', () => {
  it('drops nodes the car already passed', () => {
    expect(trimPath(graph, path, { x: 250, y: 3 })).toEqual([2, 3, 4]);
  });
  it('keeps the nearest node when the car is before it', () => {
    expect(trimPath(graph, path, { x: 150, y: 0 })).toEqual([1, 2, 3, 4]);
  });
});

describe('distToPath', () => {
  it('measures to the polyline', () => {
    expect(distToPath(graph, path, { x: 100, y: 50 })).toBeCloseTo(50);
    expect(distToPath(graph, path, { x: 450, y: 100 })).toBeCloseTo(50);
  });
  it('is Infinity for an empty path', () => { expect(distToPath(graph, [], { x: 0, y: 0 })).toBe(Infinity); });
});

describe('hoverSpot', () => {
  it('is holdDist from the car toward the target', () => {
    const p = hoverSpot({ x: 10, y: 10 }, { x: 10, y: 500 }, 170);
    expect(p).toEqual({ x: 10, y: 180 });
  });
  it('never sits on the car when the target coincides', () => {
    const p = hoverSpot({ x: 0, y: 0 }, { x: 0, y: 0 }, 150, Math.PI);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(150);
  });
});

describe('goal mode', () => {
  const t = GUIDE;
  it('enters near, has hysteresis, and sticks once arrived', () => {
    expect(nextGoalMode(false, 449, false, t)).toBe(true);
    expect(nextGoalMode(false, 500, false, t)).toBe(false);
    expect(nextGoalMode(true, 500, false, t)).toBe(true);
    expect(nextGoalMode(true, 700, false, t)).toBe(false);
    expect(nextGoalMode(false, 5000, true, t)).toBe(true);
  });
  it('orbit is at the given radius', () => {
    const p = orbitPoint({ x: 100, y: 100 }, 1.2, 95);
    expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(95);
  });
});

describe('stepFly', () => {
  it('converges to a still target', () => {
    const s: FlyState = { x: 0, y: 0, vx: 0, vy: 0 };
    for (let i = 0; i < 240; i++) stepFly(s, { x: 300, y: -100 }, { x: 0, y: 0 }, 1 / 60, GUIDE);
    expect(Math.hypot(s.x - 300, s.y + 100)).toBeLessThan(1);
  });
  it('keeps up with a turbo car (990 px/s) with a bounded lag', () => {
    const s: FlyState = { x: 170, y: 0, vx: 990, vy: 0 };
    let car = 0;
    for (let i = 0; i < 300; i++) { car += 990 / 60; stepFly(s, { x: car + 170, y: 0 }, { x: 990, y: 0 }, 1 / 60, GUIDE); }
    expect(Math.abs(s.x - (car + 170))).toBeLessThan(40);
  });
  it('clamps speed to maxSpeed', () => {
    const s: FlyState = { x: 0, y: 0, vx: 0, vy: 0 };
    stepFly(s, { x: 1e6, y: 0 }, { x: 0, y: 0 }, 1, GUIDE);
    for (let i = 0; i < 60; i++) stepFly(s, { x: 1e6, y: 0 }, { x: 0, y: 0 }, 1 / 60, GUIDE);
    expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(GUIDE.maxSpeed + 1e-6);
  });
});
