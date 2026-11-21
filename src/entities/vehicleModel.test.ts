import { describe, expect, it } from 'vitest';
import { REWARDS, VEHICLE_MODEL } from '../config/gameConfig';
import { CAR_SPECS } from './vehicleStats';
import { rotateToward, steerFactor, steerRate, stepVehicle, unstickHeading, updateUnstick, type UnstickState, type VehicleControls, type VehicleState } from './vehicleModel';

const spec = CAR_SPECS.dino;
const ONE = { maxSpeed: 1, accel: 1 };
const go: VehicleControls = { throttle: 1, brake: 0, steer: 0 };
const still: VehicleState = { vx: 0, vy: 0, angle: 0, angularVel: 0 };

function run(s: VehicleState, c: VehicleControls, secs: number, dt = 1 / 60, m = ONE) {
  let st = { ...s };
  let r = stepVehicle(st, c, spec, m, dt);
  for (let t = 0; t < secs - 1e-9; t += dt) {
    r = stepVehicle(st, c, spec, m, dt);
    st = { ...st, vx: r.vx, vy: r.vy, angularVel: r.angularVel };
  }
  return { st, r };
}

describe('vehicleModel', () => {
  it('accelerates to max and not beyond', () => {
    const { r } = run(still, go, 5);
    expect(r.forward).toBeLessThanOrEqual(spec.maxSpeed + 1e-6);
    expect(r.forward).toBeGreaterThan(spec.maxSpeed * 0.99);
  });
  it('reaches top speed in about 1.5-2 s', () => {
    const { r } = run(still, go, 2);
    expect(r.forward).toBeGreaterThan(spec.maxSpeed * 0.95);
    expect(run(still, go, 1).r.forward).toBeLessThan(spec.maxSpeed * 0.95);
  });
  it('turbo multiplier raises the cap', () => {
    const { r } = run(still, go, 6, 1 / 60, { maxSpeed: REWARDS.turboSpeedMult, accel: REWARDS.turboAccelMult });
    expect(r.forward).toBeGreaterThan(spec.maxSpeed * 1.5);
    expect(r.forward).toBeLessThanOrEqual(spec.maxSpeed * REWARDS.turboSpeedMult + 1e-6);
  });
  it('overspeed decays back after turbo ends', () => {
    const fast: VehicleState = { vx: spec.maxSpeed * 1.6, vy: 0, angle: 0, angularVel: 0 };
    const { r } = run(fast, go, 3);
    expect(r.forward).toBeLessThan(spec.maxSpeed * 1.05);
  });
  it('brake slows then reverses up to reverseSpeed', () => {
    const moving: VehicleState = { vx: 400, vy: 0, angle: 0, angularVel: 0 };
    const brk: VehicleControls = { throttle: 0, brake: 1, steer: 0 };
    expect(run(moving, brk, 0.2).r.forward).toBeLessThan(400);
    const { r } = run(moving, brk, 5);
    expect(r.forward).toBeCloseTo(-spec.reverseSpeed, 3);
  });
  it('no turning at 0 speed', () => {
    const { r } = run(still, { throttle: 0, brake: 0, steer: 1 }, 1);
    expect(r.angularVel).toBeCloseTo(0, 6);
  });
  it('turns the right way forward, reversed when reversing', () => {
    const fwd = run({ ...still, vx: 300 }, { throttle: 0, brake: 0, steer: 1 }, 0.3).r.angularVel;
    expect(fwd).toBeGreaterThan(1);
    const rev = run({ ...still, vx: -150 }, { throttle: 0, brake: 0, steer: 1 }, 0.3).r.angularVel;
    expect(rev).toBeLessThan(-0.5);
  });
  it('grip kills lateral velocity', () => {
    const side: VehicleState = { vx: 0, vy: 300, angle: 0, angularVel: 0 };
    const { r } = run(side, { throttle: 0, brake: 0, steer: 0 }, 0.5);
    expect(Math.abs(r.lateral)).toBeLessThan(5);
  });
  it('collision spin decays back to steering control', () => {
    const spinning: VehicleState = { vx: 300, vy: 0, angle: 0, angularVel: 8 };
    const { r } = run(spinning, { throttle: 0, brake: 0, steer: 0 }, 1.5);
    expect(Math.abs(r.angularVel)).toBeLessThan(0.1);
  });
  it('is frame-rate independent (dt 1/30 vs 2x 1/60)', () => {
    const s: VehicleState = { vx: 300, vy: 120, angle: 0.2, angularVel: 1 };
    const c: VehicleControls = { throttle: 1, brake: 0, steer: 0.5 };
    const a = stepVehicle(s, c, spec, ONE, 1 / 30);
    const r1 = stepVehicle(s, c, spec, ONE, 1 / 60);
    const r2 = stepVehicle({ ...s, vx: r1.vx, vy: r1.vy, angularVel: r1.angularVel }, c, spec, ONE, 1 / 60);
    expect(a.vx).toBeCloseTo(r2.vx, 0);
    expect(a.vy).toBeCloseTo(r2.vy, 0);
    expect(a.angularVel).toBeCloseTo(r2.angularVel, 1);
  });
});

