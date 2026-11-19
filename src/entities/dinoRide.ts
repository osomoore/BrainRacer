/** Pure rules for beating and riding the dino (no Phaser). */
import type { Vec2 } from '../core/types';

/** How many hits one ram is worth: a TEAM hit (both players close together in time) counts `teamHits`. */
export function hitValue(team: boolean, teamHits: number): number {
  return team ? Math.max(1, teamHits) : 1;
}

/** Add a hit (capped at `toDefeat`). */
export function addHits(hits: number, value: number, toDefeat: number): { hits: number; defeated: boolean } {
  const next = Math.min(toDefeat, hits + value);
  return { hits: next, defeated: next >= toDefeat };
}

/** Health bar fraction: 1 = untouched, 0 = beaten. */
export function healthFrac(hits: number, toDefeat: number): number {
  return Math.max(0, Math.min(1, 1 - hits / Math.max(1, toDefeat)));
}

export interface RideTimer { left: number; total: number }

export function newRideTimer(sec: number): RideTimer { return { left: sec, total: sec }; }

/** Count the ride down unless frozen (the rider is answering a question). Returns true on the frame it runs out. */
export function stepRide(t: RideTimer, dt: number, frozen: boolean): boolean {
  if (frozen || t.left <= 0) return false;
  t.left = Math.max(0, t.left - dt);
  return t.left === 0;
}

/** Whole seconds shown on the countdown (20.0 → 20, 0.2 → 1, 0 → 0). */
export function rideSecondsShown(left: number): number { return Math.max(0, Math.ceil(left - 1e-6)); }

export interface DinoBoardState { active: boolean; tamed?: boolean; rider?: number | null }

/** Can someone hop on right now? Only a tame dino with no rider. */
export function dinoBoardable(d: DinoBoardState): boolean {
  return d.active && !!d.tamed && (d.rider === null || d.rider === undefined);
}

/** Distance from a car to the dino's "edge" for the boarding reach test (like a vehicle's half length). */
export function dinoBoardDistance(dino: Vec2, car: Vec2, halfLength: number): number {
  return Math.hypot(dino.x - car.x, dino.y - car.y) - halfLength;
}

/** After the ride: hop back into the car you left if it still exists, works and is close enough; else respawn. */
export function returnChoice(own: { x: number; y: number; usable: boolean } | null, here: Vec2, maxDist: number): 'own' | 'respawn' {
  if (!own || !own.usable) return 'respawn';
  return Math.hypot(own.x - here.x, own.y - here.y) <= maxDist ? 'own' : 'respawn';
}

/** Clamp a point into a rectangle shrunk by `pad`. Returns null when it is already inside. */
export function clampInside(p: Vec2, w: number, h: number, pad: number): Vec2 | null {
  const x = Math.max(pad, Math.min(w - pad, p.x));
  const y = Math.max(pad, Math.min(h - pad, p.y));
  return x === p.x && y === p.y ? null : { x, y };
}
