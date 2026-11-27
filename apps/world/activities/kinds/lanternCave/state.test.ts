import { describe, expect, it } from 'vitest';
import { WORLD_ACTIVITIES } from '../../../config';
import { lanternScale, startCave, stepCave } from './state';

const first = { x: 0, y: 0 }, second = { x: 38, y: 0 }, third = { x: 76, y: 0 };
const lanterns = [first, second, third];
const tuning = WORLD_ACTIVITIES.lanternCave;

describe('Lantern Cave', () => {
  it('lights each covered lantern and leaves them lit for a celebration', () => {
    const scale = lanternScale(lanterns);
    let state = stepCave(startCave(3), lanterns, first, 2, 2, true, scale, 0.1);
    expect(state.lit).toEqual([true, false, false]);
    state = stepCave(state, lanterns, second, 2, 2, true, scale, 0.1);
    state = stepCave(state, lanterns, third, 2, 2, true, scale, 0.1);
    expect(state.lit).toEqual([true, true, true]);
    expect(state.outcome).toBe('running');
    expect(stepCave(state, lanterns, third, 2, 2, true, scale, tuning.celebrationSeconds).outcome).toBe('success');
  });

  it('accounts for the roof, height clearance, and the light trait', () => {
    const start = startCave(1);
    expect(stepCave(start, [first], first, 3, 3, true, 1, 0.1).lit).toEqual([false]);
    expect(stepCave(start, [first], first, 2, 3, false, 1, 0.1).lit).toEqual([false]);
    const approach = { x: 34, y: 0 };
    expect(stepCave(start, [first], approach, 2, 1, true, 1, 0.1).lit).toEqual([false]);
    expect(stepCave(start, [first], approach, 2, 3, true, 1, 0.1).lit).toEqual([true]);
    expect(stepCave(start, [first], first, 3, 3, true, 1, tuning.timeoutSeconds).outcome).toBe('fail');
  });
});
