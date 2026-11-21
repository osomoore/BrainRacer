import { describe, expect, it } from 'vitest';
import { UNLOCK_VEHICLES, type UnlockVehicle } from '../config/collectibles';
import { BOARDING_DRIVE, POLICE_SPEC, REWARDS, VEHICLE_STATS as V } from '../config/gameConfig';
import type { VehicleSpec } from '../core/types';
import { stepVehicle, type VehicleState } from './vehicleModel';
import { CAR_SPECS, RATING_KEYS, ratingsSum, specFromRatings, type VehicleRatings } from './vehicleStats';
import { STARTER_CAR_RATINGS } from '../config/gameConfig';

interface Entry { id: string; ratings: VehicleRatings; spec: VehicleSpec }
const roster: Entry[] = [
  ...(Object.keys(STARTER_CAR_RATINGS) as (keyof typeof STARTER_CAR_RATINGS)[]).map((k) => ({ id: k, ratings: STARTER_CAR_RATINGS[k].ratings, spec: CAR_SPECS[k] })),
  ...(Object.keys(UNLOCK_VEHICLES) as UnlockVehicle[]).map((k) => ({ id: k, ratings: UNLOCK_VEHICLES[k].ratings, spec: UNLOCK_VEHICLES[k].spec })),
];

const within = (v: number, a: { lo: number; hi: number }) => v >= Math.min(a.lo, a.hi) - 1e-9 && v <= Math.max(a.lo, a.hi) + 1e-9;

// ---- course sim ----
type P = { x: number; y: number };
const COURSE: P[] = [
  { x: 1200, y: 0 }, { x: 2400, y: 0 }, { x: 3000, y: 0 },            // long straight
  { x: 3100, y: 90 }, { x: 3000, y: 180 }, { x: 2900, y: 180 },       // hairpin
  { x: 2500, y: 180 }, { x: 2200, y: 250 }, { x: 1900, y: 110 },      // S-bend
  { x: 1600, y: 250 }, { x: 1300, y: 110 }, { x: 900, y: 180 },
  { x: 100, y: 180 },                                                  // run-out
];
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function courseTime(spec: VehicleSpec, course = COURSE): number {
  const dt = 1 / 60;
  let s: VehicleState = { vx: 0, vy: 0, angle: 0, angularVel: 0 };
  let pos = { x: 0, y: 0 };
  let wp = 0;
  const m = { maxSpeed: 1, accel: 1, pivotRate: spec.pivotRate ?? 0 };
  for (let t = 0; t < 120; t += dt) {
    const tgt = course[wp];
    const err = wrap(Math.atan2(tgt.y - pos.y, tgt.x - pos.x) - s.angle);
    // upcoming corner sharpness at this waypoint -> speed limit scaled by what the car can turn
    const next = course[wp + 1];
    let limit = Infinity;
    if (next) {
      const turn = Math.abs(wrap(Math.atan2(next.y - tgt.y, next.x - tgt.x) - Math.atan2(tgt.y - pos.y, tgt.x - pos.x)));
      const dist = Math.hypot(tgt.x - pos.x, tgt.y - pos.y);
      const vc = Math.max(90, spec.turnRate * 70 * (1 - 0.35 * turn) * (spec.grip + 0.25));
      const speed = Math.hypot(s.vx, s.vy);
      // brake early enough: v^2 = vc^2 + 2*b*d
      if (turn > 0.5) limit = Math.sqrt(vc * vc + 2 * spec.brake * 0.6 * Math.max(0, dist - 60));
      void speed;
    }
    const speed = Math.hypot(s.vx, s.vy);
    const c = { steer: Math.max(-1, Math.min(1, err * 2.5)), throttle: speed < limit && Math.abs(err) < 1.2 ? 1 : 0, brake: speed > limit * 1.05 ? 1 : 0 };
    const r = stepVehicle(s, c, spec, m, dt);
    s = { vx: r.vx, vy: r.vy, angle: s.angle + r.angularVel * dt, angularVel: r.angularVel };
    pos = { x: pos.x + s.vx * dt, y: pos.y + s.vy * dt };
    if (Math.hypot(tgt.x - pos.x, tgt.y - pos.y) < 70) { wp++; if (wp >= course.length) return t; }
  }
  return 120;
}

