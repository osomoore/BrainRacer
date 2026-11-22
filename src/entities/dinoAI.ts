/** Pure dino AI: waypoint choice, turn-limited steering, capsule hit test. No Phaser. */
import type { Vec2 } from '../core/types';

export interface RngLike { next(): number }

export interface WaypointOpts {
  goalChance: number;
  goalRadius: number;
  minDist: number;
  /** Optional clamp rectangle. */
  bounds?: { x: number; y: number; w: number; h: number };
}

export function dist(a: Vec2, b: Vec2): number { return Math.hypot(a.x - b.x, a.y - b.y); }

function clampTo(p: Vec2, b?: WaypointOpts['bounds']): Vec2 {
  if (!b) return p;
  return { x: Math.min(b.x + b.w, Math.max(b.x, p.x)), y: Math.min(b.y + b.h, Math.max(b.y, p.y)) };
}

/**
 * Pick the next waypoint. With `goalChance` a point within `goalRadius` of the goal, otherwise a random site.
 * Never within `minDist` of `pos` (falls back to a point minDist away if nothing qualifies).
 */
export function chooseWaypoint(rng: RngLike, pos: Vec2, goal: Vec2 | null, sites: readonly Vec2[], o: WaypointOpts): Vec2 {
  for (let i = 0; i < 24; i++) {
    let c: Vec2 | null = null;
    if (goal && rng.next() < o.goalChance) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next()) * o.goalRadius;
      c = clampTo({ x: goal.x + Math.cos(a) * r, y: goal.y + Math.sin(a) * r }, o.bounds);
    } else if (sites.length > 0) {
      const s = sites[Math.floor(rng.next() * sites.length) % sites.length];
      c = { x: s.x, y: s.y };
    }
    if (c && dist(c, pos) >= o.minDist) return c;
  }
  const a = rng.next() * Math.PI * 2;
  return clampTo({ x: pos.x + Math.cos(a) * o.minDist * 1.2, y: pos.y + Math.sin(a) * o.minDist * 1.2 }, o.bounds);
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export interface DinoWalk { x: number; y: number; angle: number; pauseLeft: number }
export interface SteerOpts { speed: number; turnRate: number; arriveRadius: number; pauseSec: number }

/**
 * Advance the walker. Returns 'arrived' on the frame it reaches the waypoint (pause starts),
 * 'paused' while looking around, else 'walking'. Turn rate is limited; speed is constant
 * except it eases while facing far away from the target so it never orbits it.
 */
export function steer(w: DinoWalk, target: Vec2, dt: number, o: SteerOpts): 'walking' | 'paused' | 'arrived' {
  if (w.pauseLeft > 0) { w.pauseLeft -= dt; return 'paused'; }
  const dx = target.x - w.x, dy = target.y - w.y;
  const d = Math.hypot(dx, dy);
  if (d <= o.arriveRadius) { w.pauseLeft = o.pauseSec; return 'arrived'; }
  const diff = wrapAngle(Math.atan2(dy, dx) - w.angle);
  const maxTurn = o.turnRate * dt;
  w.angle = wrapAngle(w.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)));
  const ease = Math.abs(diff) > 0.6 ? 0.45 : 1;
  w.x += Math.cos(w.angle) * o.speed * ease * dt;
  w.y += Math.sin(w.angle) * o.speed * ease * dt;
  return 'walking';
}

export interface Capsule { ax: number; ay: number; bx: number; by: number; r: number }

/** Capsule along the heading: `front` px ahead of the body centre to `back` px behind it. */
export function dinoCapsule(x: number, y: number, angle: number, front: number, back: number, r: number): Capsule {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { ax: x - c * back, ay: y - s * back, bx: x + c * front, by: y + s * front, r };
}

