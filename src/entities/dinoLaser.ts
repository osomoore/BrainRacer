/** Pure dino laser-eye logic: timing state machine, sweep angle, beam hit tests. No Phaser. */
import type { Vec2 } from '../core/types';

export type LaserPhase = 'idle' | 'charge' | 'fire';

export interface LaserState {
  phase: LaserPhase;
  /** Seconds spent in the current charge/fire phase. */
  t: number;
  /** Seconds until the next shot may start (idle only). */
  cooldown: number;
  /** World angle the sweep is centred on. */
  baseAngle: number;
  /** +1 sweeps toward increasing angle, -1 the other way. */
  dir: 1 | -1;
}

export interface LaserTiming { chargeSec: number; fireSec: number; arc: number }

export function newLaser(cooldown: number): LaserState {
  return { phase: 'idle', t: 0, cooldown, baseAngle: 0, dir: 1 };
}

/** Ready to start a shot (idle, cooldown elapsed, and the caller says conditions allow it). */
export function laserReady(s: LaserState, canFire: boolean): boolean {
  return canFire && s.phase === 'idle' && s.cooldown <= 0;
}

export function startLaser(s: LaserState, baseAngle: number, dir: 1 | -1): void {
  s.phase = 'charge'; s.t = 0; s.baseAngle = baseAngle; s.dir = dir;
}

/** Hard stop (dino hurt / leaving): back to idle with the given cooldown. */
export function cancelLaser(s: LaserState, cooldown: number): void {
  s.phase = 'idle'; s.t = 0; s.cooldown = cooldown;
}

/**
 * Advance the machine. Returns 'fire' on the frame the beams switch on, 'ended' on the frame
 * they switch off (the caller then sets the next cooldown), else null.
 */
export function stepLaser(s: LaserState, dt: number, tm: LaserTiming): 'fire' | 'ended' | null {
  if (s.phase === 'idle') { s.cooldown -= dt; return null; }
  s.t += dt;
  if (s.phase === 'charge' && s.t >= tm.chargeSec) { s.phase = 'fire'; s.t = 0; return 'fire'; }
  if (s.phase === 'fire' && s.t >= tm.fireSec) { s.phase = 'idle'; s.t = 0; s.cooldown = Infinity; return 'ended'; }
  return null;
}

/** 0..1 charge progress (eye glow), 0 outside charge. */
export function chargeFrac(s: LaserState, tm: LaserTiming): number {
  return s.phase === 'charge' ? Math.min(1, s.t / tm.chargeSec) : 0;
}

/** Sweep angle at the current time: constant angular speed from base-dir*arc/2 to base+dir*arc/2. */
export function sweepAngle(s: LaserState, tm: LaserTiming): number {
  const k = s.phase === 'fire' ? Math.min(1, s.t / tm.fireSec) : 0;
  return s.baseAngle + s.dir * (-tm.arc / 2 + tm.arc * k);
}

/** Angular speed of the sweep, rad/s. */
export function sweepSpeed(tm: LaserTiming): number { return tm.arc / tm.fireSec; }

/** Eye positions: `fwd` ahead of the dino centre, `side` apart (each side), rotated by heading. */
export function eyePositions(x: number, y: number, heading: number, fwd: number, side: number): [Vec2, Vec2] {
  const c = Math.cos(heading), s = Math.sin(heading);
  return [
    { x: x + c * fwd + s * side, y: y + s * fwd - c * side },
    { x: x + c * fwd - s * side, y: y + s * fwd + c * side },
  ];
}

/** Distance from point p to segment a-b. */
export function distToSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const k = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + k * dx), py - (ay + k * dy));
}

/** Does a beam from `from` at `angle`, `length` long and `halfWidth` wide, touch a circle? */
export function beamHitsCircle(from: Vec2, angle: number, length: number, halfWidth: number, p: Vec2, r: number): boolean {
  return distToSegment(from.x, from.y, from.x + Math.cos(angle) * length, from.y + Math.sin(angle) * length, p.x, p.y) <= halfWidth + r;
}

/** Unit normal of the beam pointing away from it toward p (for pushing things sideways out of the beam). */
export function beamSideNormal(angle: number, from: Vec2, p: Vec2): Vec2 {
  const nx = -Math.sin(angle), ny = Math.cos(angle);
  const side = (p.x - from.x) * nx + (p.y - from.y) * ny >= 0 ? 1 : -1;
  return { x: nx * side, y: ny * side };
}
