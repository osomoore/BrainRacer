import { WORLD_ACTIVITIES } from '../../../config';
import type { ActivityOutcome } from '../../../core/runtime';
import type { Vec } from '../../../core/types';

const TUNING = WORLD_ACTIVITIES.herdSheep;

export interface Sheep { at: Vec; away: Vec; stride: number; penned: boolean }
export interface HerdState { elapsed: number; sheep: readonly Sheep[]; outcome: ActivityOutcome }

export function startHerd(positions: readonly Vec[]): HerdState {
  return { elapsed: 0, sheep: positions.map(at => ({ at, away: { x: 0, y: 0 }, stride: 0, penned: false })),
    outcome: 'running' };
}

export function stepHerd(state: HerdState, pen: Vec, player: Vec, velocity: Vec, honk: boolean,
    loud: number, dt: number, canStep: (at: Vec) => boolean): HerdState {
  if (state.outcome !== 'running') return state;
  const elapsed = state.elapsed + dt;
  if (elapsed >= TUNING.timeoutSeconds) return { ...state, elapsed, outcome: 'fail' };
  const speed = Math.hypot(velocity.x, velocity.y);
  const sheep = state.sheep.map(animal => {
    if (animal.penned) return animal;
    const dx = animal.at.x - player.x, dy = animal.at.y - player.y;
    const distance = Math.hypot(dx, dy);
    const directed = distance > 0 ? { x: dx / distance, y: dy / distance }
      : speed > 0 ? { x: velocity.x / speed, y: velocity.y / speed } : animal.away;
    const nudging = distance <= TUNING.nudgeRadius && speed >= TUNING.nudgeMinSpeed
      && directed.x * velocity.x + directed.y * velocity.y > 0;
    const startled = honk && distance <= TUNING.honkRadius + TUNING.honkRadiusPerLoud * loud && distance > 0;
    const stride = startled ? TUNING.honkStride + TUNING.honkStridePerLoud * loud : animal.stride;
    const away = startled || (nudging && stride === 0) ? directed : animal.away;
    const amount = stride > 0 ? Math.min(stride, TUNING.fleeSpeed * dt) : nudging ? TUNING.nudgeSpeed * dt : 0;
    if (amount === 0) return animal;

    const at = { x: animal.at.x + away.x * amount, y: animal.at.y + away.y * amount };
    const fromPen = Math.hypot(at.x - pen.x, at.y - pen.y);
    if (fromPen > TUNING.playRadius || !canStep(at)) return { ...animal, away, stride: 0 };
    const penned = fromPen <= TUNING.penRadius;
    return { at, away, stride: penned ? 0 : Math.max(0, stride - amount), penned };
  });
  return { elapsed, sheep, outcome: sheep.every(animal => animal.penned) ? 'success' : 'running' };
}