/** Closest point on the capsule's segment to (px, py). */
export function closestOnSegment(c: Capsule, px: number, py: number): Vec2 {
  const sx = c.bx - c.ax, sy = c.by - c.ay;
  const l2 = sx * sx + sy * sy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - c.ax) * sx + (py - c.ay) * sy) / l2));
  return { x: c.ax + sx * t, y: c.ay + sy * t };
}

/** True if a circle (px, py, pr) touches the capsule. */
export function capsuleHit(c: Capsule, px: number, py: number, pr = 0): boolean {
  const q = closestOnSegment(c, px, py);
  return Math.hypot(px - q.x, py - q.y) <= c.r + pr;
}

/** Spawn time check. */
export function shouldSpawn(elapsedSec: number, roundLengthSec: number, fraction: number): boolean {
  return elapsedSec >= roundLengthSec * fraction;
}

/** Point on the guard loop around `center` at angle `phase`. */
export function patrolPoint(center: Vec2, loopRadius: number, phase: number): Vec2 {
  return { x: center.x + Math.cos(phase) * loopRadius, y: center.y + Math.sin(phase) * loopRadius };
}

export interface RamCfg {
  minSpeed: number; speedMax: number; dmgMin: number; dmgMax: number; turboMult: number; teamMult: number;
}

/** Damage from a ram at `speed` px/s (0 below the minimum speed). */
export function ramDamage(speed: number, turbo: boolean, team: boolean, c: RamCfg): number {
  if (speed < c.minSpeed) return 0;
  const k = Math.min(1, (speed - c.minSpeed) / Math.max(1, c.speedMax - c.minSpeed));
  let d = c.dmgMin + (c.dmgMax - c.dmgMin) * k;
  if (turbo) d *= c.turboMult;
  if (team) d *= c.teamMult;
  return d;
}

/** True if the other player hit within `window` sec before `now`. */
export function isTeamHit(otherLastHit: number, now: number, window: number): boolean {
  return now - otherLastHit <= window;
}

/** N-player team hit: some player other than `id` hit within `window` sec before `now`. */
export function isTeamHitBy(lastHit: readonly number[], id: number, now: number, window: number): boolean {
  for (let i = 0; i < lastHit.length; i++) if (i !== id && isTeamHit(lastHit[i], now, window)) return true;
  return false;
}

export function isDefeated(hp: number): boolean { return hp <= 0; }

export interface OrbitOpts {
  speed: number; turnRate: number;
  /** Mean orbit radius, breathing amplitude (px) and frequency (rad/s). */
  radius: number; breathe: number; breatheW: number;
  /** Look-ahead along the circle (rad) when on the orbit. */
  lookahead: number;
  /** Radial error (px) beyond which it heads straight back to the circle. */
  returnTol: number;
}

/**
 * Steady slow circle around `center`: steers (turn-limited) toward a point a little ahead on a gently
 * breathing circle; when displaced it blends to heading straight at the nearest orbit point.
 * Speed is constant (never above `speed`). `t` is the clock in seconds.
 */
export function orbitStep(w: DinoWalk, center: Vec2, t: number, dt: number, o: OrbitOpts): void {
  const dx = w.x - center.x, dy = w.y - center.y;
  const d = Math.hypot(dx, dy);
  const a = d < 1e-3 ? w.angle : Math.atan2(dy, dx);
  const r = o.radius + Math.sin(t * o.breatheW) * o.breathe;
  const err = Math.abs(d - r);
  const look = o.lookahead * Math.max(0, 1 - err / o.returnTol);
  const ta = a + look;
  const tx = center.x + Math.cos(ta) * r, ty = center.y + Math.sin(ta) * r;
  const diff = wrapAngle(Math.atan2(ty - w.y, tx - w.x) - w.angle);
  const maxTurn = o.turnRate * dt;
  w.angle = wrapAngle(w.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)));
  const ease = Math.abs(diff) > 1.0 ? 0.5 : 1;
  w.x += Math.cos(w.angle) * o.speed * ease * dt;
  w.y += Math.sin(w.angle) * o.speed * ease * dt;
}
