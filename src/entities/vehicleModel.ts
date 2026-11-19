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
export interface VehicleMults { maxSpeed: number; accel: number; grip?: number }
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
  const g = clamp(spec.grip * (m.grip ?? 1) * (1 - M.highSpeedGripLoss * speedFrac * speedFrac), 0, 0.999);
  l *= Math.pow(1 - g, dt * 60);

  // Steering. Reversed when reversing; none when stopped.
  const dir = f >= 0 ? 1 : -1;
  const target = clamp(c.steer, -1, 1) * spec.turnRate * steerFactor(f / spec.maxSpeed) * dir;
  const k = Math.abs(s.angularVel) > spec.turnRate * 1.3 ? M.spinDecay : M.steerResponse;
  const angularVel = s.angularVel + (target - s.angularVel) * (1 - Math.exp(-k * dt));

  return {
    vx: f * cos - l * sin,
    vy: f * sin + l * cos,
    angularVel,
    forward: f,
    lateral: l,
  };
}
