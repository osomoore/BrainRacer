import { WORLD_ACTIVITIES } from '../../../config';
import type { ActivityOutcome } from '../../../core/runtime';
import type { Vec } from '../../../core/types';

const TUNING = WORLD_ACTIVITIES.islandSwim;

export interface SwimState {
  elapsed: number;
  distance: number;
  previous: Vec;
  splashing: number;
  outcome: ActivityOutcome;
}

export function startSwim(at: Vec): SwimState {
  return { elapsed: 0, distance: 0, previous: { x: at.x, y: at.y }, splashing: 0, outcome: 'running' };
}

export function stepSwim(state: SwimState, player: Vec, island: Vec, water: number,
    deep: boolean, approachingDeep: boolean, dt: number): SwimState {
  if (state.outcome !== 'running') return state;
  const elapsed = state.elapsed + dt;
  if (elapsed >= TUNING.timeoutSeconds) return { ...state, elapsed, outcome: 'fail' };
  const nearStar = Math.hypot(player.x - island.x, player.y - island.y) <= TUNING.catchRadius;
  const canSwim = water >= TUNING.minWater;
  const distance = canSwim && deep && Math.hypot(player.x - island.x, player.y - island.y) <= TUNING.stayNear
    ? state.distance + Math.hypot(player.x - state.previous.x, player.y - state.previous.y) : state.distance;
  const splashing = !canSwim && (approachingDeep || nearStar) ? state.splashing + dt : 0;
  const outcome = canSwim && nearStar && distance >= TUNING.swimDistance ? 'success'
    : splashing >= TUNING.splashSeconds ? 'fail' : 'running';
  return { elapsed, distance, previous: { x: player.x, y: player.y }, splashing, outcome };
}
