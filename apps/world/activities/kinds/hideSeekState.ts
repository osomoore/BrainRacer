import type { Vec } from '../../core/types';

export interface HideSeekInput {
  elapsed: number; dt: number; player: Vec; vx: number; vy: number; hideout: Vec; stealth: number;
  hideRadius: number; passSeconds: number; passDistance: number; caughtDistance: number; requiredSeconds: number; maxSeconds: number;
  camouflaged: boolean;
}

export interface HideSeekState { crossingStillSeconds: number; }

export function sniffingDinoX(elapsed: number, centerX: number, passDistance: number, passSeconds: number, requiredSeconds: number): number {
  if (elapsed < passSeconds) return centerX - passDistance + (elapsed / passSeconds) * passDistance;
  if (elapsed < passSeconds + requiredSeconds) return centerX;
  return centerX + Math.min(1, (elapsed - passSeconds - requiredSeconds) / passSeconds) * passDistance;
}

/** A friendly sniffer crosses the hideout. Stillness and foliage concealment decide the outcome. */
export function updateHideSeek(input: HideSeekInput, state: HideSeekState): 'running' | 'success' | 'fail' {
  const elapsed = input.elapsed + Math.max(0, input.dt);
  const hidden = Math.hypot(input.player.x - input.hideout.x, input.player.y - input.hideout.y) <= input.hideRadius;
  const still = Math.hypot(input.vx, input.vy) < 18;
  const dinoX = sniffingDinoX(elapsed, input.hideout.x, input.passDistance, input.passSeconds, input.requiredSeconds);
  const dinoY = input.hideout.y + Math.sin(elapsed * 2.2) * 32;
  const caught = Math.hypot(input.player.x - dinoX, input.player.y - dinoY) < input.caughtDistance;
  const inCrossing = elapsed >= input.passSeconds && elapsed < input.passSeconds + input.requiredSeconds;
  if (inCrossing && hidden && still) state.crossingStillSeconds += Math.max(0, input.dt);
  else if (inCrossing) state.crossingStillSeconds = 0;
  const requirement = input.requiredSeconds * Math.max(input.camouflaged ? 0.45 : 0.7, 1 - input.stealth * 0.12);
  if (inCrossing && caught && (!hidden || !still) && !input.camouflaged && input.stealth < 2) return 'fail';
  if (elapsed >= input.passSeconds * 2 + input.requiredSeconds) return state.crossingStillSeconds >= requirement ? 'success' : 'fail';
  if (elapsed >= input.maxSeconds || (caught && (!hidden || !still) && !input.camouflaged && input.stealth < 2)) return 'fail';
  return 'running';
}