describe('vehicle ratings', () => {
  it('has the whole roster', () => expect(roster.length).toBe(77));
  it('ratings are 1-5 integers summing to the budget', () => {
    for (const e of roster) {
      for (const k of RATING_KEYS) {
        expect(e.ratings[k], `${e.id}.${k}`).toBeGreaterThanOrEqual(V.minRating);
        expect(e.ratings[k], `${e.id}.${k}`).toBeLessThanOrEqual(V.maxRating);
        expect(Number.isInteger(e.ratings[k]), `${e.id}.${k}`).toBe(true);
      }
      expect(ratingsSum(e.ratings), e.id).toBe(V.budget);
    }
  });
  it('covers the whole 1-5 range on every stat', () => {
    for (const k of RATING_KEYS) {
      const vals = roster.map((e) => e.ratings[k]);
      expect(Math.min(...vals), k).toBe(1);
      expect(Math.max(...vals), k).toBe(5);
    }
  });
  it('derived specs stay inside the configured ranges', () => {
    for (const e of roster) {
      const s = e.spec;
      expect(within(s.maxSpeed, V.maxSpeed), e.id).toBe(true);
      expect(within(s.accel, V.accel), e.id).toBe(true);
      expect(within(s.turnRate, V.turnRate), e.id).toBe(true);
      expect(within(s.pivotRate!, V.pivotRate), e.id).toBe(true);
      expect(within(s.mass, V.mass), e.id).toBe(true);
      expect(within(s.grip, V.grip), e.id).toBe(true);
      expect(within(s.driftLoss!, V.driftLoss), e.id).toBe(true);
      expect(within(s.steerResponse!, V.steerResponse), e.id).toBe(true);
      expect(s.mass, e.id).toBeLessThan(BOARDING_DRIVE.heavyMass);
    }
  });
  it('heavier = more momentum, lower grip rating = drifts more', () => {
    const light = specFromRatings({ speed: 3, zoom: 3, turning: 3, weight: 1, grip: 3 }, 70, 40);
    const heavy = specFromRatings({ speed: 3, zoom: 3, turning: 3, weight: 5, grip: 3 }, 70, 40);
    expect(heavy.steerResponse!).toBeLessThan(light.steerResponse!);
    expect(heavy.recoilMult!).toBeLessThan(light.recoilMult!);
    expect(heavy.drag).toBeLessThan(light.drag);
    expect(heavy.mass).toBeGreaterThan(light.mass);
    const slick = specFromRatings({ speed: 3, zoom: 3, turning: 3, weight: 3, grip: 1 }, 70, 40);
    const planted = specFromRatings({ speed: 3, zoom: 3, turning: 3, weight: 3, grip: 5 }, 70, 40);
    expect(slick.grip).toBeLessThan(planted.grip);
    expect(slick.driftLoss!).toBeGreaterThan(planted.driftLoss!);
  });
  it('police are never slower than a player; turbo outruns police', () => {
    const police = POLICE_SPEC.maxSpeed; // AI cruisers must catch every car without turbo
    for (const e of roster) {
      expect(e.spec.maxSpeed, e.id).toBeLessThanOrEqual(police);
      expect(e.spec.maxSpeed * REWARDS.turboSpeedMult, e.id).toBeGreaterThan(police);
    }
  });
});

describe('course-time balance', () => {
  const times = roster.map((e) => ({ id: e.id, t: courseTime(e.spec) }));
  const sorted = times.map((x) => x.t).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (process.env.VEHICLE_TABLE) {
    for (const x of [...times].sort((a, b) => a.t - b.t)) {
      const e = roster.find((r) => r.id === x.id)!;
      console.log(`| ${x.id} | ${RATING_KEYS.map((k) => e.ratings[k]).join('/')} | ${e.spec.maxSpeed.toFixed(0)} | ${e.spec.accel.toFixed(0)} | ${e.spec.turnRate.toFixed(2)} | ${e.spec.mass.toFixed(1)} | ${x.t.toFixed(2)}s ${((x.t / median - 1) * 100).toFixed(1)}% |`);
    }
  }
  it('every vehicle finishes within 11% of the median', () => {
    for (const x of times) {
      expect(x.t, x.id).toBeLessThan(120);
      expect(Math.abs(x.t / median - 1), `${x.id} ${x.t.toFixed(2)}s vs median ${median.toFixed(2)}s`).toBeLessThanOrEqual(0.11);
    }
  });
});
