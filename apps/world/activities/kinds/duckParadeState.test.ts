import { describe, expect, it } from 'vitest';
import { WORLD_ACTIVITIES } from '../../config';
import { startDuckParade, updateDuckParade } from './duckParadeState';

const tuning = WORLD_ACTIVITIES.duckParade;
const atStart = { x: 0, y: 0, vx: 0, vy: 0, angle: 0 };
const pond = { x: 280, y: 0 };

describe('duck parade state', () => {
  it('follows a slow driver and finishes when all three ducks reach the pond', () => {
    function play() {
      const state = startDuckParade(atStart, 3);
      for (let step = 1; step <= 60 && state.outcome === 'running'; step++) {
        const x = Math.min(pond.x, step * 12);
        updateDuckParade(state, { ...atStart, x, vx: 120 }, pond, 0.1);
      }
      return state;
    }
    const state = play();
    expect(state.outcome).toBe('success');
    expect(state).toEqual(play());
  });

  it('scatters when the driver stays too fast or leaves the flock behind', () => {
    const speeding = startDuckParade(atStart, 2);
    const fast = { ...atStart, vx: tuning.maxSpeed + 1 };
    expect(updateDuckParade(speeding, fast, pond, 0.1)).toBe('running');
    expect(speeding.scatterLeft).toBe(0);
    expect(updateDuckParade(speeding, fast, pond, tuning.tooFastSeconds)).toBe('running');
    expect(speeding.scatterLeft).toBeGreaterThan(0);
    expect(updateDuckParade(speeding, atStart, pond, tuning.scatterSeconds)).toBe('fail');

    const lost = startDuckParade(atStart, 1);
    expect(updateDuckParade(lost, { ...atStart, x: tuning.scatterDistance + 1 }, pond, tuning.scatterSeconds)).toBe('fail');
  });

  it('times out without a delivery', () => {
    const waiting = startDuckParade(atStart, 1);
    expect(updateDuckParade(waiting, atStart, pond, tuning.timeoutSeconds)).toBe('fail');
  });
});
