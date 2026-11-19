/** Pure jump rules (package N). Phaser-free. */

export interface RampLike { x: number; y: number; angle: number; w: number; h: number }

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Oriented-rect containment (same convention as world/geometry pointInRamp). */
export function insideRamp(r: RampLike, x: number, y: number): boolean {
  const dx = x - r.x, dy = y - r.y;
  const c = Math.cos(r.angle), s = Math.sin(r.angle);
  return Math.abs(dx * c + dy * s) <= r.w / 2 && Math.abs(-dx * s + dy * c) <= r.h / 2;
}

/** Heading is along the ramp axis (either direction) when |cos(diff)| > minCos. */
export function alignedWithRamp(heading: number, rampAngle: number, minCos: number): boolean {
  return Math.abs(Math.cos(heading - rampAngle)) > minCos;
}

export interface LaunchInput {
  inside: boolean;
  heading: number;
  rampAngle: number;
  forwardSpeed: number;
  maxSpeed: number;
  minSpeedFrac: number;
  minCos: number;
}

export function canLaunch(i: LaunchInput): boolean {
  return i.inside && alignedWithRamp(i.heading, i.rampAngle, i.minCos) && Math.abs(i.forwardSpeed) >= i.minSpeedFrac * i.maxSpeed;
}

export function airTime(speed: number, secPerSpeed: number, minSec: number, maxSec: number): number {
  return clamp(Math.abs(speed) * secPerSpeed, minSec, maxSec);
}

/** Parabola 0 -> 1 -> 0 for t in 0..1 (clamped). */
export function altitude(t: number): number {
  const u = clamp(t, 0, 1);
  return 4 * u * (1 - u);
}

/** Landing decision: fine when drivable, otherwise nudge to the nearest road point (if any). */
export function landingCorrection(drivable: boolean, road: { x: number; y: number } | null): { x: number; y: number } | null {
  return drivable ? null : road;
}
