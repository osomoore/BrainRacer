import { describe, expect, it } from 'vitest';
import { CAR_SPECS, REWARDS } from '../config/gameConfig';
import { stepVehicle, type VehicleControls, type VehicleState } from './vehicleModel';

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
