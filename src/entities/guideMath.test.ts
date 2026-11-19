import { describe, expect, it } from 'vitest';
import { edgeHoldDist, hoverSpot, nextGoalMode, obstacleDist, orbitPoint, stepFly, viewEdgeDist, type FlyState } from './guideMath';
import { GUIDE } from '../config/gameConfig';

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

describe('viewEdgeDist / edgeHoldDist', () => {
  const full = { x: 0, y: 0, w: 1920, h: 1080 };
  const half = { x: 0, y: 0, w: 960, h: 1080 };
  const car = { x: 960, y: 562 };
  it('measures straight up, left and right', () => {
    expect(viewEdgeDist(car, { x: 0, y: -1 }, full)).toBeCloseTo(562);
    expect(viewEdgeDist(car, { x: 1, y: 0 }, full)).toBeCloseTo(960);
    expect(viewEdgeDist({ x: 480, y: 562 }, { x: 1, y: 0 }, half)).toBeCloseTo(480);
    expect(viewEdgeDist({ x: 480, y: 562 }, { x: -1, y: 0 }, half)).toBeCloseTo(480);
  });
  it('takes the nearer edge on a diagonal', () => {
    const d = Math.SQRT1_2;
    expect(viewEdgeDist(car, { x: d, y: -d }, full)).toBeCloseTo(562 / d);
    expect(viewEdgeDist(car, { x: d, y: d }, full)).toBeCloseTo(518 / d);
  });
  it('gives Infinity-safe fallback and clamps', () => {
    expect(viewEdgeDist(car, { x: 0, y: 0 }, full)).toBe(Infinity);
    expect(edgeHoldDist(Infinity, 0.8, 100, 1, 170, 700)).toBe(170);
    expect(edgeHoldDist(500, 0.8, 100, 1, 170, 700)).toBeCloseTo(400);
    expect(edgeHoldDist(500, 0.8, 100, 0.5, 170, 700)).toBe(700);   // zoomed out: more world px, capped
    expect(edgeHoldDist(150, 0.8, 100, 1, 170, 700)).toBe(170);     // tiny view: never below min
  });
  it('keeps the margin from the edge', () => {
    expect(edgeHoldDist(300, 0.9, 120, 1, 50, 700)).toBeCloseTo(180);
  });
});

it('limits guide travel only on rays that cross the scoreboard', () => {
  const board = { x: 20, y: 10, w: 400, h: 194 };
  const car = { x: 600, y: 562 };
  const d = Math.SQRT1_2;
  expect(obstacleDist(car, { x: -d, y: -d }, board)).toBeCloseTo((562 - 204) / d);
  expect(obstacleDist(car, { x: 0, y: -1 }, board)).toBe(Infinity);
});
