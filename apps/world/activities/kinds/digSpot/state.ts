import { WORLD_ACTIVITIES } from '../../../config';
import type { ActivityOutcome } from '../../../core/runtime';
import type { Vec } from '../../../core/types';

const TUNING = WORLD_ACTIVITIES.digSpot;

export interface DigState {
  elapsed: number;
  spots: readonly Vec[];
  uncovered: readonly boolean[];
  digging: number;
  stroke: number;
  stuck: number;
  tapDig: boolean;
  outcome: ActivityOutcome;
}

export function startDig(spots: readonly Vec[]): DigState {
  return { elapsed: 0, spots, uncovered: spots.map(() => false), digging: -1,
    stroke: 0, stuck: 0, tapDig: false, outcome: 'running' };
}

export function stepDig(state: DigState, player: Vec, speed: number, dig: number,
    a: { pressed: boolean; held?: boolean }, dt: number): DigState {
  if (state.outcome !== 'running') return state;
  const elapsed = state.elapsed + dt;
  if (state.stuck > 0) {
    const stuck = state.stuck + dt;
    return { ...state, elapsed, stuck, outcome: stuck >= TUNING.stuckSeconds ? 'fail' : 'running' };
  }
  if (elapsed >= TUNING.timeoutSeconds) return { ...state, elapsed, outcome: 'fail' };

  let digging = -1;
  let nearest: number = TUNING.radius;
  if (speed <= TUNING.parkSpeed) {
    state.spots.forEach((spot, index) => {
      const distance = Math.hypot(spot.x - player.x, spot.y - player.y);
      if (!state.uncovered[index] && distance <= nearest) {
        digging = index;
        nearest = distance;
      }
    });
  }

  const sameSpot = digging === state.digging;
  const tapDig = digging >= 0 && (a.pressed || (sameSpot && state.tapDig));
  if (digging < 0 || !(a.held ?? tapDig)) return { ...state, elapsed, digging, tapDig: false, stroke: 0 };
  if (dig === 0) return { ...state, elapsed, digging, stuck: dt };
  const stroke = (sameSpot ? state.stroke : 0) + dt / TUNING.digSeconds[dig];
  if (stroke < 1) return { ...state, elapsed, digging, tapDig, stroke };

  const uncovered = state.uncovered.map((done, index) => done || index === digging);
  return { ...state, elapsed, uncovered, digging: -1, tapDig: false, stroke: 0,
    outcome: uncovered.every(Boolean) ? 'success' : 'running' };
}
