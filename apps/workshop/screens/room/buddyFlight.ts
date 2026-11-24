/** Pure (Phaser-free) buddy flight maths for the room: a gently looping curved path with the buddy angled along it. */
import { WS_BUDDIES } from '../../config';

export interface FlightPoint { x: number; y: number }
export interface FlightOpts {
  /** +1 / -1: which side the arc bulges to. */
  side: 1 | -1;
  /** Facing (mirrored) at the end of the flight; defaults to the direction of travel. */
  endFlipX?: boolean;
  /** Final tilt in degrees (already in the end facing's frame); blended in over the last part of the flight. */
  endAngle: number;
}
export interface FlightPose { x: number; y: number; angle: number; flipX: boolean }

const DEG = 180 / Math.PI;
const smooth = (v: number) => { const c = Math.max(0, Math.min(1, v)); return c * c * (3 - 2 * c); };

/** Tilt (degrees, sprite faces +x; mirrored when `flipX`) that makes the buddy point from `from` at `target`, clamped for kids' readability. */
export function pointAngle(from: FlightPoint, target: FlightPoint, flipX: boolean): number {
  return tilt(target.x - from.x, target.y - from.y, flipX);
}

function tilt(dx: number, dy: number, flipX: boolean): number {
  const a = Math.atan2(dy, flipX ? -dx : dx) * DEG;
  const c = WS_BUDDIES.fly.maxTiltDeg;
  return Math.max(-c, Math.min(c, flipX ? -a : a));
}

/** Whether the buddy faces left when pointing at `target` from `from` (keeps `current` when almost straight above/below). */
export function facesLeft(from: FlightPoint, target: FlightPoint, current: boolean): boolean {
  const dx = target.x - from.x;
  return Math.abs(dx) < WS_BUDDIES.fly.flipDeadPx ? current : dx < 0;
}

function pathAt(a: FlightPoint, b: FlightPoint, t: number, side: number): FlightPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d;
  const ny = dx / d;
  const f = WS_BUDDIES.fly;
  const arc = Math.min(d * f.arc, f.maxOffsetPx) * Math.sin(Math.PI * t);
  const loop = Math.min(d * f.loop, f.maxOffsetPx) * Math.sin(2 * Math.PI * t) * Math.sin(Math.PI * t);
  const off = side * arc + loop;
  return { x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off };
}

/** Pose at progress t (0..1, already eased) of a flight from `a` to `b`. */
export function flightPose(a: FlightPoint, b: FlightPoint, t: number, o: FlightOpts): FlightPose {
  const f = WS_BUDDIES.fly;
  const flipX = o.endFlipX ?? b.x < a.x;
  const p = pathAt(a, b, t, o.side);
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1) return { x: b.x, y: b.y, angle: o.endAngle, flipX };
  const e = 0.01;
  const p0 = pathAt(a, b, Math.max(0, t - e), o.side);
  const p1 = pathAt(a, b, Math.min(1, t + e), o.side);
  const heading = tilt(p1.x - p0.x, p1.y - p0.y, flipX);
  const w = smooth((t - f.settleFrom) / (1 - f.settleFrom));
  const angle = heading + (o.endAngle - heading) * w;
  return { x: p.x, y: p.y, angle, flipX };
}

/** Where the buddy hovers to point at the challenge board: above its right end, looking down at it. */
export function boardPerch(board: { x: number; y: number; w: number; h: number }, size: number): FlightPoint {
  return { x: board.x + board.w / 2 + size * 0.1, y: board.y - board.h / 2 - size * 0.45 };
}
