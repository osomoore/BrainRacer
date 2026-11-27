import { WORLD_ACTIVITIES } from '../../config';
import type { ActivityOutcome } from '../../core/runtime';
import type { Vec } from '../../core/types';

const TUNING = WORLD_ACTIVITIES.duckParade;
type Driver = Vec & { vx: number; vy: number; angle: number };

export function startDuckParade(player: Driver, count: number) {
  const nest = { x: player.x, y: player.y };
  const ducks = Array.from({ length: count }, (_, index) => tailPosition(player, index));
  return { nest, ducks, elapsed: 0, tooFast: 0, scatterLeft: 0, outcome: 'running' as ActivityOutcome };
}

function tailPosition(player: Driver, index: number): Vec {
  const distance = (index + 1) * TUNING.duckSpacing;
  return { x: player.x - distance * Math.cos(player.angle), y: player.y - distance * Math.sin(player.angle) };
}

function moveToward(duck: Vec, target: Vec, maxStep: number): void {
  const dx = target.x - duck.x, dy = target.y - duck.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return;
  const fraction = Math.min(1, maxStep / distance);
  duck.x += dx * fraction;
  duck.y += dy * fraction;
}

/** Follow at a waddle, settle in the pond, or scatter back to the starting bank. */
export function updateDuckParade(state: ReturnType<typeof startDuckParade>, player: Driver, pond: Vec, dt: number): ActivityOutcome {
  if (state.outcome !== 'running') return state.outcome;
  state.elapsed += dt;
  const speed = Math.hypot(player.vx, player.vy);
  state.tooFast = speed > TUNING.maxSpeed ? state.tooFast + dt : 0;
  if (state.scatterLeft === 0 && (state.tooFast >= TUNING.tooFastSeconds || state.elapsed >= TUNING.timeoutSeconds
    || state.ducks.some(duck => Math.hypot(duck.x - player.x, duck.y - player.y) > TUNING.scatterDistance))) {
    state.scatterLeft = TUNING.scatterSeconds;
  }
  if (state.scatterLeft > 0) {
    state.ducks.forEach((duck, i) => {
      const angle = i * 2 * Math.PI / state.ducks.length;
      const target = { x: state.nest.x + 28 * Math.cos(angle), y: state.nest.y + 28 * Math.sin(angle) };
      moveToward(duck, target, TUNING.scatterSpeed * dt);
    });
    state.scatterLeft = Math.max(0, state.scatterLeft - dt);
    if (state.scatterLeft === 0) state.outcome = 'fail';
    return state.outcome;
  }

  const inPond = Math.hypot(player.x - pond.x, player.y - pond.y) <= TUNING.pondRadius;
  state.ducks.forEach((duck, index) => {
    const target = inPond ? { x: pond.x + (index - (state.ducks.length - 1) / 2) * TUNING.duckSpacing, y: pond.y }
      : tailPosition(player, index);
    moveToward(duck, target, TUNING.followSpeed * dt);
  });
  if (inPond && state.ducks.every(duck => Math.hypot(duck.x - pond.x, duck.y - pond.y) <= TUNING.pondRadius * 0.65)) {
    state.outcome = 'success';
  }
  return state.outcome;
}
