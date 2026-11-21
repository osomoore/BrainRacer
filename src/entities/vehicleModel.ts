/**
 * Pure (Phaser-free) top-down tire model. One call = one physics step.
 * All speeds here are px/s and rad/s (NOT Matter's per-step units; Vehicle converts).
 * Angle 0 faces +x, positive is clockwise (+y down).
 */
import { VEHICLE_MODEL } from '../config/gameConfig';
import type { VehicleSpec } from '../core/types';

export interface VehicleState { vx: number; vy: number; angle: number; angularVel: number }
export interface VehicleControls { throttle: number; brake: number; steer: number }
/** `grip` (optional, default 1) scales lateral grip, e.g. lowered briefly after a crash so the car slides off walls. */
export interface VehicleMults {
  maxSpeed: number; accel: number; grip?: number;
  /** Pivot turn rate (rad/s) at ~0 speed; blends into the normal speed-based steering by steerRampFrac. 0/undefined = off (traffic, police). */
  pivotRate?: number;
}
export interface VehicleResult { vx: number; vy: number; angularVel: number; forward: number; lateral: number }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Steering authority 0..1+ as a function of speed fraction (of the spec's base max speed). */
export function steerFactor(speedFrac: number): number {
  const M = VEHICLE_MODEL;
  const f = Math.abs(speedFrac);
  if (f < M.steerRampFrac) return f / M.steerRampFrac;
  if (f <= M.steerPlateauEnd) return 1;
  const t = clamp((f - M.steerPlateauEnd) / (1 - M.steerPlateauEnd), 0, 1);
  return 1 + (M.steerTopFactor - 1) * t;
}

/** Max steering rate (rad/s at full stick) at forward speed `speed`. With `pivotRate`, low speeds turn at pivotRate (smoothly blending to the normal curve). */
export function steerRate(speed: number, spec: VehicleSpec, pivotRate = 0): number {
  const M = VEHICLE_MODEL;
  const frac = Math.abs(speed) / spec.maxSpeed;
  if (pivotRate > 0 && frac < M.steerRampFrac) {
    const t = frac / M.steerRampFrac;
    const w = t * t * (3 - 2 * t); // smoothstep: 0 at standstill -> 1 at the ramp end
    return pivotRate + (spec.turnRate - pivotRate) * w;
  }
  return spec.turnRate * steerFactor(frac);
}

export function stepVehicle(
  s: VehicleState,
  c: VehicleControls,
  spec: VehicleSpec,
  m: VehicleMults,
  dt: number,
): VehicleResult {
  const M = VEHICLE_MODEL;
  const cos = Math.cos(s.angle);
  const sin = Math.sin(s.angle);
  let f = s.vx * cos + s.vy * sin;     // forward speed
  let l = -s.vx * sin + s.vy * cos;    // lateral speed (positive = to the right of facing)

  const cap = spec.maxSpeed * m.maxSpeed;
  const accel = spec.accel * m.accel;
  const throttle = clamp(c.throttle, 0, 1);
  const brake = clamp(c.brake, 0, 1);

  if (brake > 0.05 && brake >= throttle) {
    if (f > M.reverseThreshold) {
      f = Math.max(0, f - spec.brake * brake * dt);
    } else {
      // nearly stopped (or already reversing): back up
      f = Math.max(-spec.reverseSpeed, f - accel * M.reverseAccelFrac * brake * dt);
    }
  } else if (throttle > 0) {
    if (f < -M.reverseThreshold) {
      f = Math.min(0, f + spec.brake * throttle * dt); // moving backwards: brake first
    } else if (f < cap) {
      f = Math.min(cap, f + accel * throttle * dt);
    }
  } else {
    f *= Math.exp(-spec.drag * dt);    // coasting drag
    if (Math.abs(f) < 4) f = 0;
  }
  if (f > cap) f = cap + (f - cap) * Math.exp(-M.overspeedDecay * dt); // turbo ended / slowed

  // Lateral grip, frame-rate independent: remove `g` of sideways velocity per 1/60 s.
  const speedFrac = Math.min(1, Math.abs(f) / spec.maxSpeed);
  const g = clamp(spec.grip * (m.grip ?? 1) * (1 - (spec.driftLoss ?? M.highSpeedGripLoss) * speedFrac * speedFrac), 0, 0.999);
  l *= Math.pow(1 - g, dt * 60);

  // Steering. Reversed when reversing; none when stopped.
  const dir = f >= 0 ? 1 : -1;
  const target = clamp(c.steer, -1, 1) * steerRate(f, spec, m.pivotRate) * dir;
  const k = Math.abs(s.angularVel) > spec.turnRate * 1.3 ? M.spinDecay : (spec.steerResponse ?? M.steerResponse);
  const angularVel = s.angularVel + (target - s.angularVel) * (1 - Math.exp(-k * dt));

  return {
    vx: f * cos - l * sin,
    vy: f * sin + l * cos,
    angularVel,
    forward: f,
    lateral: l,
  };
}

// ---- wall un-stick (pure decision helpers; Vehicle/PlayerCar apply the result) ----

export interface UnstickState { stuckSec: number; cooldownSec: number }
export interface UnstickInput { throttle: number; speed: number; inStaticContact: boolean }

/** Accumulates "holding throttle, going nowhere, touching a static body" time; `trigger` fires once per stuck episode. */
export function updateUnstick(st: UnstickState, inp: UnstickInput, dt: number): { state: UnstickState; trigger: boolean } {
  const U = VEHICLE_MODEL.unstick;
  const cooldownSec = Math.max(0, st.cooldownSec - dt);
  const stuck = inp.throttle >= U.minThrottle && inp.speed < U.speed && inp.inStaticContact;
  if (!stuck) return { state: { stuckSec: 0, cooldownSec }, trigger: false };
  const stuckSec = st.stuckSec + dt;
  if (stuckSec >= U.sec && cooldownSec <= 0) return { state: { stuckSec: 0, cooldownSec: U.cooldownSec }, trigger: true };
  return { state: { stuckSec, cooldownSec }, trigger: false };
}

const wrapPi = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/**
 * Heading to rotate to so the next throttle runs along/away from the wall. `awayNormal` is the unit vector pointing
 * out of the wall. Picks the tangent on the side the stick points to (steer > 0 = clockwise), else the nearer one,
 * then tilts it slightly away from the wall.
 */
export function unstickHeading(angle: number, awayNormal: { x: number; y: number }, steer: number): number {
  const U = VEHICLE_MODEL.unstick;
  const na = Math.atan2(awayNormal.y, awayNormal.x);
  const cands = [na + Math.PI / 2, na - Math.PI / 2]; // tangents; tilt each 'away' by moving toward na
  const best = (tan: number) => tan + Math.sign(wrapPi(na - tan)) * U.awayTilt;
  const diff = (t: number) => wrapPi(best(t) - angle);
  let pick = cands[0];
  if (Math.abs(steer) > 0.2) {
    const want = steer > 0 ? 1 : -1; // clockwise = positive angle delta
    const ok = cands.filter((t) => Math.sign(diff(t)) === want);
    pick = ok.length ? ok.reduce((a, b) => (Math.abs(diff(a)) < Math.abs(diff(b)) ? a : b)) : (Math.abs(diff(cands[0])) < Math.abs(diff(cands[1])) ? cands[0] : cands[1]);
  } else if (Math.abs(diff(cands[1])) < Math.abs(diff(cands[0]))) pick = cands[1];
  return best(pick);
}

/** Step `angle` toward `target` by at most `maxStep` rad (shortest way). */
export function rotateToward(angle: number, target: number, maxStep: number): number {
  const d = wrapPi(target - angle);
  return angle + clamp(d, -maxStep, maxStep);
}
