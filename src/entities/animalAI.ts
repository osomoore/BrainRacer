/**
 * Pure farm-animal behaviour (no Phaser). AnimalSystem owns sprites/bodies and calls these.
 * Everything is seeded (Rng) and frame-rate independent.
 */
import { ANIMALS } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type { FarmAnimalKind, Vec2 } from '../core/types';

export type AnimalMode = 'graze' | 'walk' | 'flee' | 'fly' | 'daze' | 'return';

export interface Rect2 { x: number; y: number; w: number; h: number }

export interface AnimalAI {
  kind: FarmAnimalKind;
  x: number; y: number;
  /** Heading (rad, 0 = +x). */
  angle: number;
  mode: AnimalMode;
  /** Seconds left in graze / walk / flee. */
  timer: number;
  /** Seconds elapsed in fly / daze. */
  t: number;
  tx: number; ty: number;
  zone: Rect2;
  fenced: boolean;
  /** Walk-cycle distance accumulator. */
  walked: number;
  /** Flight start, end, duration. */
  fx0: number; fy0: number; fx1: number; fy1: number; fdur: number;
  /** Duck line: follow this animal when marching, else null. */
  leader: AnimalAI | null;
  rank: number;
  /** Moving at run speed (chicken burst / flee). */
  hurry: boolean;
}

const spec = (k: FarmAnimalKind) => ANIMALS.kinds[k];
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Allowed center rect for an animal of `kind` in `zone`. Fenced: strictly inside; free: a little slack. */
export function allowedRect(zone: Rect2, kind: FarmAnimalKind, fenced: boolean): Rect2 {
  const half = Math.max(spec(kind).w, spec(kind).h) / 2;
  const m = fenced ? ANIMALS.zoneMargin + half : half - ANIMALS.looseSlack;
  const mx = Math.min(m, zone.w / 2 - 1), my = Math.min(m, zone.h / 2 - 1);
  return { x: zone.x + mx, y: zone.y + my, w: zone.w - 2 * mx, h: zone.h - 2 * my };
}

