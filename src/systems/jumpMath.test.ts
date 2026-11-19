import { describe, expect, it } from 'vitest';
import { airTime, altitude, canLaunch, insideRamp, landingCorrection } from './jumpMath';

const base = { inside: true, heading: 0, rampAngle: 0, forwardSpeed: 300, maxSpeed: 600, minSpeedFrac: 0.4, minCos: 0.5 };

describe('jumpMath', () => {
  it('launches when fast, inside, aligned', () => expect(canLaunch(base)).toBe(true));
  it('not when slow', () => expect(canLaunch({ ...base, forwardSpeed: 200 })).toBe(false));
  it('not when outside', () => expect(canLaunch({ ...base, inside: false })).toBe(false));
  it('not when sideways', () => expect(canLaunch({ ...base, heading: Math.PI / 2 })).toBe(false));
  it('either direction along axis', () => expect(canLaunch({ ...base, heading: Math.PI })).toBe(true));
  it('insideRamp oriented', () => {
    const r = { x: 0, y: 0, angle: Math.PI / 2, w: 128, h: 96 };
    expect(insideRamp(r, 0, 60)).toBe(true);
    expect(insideRamp(r, 60, 0)).toBe(false);
  });
  it('airTime clamps', () => {
    expect(airTime(10, 1 / 600, 0.5, 1.6)).toBe(0.5);
    expect(airTime(600, 1 / 600, 0.5, 1.6)).toBeCloseTo(1);
    expect(airTime(5000, 1 / 600, 0.5, 1.6)).toBe(1.6);
  });
  it('altitude parabola', () => {
    expect(altitude(0)).toBe(0);
    expect(altitude(0.5)).toBe(1);
    expect(altitude(1)).toBe(0);
    expect(altitude(2)).toBe(0);
  });
  it('landing correction', () => {
    expect(landingCorrection(true, { x: 1, y: 1 })).toBeNull();
    expect(landingCorrection(false, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
    expect(landingCorrection(false, null)).toBeNull();
  });
});
