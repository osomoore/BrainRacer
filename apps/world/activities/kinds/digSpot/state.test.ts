import { describe, expect, it } from 'vitest';
import { WORLD_ACTIVITIES } from '../../../config';
import { startDig, stepDig } from './state';

const first = { x: 0, y: 0 }, second = { x: 100, y: 0 };
const tuning = WORLD_ACTIVITIES.digSpot;

describe('Dig Spot', () => {
  it('requires parking and holding A continuously on each mark', () => {
    let state = startDig([first, second]);
    const held = { pressed: false, held: true };
    state = stepDig(state, first, 100, 3, held, 0.5);
    expect(state.stroke).toBe(0);
    state = stepDig(state, first, 0, 3, held, 0.5);
    expect(state.stroke).toBeGreaterThan(0);
    state = stepDig(state, first, 0, 3, { pressed: false, held: false }, 0.1);
    expect(state.stroke).toBe(0);
    state = stepDig(state, first, 0, 3, held, tuning.digSeconds[3]);
    expect(state.uncovered).toEqual([true, false]);
    expect(stepDig(state, second, 0, 3, held, tuning.digSeconds[3]).outcome).toBe('success');
  });

  it('supports tap controls and digs faster at higher levels', () => {
    const start = startDig([first]);
    const slower = stepDig(start, first, 0, 1, { pressed: true }, 0.1);
    const faster = stepDig(start, first, 0, 3, { pressed: true }, 0.1);
    expect(faster.stroke).toBeGreaterThan(slower.stroke);
    expect(stepDig(faster, first, 0, 3, { pressed: false }, tuning.digSeconds[3]).outcome).toBe('success');
    expect(stepDig(faster, second, 0, 3, { pressed: false }, 0.1).stroke).toBe(0);
  });

  it('gives zero dig a feedback beat, then fails; idle runs time out', () => {
    const start = startDig([first]);
    const stuck = stepDig(start, first, 0, 0, { pressed: true }, 0.1);
    expect(stuck.outcome).toBe('running');
    expect(stepDig(stuck, first, 0, 0, { pressed: false }, tuning.stuckSeconds).outcome).toBe('fail');
    expect(stepDig(start, first, 0, 3, { pressed: false }, tuning.timeoutSeconds).outcome).toBe('fail');
  });
});
