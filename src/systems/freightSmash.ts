import { FREIGHT } from '../config/gameConfig';

/** A player smashes a train car with turbo, or by hitting it above the impact-speed threshold (px/s along the contact normal). */
export function shouldSmash(turbo: boolean, impactSpeed: number): boolean {
  return turbo || impactSpeed >= FREIGHT.smashImpactSpeed;
}

/** Indices of the cars that break away when car `hit` is smashed: the hit car and everything behind it (engine = index 0 is the front). */
export function detachedFrom(hit: number, carCount: number, alreadySmashed: readonly boolean[]): number[] {
  const out: number[] = [];
  for (let i = Math.max(0, hit); i < carCount; i++) if (!alreadySmashed[i]) out.push(i);
  return out;
}

/** True once a smashed car's re-form delay has passed AND its slot is free of vehicles. */
export function canReform(now: number, smashedAt: number, slotBlocked: boolean): boolean {
  return now - smashedAt >= FREIGHT.reformSec && !slotBlocked;
}

/** Debris launch velocity (px/s): away from the hit point, plus a share of the car's travel direction. */
export function debrisVelocity(
  dir: { x: number; y: number }, speed: number, rnd: { spread: number; speedMul: number },
): { vx: number; vy: number } {
  const a = Math.atan2(dir.y, dir.x) + rnd.spread;
  const s = speed * rnd.speedMul;
  return { vx: Math.cos(a) * s, vy: Math.sin(a) * s };
}
