import { WORLD_ACTIVITIES } from '../../../config';
import type { ActivityOutcome } from '../../../core/runtime';
import type { Vec } from '../../../core/types';

const TUNING = WORLD_ACTIVITIES.gateDash;

export interface Gate { at: Vec; angle: number }
export interface DashState { elapsed: number; next: number; previous: Vec; outcome: ActivityOutcome }

export function dashGates(start: Vec, targets: readonly Vec[]): Gate[] {
  return targets.map((at, index) => {
    const from = targets[index - 1] ?? start;
    return { at, angle: Math.atan2(at.y - from.y, at.x - from.x) };
  });
}

function crosses(gate: Gate, from: Vec, to: Vec): boolean {
  const cos = Math.cos(gate.angle), sin = Math.sin(gate.angle);
  const before = (from.x - gate.at.x) * cos + (from.y - gate.at.y) * sin;
  const after = (to.x - gate.at.x) * cos + (to.y - gate.at.y) * sin;
  if (before >= 0 || after < 0) return false;
  const t = -before / (after - before);
  const x = from.x + (to.x - from.x) * t - gate.at.x;
  const y = from.y + (to.y - from.y) * t - gate.at.y;
  return Math.abs(y * cos - x * sin) <= TUNING.halfWidth;
}

export function startDash(at: Vec): DashState {
  return { elapsed: 0, next: 0, previous: { x: at.x, y: at.y }, outcome: 'running' };
}

export function stepDash(state: DashState, gates: readonly Gate[], player: Vec, dt: number): DashState {
  if (state.outcome !== 'running') return state;
  const elapsed = state.elapsed + dt;
  if (elapsed >= TUNING.timeoutSeconds) return { ...state, elapsed, outcome: 'fail' };
  const gate = gates[state.next];
  const next = gate && crosses(gate, state.previous, player) ? state.next + 1 : state.next;
  return { elapsed, next, previous: { x: player.x, y: player.y }, outcome: next === gates.length ? 'success' : 'running' };
}
