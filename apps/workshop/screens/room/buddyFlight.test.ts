import { describe, expect, it } from 'vitest';
import { WS_BUDDIES } from '../../config';
import { boardPerch, facesLeft, flightPose, pointAngle } from './buddyFlight';

const a = { x: 100, y: 500 };
const b = { x: 700, y: 300 };
const opts = { startAngle: 0, startFlipX: false, endAngle: -10, endFlipX: false };

describe('buddy flight', () => {
  it('starts at the start and ends at the end with the end angle', () => {
    const s = flightPose(a, b, 0, { ...opts, side: 1 });
    const e = flightPose(a, b, 1, { ...opts, side: 1 });
    expect(s.x).toBeCloseTo(a.x); expect(s.y).toBeCloseTo(a.y);
    expect(e.x).toBeCloseTo(b.x); expect(e.y).toBeCloseTo(b.y); expect(e.angle).toBeCloseTo(-10);
  });
  it('curves away from the straight line and mirrors with the side', () => {
    const l = flightPose(a, b, 0.5, { ...opts, side: 1 });
    const r = flightPose(a, b, 0.5, { ...opts, side: -1 });
    const cross = (p: { x: number; y: number }) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    expect(Math.abs(cross(l))).toBeGreaterThan(1000);
    expect(Math.sign(cross(l))).toBe(-Math.sign(cross(r)));
  });
  it('swings out on reversals at both ends and follows the tangent nose-first', () => {
    const target = { x: 500, y: a.y };
    const pose = (t: number) => flightPose(a, target, t, { ...opts, startFlipX: true, endFlipX: true, endAngle: 0, side: -1 });
    expect(pose(0.02).x).toBeLessThan(a.x);
    expect(pose(0.98).x).toBeGreaterThan(target.x);
    for (let i = 1; i < 100; i++) {
      const t = i / 100;
      const p = pose(t), before = pose(t - 0.00001), after = pose(t + 0.00001);
      const radians = p.angle * Math.PI / 180;
      const dot = (after.x - before.x) * Math.cos(radians) + (after.y - before.y) * Math.sin(radians);
      expect((p.flipX ? -dot : dot) / Math.hypot(after.x - before.x, after.y - before.y)).toBeCloseTo(1, 5);
    }
  });
  it('points up, down and sideways in either facing', () => {
    const o = { x: 500, y: 500 };
    expect(pointAngle(o, { x: 800, y: 500 }, false)).toBeCloseTo(0);
    expect(pointAngle(o, { x: 800, y: 200 }, false)).toBeLessThan(0);
    expect(pointAngle(o, { x: 800, y: 800 }, false)).toBeGreaterThan(0);
    expect(pointAngle(o, { x: 200, y: 200 }, true)).toBeGreaterThan(0);
    expect(pointAngle(o, { x: 200, y: 800 }, true)).toBeLessThan(0);
    expect(pointAngle(o, { x: 500, y: 0 }, false)).toBe(-WS_BUDDIES.fly.maxTiltDeg);
  });
  it('faces left only when the target is clearly left', () => {
    expect(facesLeft({ x: 500, y: 0 }, { x: 100, y: 0 }, false)).toBe(true);
    expect(facesLeft({ x: 500, y: 0 }, { x: 505, y: 90 }, true)).toBe(true);
  });
  it('perches above the board', () => {
    const p = boardPerch({ x: 960, y: 950, w: 620, h: 190 }, 170);
    expect(p.y).toBeLessThan(855);
  });
});