export function clampToRect(p: Vec2, r: Rect2): Vec2 {
  return { x: clamp(p.x, r.x, r.x + r.w), y: clamp(p.y, r.y, r.y + r.h) };
}
export const insideRect = (x: number, y: number, r: Rect2) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export function newAnimal(rng: Rng, kind: FarmAnimalKind, zone: Rect2, fenced: boolean): AnimalAI {
  const r = allowedRect(zone, kind, fenced);
  const a: AnimalAI = {
    kind, x: rng.range(r.x, r.x + r.w), y: rng.range(r.y, r.y + r.h), angle: rng.range(-Math.PI, Math.PI),
    mode: 'graze', timer: 0, t: 0, tx: 0, ty: 0, zone: { x: zone.x, y: zone.y, w: zone.w, h: zone.h }, fenced,
    walked: 0, fx0: 0, fy0: 0, fx1: 0, fy1: 0, fdur: 1, leader: null, rank: 0, hurry: false,
  };
  a.timer = rng.range(0, 3); // stagger so a herd does not move in sync
  a.tx = a.x; a.ty = a.y;
  return a;
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Pick a nearby wander target inside the allowed rect. */
export function pickTarget(rng: Rng, a: AnimalAI, reach = 160): Vec2 {
  const r = allowedRect(a.zone, a.kind, a.fenced);
  const ang = rng.range(-Math.PI, Math.PI);
  const d = rng.range(reach * 0.3, reach);
  return clampToRect({ x: a.x + Math.cos(ang) * d, y: a.y + Math.sin(ang) * d }, r);
}

/** Unit direction pointing away from a threat. */
export function fleeDir(ax: number, ay: number, tx: number, ty: number): Vec2 {
  const dx = ax - tx, dy = ay - ty, d = Math.hypot(dx, dy);
  if (d < 1e-6) return { x: 1, y: 0 };
  return { x: dx / d, y: dy / d };
}

export function startFlee(rng: Rng, a: AnimalAI, threatX: number, threatY: number, sec: number): void {
  const dir = fleeDir(a.x, a.y, threatX, threatY);
  const j = rng.range(-0.5, 0.5), c = Math.cos(j), s = Math.sin(j); // sideways jitter so a herd does not run in a perfect line
  const dx = dir.x * c - dir.y * s, dy = dir.x * s + dir.y * c;
  const run = spec(a.kind).run;
  const r = allowedRect(a.zone, a.kind, a.fenced);
  const p = clampToRect({ x: a.x + dx * run * sec, y: a.y + dy * run * sec }, r);
  a.mode = 'flee'; a.timer = sec; a.tx = p.x; a.ty = p.y; a.hurry = true;
}

function startGraze(rng: Rng, a: AnimalAI): void {
  const [lo, hi] = spec(a.kind).grazeSec;
  a.mode = 'graze'; a.timer = rng.range(lo, hi); a.hurry = false;
}

/** Where a following duck wants to be: behind its leader along the leader's heading. */
export function followTarget(a: AnimalAI): Vec2 {
  const l = a.leader!;
  const d = ANIMALS.duckSpacing * a.rank;
  return { x: l.x - Math.cos(l.angle) * d, y: l.y - Math.sin(l.angle) * d };
}

function startWalk(rng: Rng, a: AnimalAI): void {
  const s = spec(a.kind);
  a.mode = 'walk'; a.timer = rng.range(s.walkSec[0], s.walkSec[1]);
  a.hurry = a.kind === 'chicken'; // chickens move in quick bursts
  if (a.kind === 'duck' && a.leader) {
    const t = followTarget(a);
    a.tx = t.x; a.ty = t.y;
    return;
  }
  const cross = a.kind === 'duck' && !a.fenced && rng.chance(ANIMALS.duckCrossChance);
  if (cross) {
    // a leader duck marches out of the zone, the followers queue up behind it
    const ang = rng.range(-Math.PI, Math.PI);
    a.tx = a.x + Math.cos(ang) * ANIMALS.duckCrossReach; a.ty = a.y + Math.sin(ang) * ANIMALS.duckCrossReach;
    a.timer = ANIMALS.duckCrossReach / s.walk + 0.5;
    return;
  }
  const t = pickTarget(rng, a, a.kind === 'chicken' ? 70 : 170);
  a.tx = t.x; a.ty = t.y;
}

/** Move toward (tx,ty) at `speed`; returns true when arrived. Turns smoothly. */
export function moveToward(a: AnimalAI, dt: number, speed: number): boolean {
  const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
  if (d < 3) return true;
  const want = Math.atan2(dy, dx);
  const diff = wrapAngle(want - a.angle);
  const maxTurn = (a.hurry ? 12 : 5) * dt;
  a.angle = wrapAngle(a.angle + clamp(diff, -maxTurn, maxTurn));
  if (Math.abs(diff) < 1.2) {
    const step = Math.min(d, speed * dt);
    a.x += Math.cos(a.angle) * step; a.y += Math.sin(a.angle) * step;
    a.walked += step;
  }
  return false;
}

/** Walk-cycle frame 0..2 from distance walked (0 when standing). */
export function walkFrame(a: AnimalAI): number {
  const moving = a.mode === 'walk' || a.mode === 'flee' || a.mode === 'return';
  if (!moving) return 0;
  const stride = Math.max(5, spec(a.kind).stepPx * (a.hurry ? 0.6 : 1));
  return 1 + (Math.floor(a.walked / stride) % 2);
}

/** Head back to the nearest point inside the allowed zone rect. */
export function startReturn(a: AnimalAI): void {
  const p = nearestInside(a);
  a.mode = 'return'; a.tx = p.x; a.ty = p.y; a.hurry = false;
}

export function nearestInside(a: AnimalAI): Vec2 {
  return clampToRect({ x: a.x, y: a.y }, allowedRect(a.zone, a.kind, a.fenced));
}

/** Per-frame wander / flee / return / daze logic for a ground animal. Fly is handled by stepFlight. */
export function stepGround(rng: Rng, a: AnimalAI, dt: number): void {
  const s = spec(a.kind);
  const r = allowedRect(a.zone, a.kind, a.fenced);
  switch (a.mode) {
    case 'graze':
      a.timer -= dt;
      if (a.timer <= 0) {
        if (insideRect(a.x, a.y, r)) startWalk(rng, a); else startReturn(a); // e.g. ducks back from a lane crossing
      }
      break;
    case 'walk': {
      if (a.kind === 'duck' && a.leader) { const t = followTarget(a); a.tx = t.x; a.ty = t.y; }
      const arrived = moveToward(a, dt, a.hurry ? s.run * 0.5 : s.walk);
      a.timer -= dt;
      if (arrived || a.timer <= 0) startGraze(rng, a);
      break;
    }
    case 'flee': {
      const arrived = moveToward(a, dt, s.run);
      a.timer -= dt;
      if (arrived || a.timer <= 0) { startGraze(rng, a); a.timer *= 0.4; }
      break;
    }
    case 'daze':
      a.t += dt;
      if (a.t >= ANIMALS.launch.dazeSec) {
        if (!insideRect(a.x, a.y, r)) startReturn(a);
        else startGraze(rng, a);
      }
      break;
    case 'return': {
      a.hurry = false;
      const arrived = moveToward(a, dt, s.walk * 2.2);
      if (arrived || insideRect(a.x, a.y, r)) startGraze(rng, a);
      break;
    }
    case 'fly': break;
  }
  if (a.mode === 'flee' || (a.mode === 'walk' && !(a.kind === 'duck' && !a.fenced))) {
    // hard clamp into the allowed rect (fenced strictly; free zones already include slack). Crossing ducks are exempt.
    const c = clampToRect({ x: a.x, y: a.y }, r);
    a.x = c.x; a.y = c.y;
  }
}

/** Launch direction: blend the car's heading with straight-away-from-car, normalized. */
export function launchDir(ax: number, ay: number, cx: number, cy: number, carDirX: number, carDirY: number): Vec2 {
  const away = fleeDir(ax, ay, cx, cy);
  const b = ANIMALS.launchHeadingBlend;
  const hl = Math.hypot(carDirX, carDirY);
  const hx = hl > 1e-6 ? carDirX / hl : away.x, hy = hl > 1e-6 ? carDirY / hl : away.y;
  const x = hx * b + away.x * (1 - b), y = hy * b + away.y * (1 - b);
  const l = Math.hypot(x, y);
  return l < 1e-6 ? away : { x: x / l, y: y / l };
}

export function launchDistance(carSpeed: number): number {
  const L = ANIMALS.launch;
  return clamp(Math.abs(carSpeed) * L.distPerSpeed, L.minDist, L.maxDist);
}

/** Begin a cartoon flight. `landOk` rejects bad landing spots (water / off the map); the distance shrinks until OK. */
export function startFlight(a: AnimalAI, dirX: number, dirY: number, carSpeed: number, landOk: (x: number, y: number) => boolean): void {
  let d = launchDistance(carSpeed);
  let x1 = a.x + dirX * d, y1 = a.y + dirY * d;
  for (let i = 0; i < 6 && !landOk(x1, y1); i++) { d *= 0.7; x1 = a.x + dirX * d; y1 = a.y + dirY * d; }
  if (!landOk(x1, y1)) { x1 = a.x; y1 = a.y; }
  a.mode = 'fly'; a.t = 0; a.hurry = false;
  a.fx0 = a.x; a.fy0 = a.y; a.fx1 = x1; a.fy1 = y1; a.fdur = ANIMALS.launch.airSec;
  a.angle = Math.atan2(dirY, dirX);
}

export interface FlightPose { x: number; y: number; /** 0 on the ground .. 1 at the apex */ height: number; scale: number; spin: number; landed: boolean }

/** Pose `t` seconds into a flight: straight path, parabolic height (scale up then down), spin, small landing bounce. */
export function flightPose(a: AnimalAI, t: number): FlightPose {
  const L = ANIMALS.launch;
  const u = clamp(t / a.fdur, 0, 1);
  if (t < a.fdur) {
    const h = 4 * u * (1 - u);
    return {
      x: a.fx0 + (a.fx1 - a.fx0) * u, y: a.fy0 + (a.fy1 - a.fy0) * u,
      height: h, scale: 1 + (L.peakScale - 1) * h, spin: u * L.spinTurns * Math.PI * 2, landed: false,
    };
  }
  const b = clamp((t - a.fdur) / L.landBounceSec, 0, 1);
  const h = 4 * b * (1 - b) * 0.18;
  return { x: a.fx1, y: a.fy1, height: h, scale: 1 + h * 0.8, spin: L.spinTurns * Math.PI * 2, landed: b >= 1 };
}

/** Advance a flight; on landing the animal becomes dazed (t reset). */
export function stepFlight(a: AnimalAI, dt: number): FlightPose {
  a.t += dt;
  const p = flightPose(a, a.t);
  a.x = p.x; a.y = p.y;
  if (p.landed) { a.mode = 'daze'; a.t = 0; }
  return p;
}