describe('pivot steering', () => {
  const P = { ...ONE, pivotRate: VEHICLE_MODEL.pivotRate };
  const steerOnly: VehicleControls = { throttle: 0, brake: 0, steer: 1 };
  it('rotates in place at ~pivotRate at 0 speed', () => {
    const { r } = run(still, steerOnly, 0.5, 1 / 60, P);
    expect(r.angularVel).toBeGreaterThan(2.0);
    expect(r.angularVel).toBeLessThan(2.5);
  });
  it('steer + throttle from standstill turns while pulling away', () => {
    const { r } = run(still, { throttle: 1, brake: 0, steer: 1 }, 0.3, 1 / 60, P);
    expect(r.angularVel).toBeGreaterThan(2.0);
    expect(r.forward).toBeGreaterThan(50);
  });
  it('blends smoothly and monotonically to the normal curve by steerRampFrac', () => {
    let prev = steerRate(0, spec, VEHICLE_MODEL.pivotRate);
    expect(prev).toBeCloseTo(VEHICLE_MODEL.pivotRate, 6);
    const end = spec.maxSpeed * VEHICLE_MODEL.steerRampFrac;
    for (let sp = 5; sp <= end; sp += 5) {
      const r = steerRate(sp, spec, VEHICLE_MODEL.pivotRate);
      expect(Math.abs(r - prev)).toBeLessThan(0.2);
      prev = r;
    }
    expect(steerRate(end, spec, VEHICLE_MODEL.pivotRate)).toBeCloseTo(spec.turnRate, 6);
    const mid = steerRate(end / 2, spec, VEHICLE_MODEL.pivotRate);
    expect(mid).toBeGreaterThan(VEHICLE_MODEL.pivotRate);
    expect(mid).toBeLessThan(spec.turnRate + 1e-9);
  });
  it('is identical to the old curve at and above the ramp end', () => {
    for (const frac of [0.3, 0.45, 0.6, 0.8, 1]) {
      expect(steerRate(frac * spec.maxSpeed, spec, VEHICLE_MODEL.pivotRate)).toBeCloseTo(spec.turnRate * steerFactor(frac), 9);
    }
    const hi = run({ ...still, vx: 500 }, steerOnly, 0.3, 1 / 60, P).r.angularVel;
    const old = run({ ...still, vx: 500 }, steerOnly, 0.3).r.angularVel;
    expect(hi).toBeCloseTo(old, 6);
  });
  it('keeps steering mirrored in reverse', () => {
    const rev = run({ ...still, vx: -150 }, steerOnly, 0.3, 1 / 60, P).r.angularVel;
    expect(rev).toBeLessThan(-0.5);
  });
});

describe('unstick', () => {
  const U = VEHICLE_MODEL.unstick;
  const fresh: UnstickState = { stuckSec: 0, cooldownSec: 0 };
  const stuck = { throttle: 1, speed: 5, inStaticContact: true };
  function runFor(inp: typeof stuck, secs: number, st = fresh) {
    let trig = false, state = st;
    for (let t = 0; t < secs - 1e-9; t += 1 / 60) { const r = updateUnstick(state, inp, 1 / 60); state = r.state; trig ||= r.trigger; }
    return { trig, state };
  }
  it('triggers after ~0.5 s of throttle, no progress, wall contact', () => {
    expect(runFor(stuck, U.sec - 0.1).trig).toBe(false);
    expect(runFor(stuck, U.sec + 0.05).trig).toBe(true);
  });
  it('does not trigger without throttle, with speed, or off-wall', () => {
    expect(runFor({ ...stuck, throttle: 0 }, 2).trig).toBe(false);
    expect(runFor({ ...stuck, speed: 200 }, 2).trig).toBe(false);
    expect(runFor({ ...stuck, inStaticContact: false }, 2).trig).toBe(false);
  });
  it('respects cooldown and resets when progress is made', () => {
    const a = runFor(stuck, U.sec + 0.05);
    expect(runFor(stuck, 0.2, a.state).trig).toBe(false);
    const moving = updateUnstick({ stuckSec: 0.4, cooldownSec: 0 }, { ...stuck, speed: 300 }, 1 / 60);
    expect(moving.state.stuckSec).toBe(0);
  });
  it('aims along the wall tangent, tilted away, on the stick side', () => {
    // wall above the car: away normal points +y (down); car faces up (-90 deg)
    const n = { x: 0, y: 1 };
    const up = -Math.PI / 2;
    const right = unstickHeading(up, n, 1);   // clockwise = toward +x
    const left = unstickHeading(up, n, -1);
    expect(Math.cos(right)).toBeGreaterThan(0.8);
    expect(Math.cos(left)).toBeLessThan(-0.8);
    expect(Math.sin(right)).toBeGreaterThan(0);  // tilted away from the wall (down)
    // no stick: picks the nearer tangent
    const nearer = unstickHeading(up + 0.2, n, 0);
    expect(Math.cos(nearer)).toBeGreaterThan(0.8);
  });
  it('rotateToward takes the short way and never overshoots', () => {
    expect(rotateToward(3.0, -3.0, 0.1)).toBeCloseTo(3.1, 9);
    expect(rotateToward(0, 0.05, 0.1)).toBeCloseTo(0.05, 9);
  });
});
