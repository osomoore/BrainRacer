import { describe, expect, it } from 'vitest';
import { stepPending } from './rewardDelay';

describe('stepPending', () => {
  it('waits the rest of the panel fade plus the extra beat, in game time', () => {
    const g = { resolvedAtSec: 10, waitSec: null as number | null };
    // world resumed 0.6 s after the answer: 0.45 s of panel left + 0.7 s
    expect(stepPending(g, 10.6, 0.016, 1.05, 0.7)).toBe(false);
    expect(g.waitSec).toBeCloseTo(0.45 + 0.7 - 0.016, 5);
    let t = 0.016, fired = false;
    while (!fired && t < 3) { fired = stepPending(g, 99, 0.016, 1.05, 0.7); t += 0.016; }
    expect(t).toBeCloseTo(1.15, 1);
  });
  it('panel already gone: only the extra beat', () => {
    const g = { resolvedAtSec: 0, waitSec: null as number | null };
    stepPending(g, 5, 0, 1.05, 0.7);
    expect(g.waitSec).toBeCloseTo(0.7);
  });
  it('paused game (dt 0) never fires', () => {
    const g = { resolvedAtSec: 0, waitSec: null as number | null };
    for (let i = 0; i < 100; i++) expect(stepPending(g, 5 + i, 0, 1.05, 0.7)).toBe(false);
  });
});
