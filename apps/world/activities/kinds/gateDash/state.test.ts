import { describe, expect, it } from 'vitest';
import { WORLD_ACTIVITIES } from '../../../config';
import { dashGates, startDash, stepDash } from './state';

const start = { x: 0, y: 0 };
const gates = dashGates(start, [50, 150, 250].map(x => ({ x, y: 0 })));

describe('Gate Dash', () => {
  it('sweeps through the three gate openings in order', () => {
    let state = startDash(start);
    state = stepDash(state, gates, { x: 70, y: 0 }, 0.3);
    expect(state.next).toBe(1);
    state = stepDash(state, gates, { x: 165, y: 0 }, 0.3);
    expect(state.next).toBe(2);
    expect(stepDash(state, gates, { x: 260, y: 0 }, 0.3).outcome).toBe('success');
  });

  it('ignores misses, reverse crossings, and later gates', () => {
    let state = startDash({ x: 0, y: 70 });
    state = stepDash(state, gates, { x: 80, y: 70 }, 0.4);
    state = stepDash(state, gates, { x: 215, y: 0 }, 0.5);
    state = stepDash(state, gates, start, 0.8);
    expect(state.next).toBe(0);
  });

  it('fails at the deadline', () => {
    const elapsed = WORLD_ACTIVITIES.gateDash.timeoutSeconds - 0.25;
    const state = { ...startDash({ x: 200, y: 0 }), next: 2, elapsed };
    expect(stepDash(state, gates, { x: 260, y: 0 }, 0.25).outcome).toBe('fail');
  });
});
