import { WORLD_ACTIVITIES } from '../../../config';
import type { ActivityOutcome } from '../../../core/runtime';
import type { Vec } from '../../../core/types';

const TUNING = WORLD_ACTIVITIES.lanternCave;

export interface CaveState {
  elapsed: number;
  lit: readonly boolean[];
  celebrating: number | undefined;
  outcome: ActivityOutcome;
}

export function startCave(count: number): CaveState {
  return { elapsed: 0, lit: Array<boolean>(count).fill(false), celebrating: undefined, outcome: 'running' };
}

/** Gen caves get scaled to fit the hex; shrink the pickup radius with their lantern spacing. */
export function lanternScale(lanterns: readonly Vec[]): number {
  if (lanterns.length < 2) return 1;
  const first = lanterns[0], last = lanterns[lanterns.length - 1];
  const spacing = Math.hypot(first.x - last.x, first.y - last.y) / (lanterns.length - 1);
  return Math.min(1, spacing / (1.7 * TUNING.touchRadiusByLight[3]));
}

export function stepCave(state: CaveState, lanterns: readonly Vec[], player: Vec,
    height: number, light: number, coveredAndGrounded: boolean, scale: number, dt: number): CaveState {
  if (state.outcome !== 'running') return state;
  if (state.celebrating !== undefined) {
    const celebrating = state.celebrating + dt;
    return { ...state, celebrating, outcome: celebrating >= TUNING.celebrationSeconds ? 'success' : 'running' };
  }
  const elapsed = state.elapsed + dt;
  if (elapsed >= TUNING.timeoutSeconds) return { ...state, elapsed, outcome: 'fail' };
  if (height > TUNING.maxHeight || !coveredAndGrounded) return { ...state, elapsed };
  const radius = TUNING.touchRadiusByLight[light] * scale;
  const lit = state.lit.map((on, index) => on || Math.hypot(
    player.x - lanterns[index].x, player.y - lanterns[index].y) <= radius);
  return { ...state, elapsed, lit, celebrating: lit.every(Boolean) ? 0 : undefined };
}
