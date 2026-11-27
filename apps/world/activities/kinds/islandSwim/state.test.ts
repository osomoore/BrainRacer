import { describe, expect, it } from 'vitest';
import { WORLD_ACTIVITIES } from '../../../config';
import { startSwim, stepSwim } from './state';

const shore = { x: 0, y: 0 }, island = { x: 190, y: 0 };
const tuning = WORLD_ACTIVITIES.islandSwim;

describe('Island Swim', () => {
  it('requires travelling through deep water and then reaching the star', () => {
    const start = startSwim(shore);
    expect(stepSwim(start, island, island, 3, false, false, 1).outcome).toBe('running');
    let state = stepSwim(start, { x: 78, y: 0 }, island, 2, true, false, 1);
    expect(state.distance).toBeGreaterThanOrEqual(tuning.swimDistance);
    expect(state.outcome).toBe('running');
    state = stepSwim(state, island, island, 2, false, false, 1);
    expect(state.outcome).toBe('success');
  });

  it('gives unsuited builds a splash before failing and times out away from the star', () => {
    const start = startSwim(shore);
    const splash = stepSwim(start, shore, island, 1, false, true, 0.2);
    expect(splash.splashing).toBeGreaterThan(0);
    expect(splash.outcome).toBe('running');
    expect(stepSwim(splash, shore, island, 1, false, true, tuning.splashSeconds).outcome).toBe('fail');
    expect(stepSwim(start, shore, island, 3, false, false, tuning.timeoutSeconds).outcome).toBe('fail');
  });
});
