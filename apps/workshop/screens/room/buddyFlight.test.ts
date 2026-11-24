import { describe, expect, it } from 'vitest';
import { WS_BUDDIES } from '../../config';
import { boardPerch, facesLeft, flightPose, pointAngle } from './buddyFlight';

const a = { x: 100, y: 500 };
const b = { x: 700, y: 300 };

describe('buddy flight', () => {
  it('starts at the start and ends at the end with the end angle', () => {
    const s = flightPose(a, b, 0, { side: 1, endAngle: -10 });
    const e = flightPose(a, b, 1, { side: 1, endAngle: -10 });
    expect(s.x).toBeCloseTo(a.x); expect(s.y).toBeCloseTo(a.y);
    expect(e.x).toBeCloseTo(b.x); expect(e.y).toBeCloseTo(b.y); expect(e.angle).toBeCloseTo(-10);
  });
  it('curves away from the straight line and mirrors with the side', () => {
    const l = flightPose(a, b, 0.5, { side: 1, endAngle: 0 });
    const r = flightPose(a, b, 0.5, { side: -1, endAngle: 0 });
    const cross = (p: { x: number; y: number }) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    expect(Math.abs(cross(l))).toBeGreaterThan(1000);
    expect(Math.sign(cross(l))).toBe(-Math.sign(cross(r)));
  });
  it('tilts along the path, within the clamp', () => {
    const mid = flightPose({ x: 0, y: 800 }, { x: 40, y: 0 }, 0.4, { side: 1, endAngle: 0 });
    expect(Math.abs(mid.angle)).toBeLessThanOrEqual(WS_BUDDIES.fly.maxTiltDeg + 1e-6);
    expect(Math.abs(mid.angle)).toBeGreaterThan(10);
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
