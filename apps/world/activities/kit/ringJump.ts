import type { Vec } from '../../core/types';

export interface RingJumpProgress {
  next: number;
  elapsed: number;
  outcome: 'running' | 'success' | 'fail';
}

export interface RingJumpStep {
  progress: RingJumpProgress;
  collected: number | undefined;
}

export function startRingJump(): RingJumpProgress {
  return { next: 0, elapsed: 0, outcome: 'running' };
}

export function stepRingJump(
  progress: RingJumpProgress,
  position: Vec,
  airborne: number,
  dt: number,
  targets: readonly Vec[],
  catchRadius: number,
  timeoutSeconds: number,
): RingJumpStep {
  if (progress.outcome !== 'running') return { progress, collected: undefined };
  const elapsed = progress.elapsed + Math.max(0, Number.isFinite(dt) ? dt : 0);
  const target = targets[progress.next];
  const hit = airborne > 0 && target !== undefined
    && Math.hypot(position.x - target.x, position.y - target.y) <= catchRadius;
  const next = progress.next + Number(hit);
  const outcome = next >= targets.length ? 'success'
    : elapsed >= timeoutSeconds ? 'fail' : 'running';
  return {
    progress: { next, elapsed, outcome },
    collected: hit ? progress.next : undefined,
  };
}
