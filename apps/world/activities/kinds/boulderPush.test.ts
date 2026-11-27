import { describe, expect, it } from 'vitest';
import { pushBoulder, stepBoulders } from './boulderPush';

describe('boulder push helper', () => {
  it('needs a suitable push build, motion and close contact', () => {
    const rock = { x: 0, y: 0 }, spot = { x: 100, y: 0 };
    expect(pushBoulder(rock, spot, { x: 0, y: 0 }, 1, { x: 100, y: 0 }, 1)).toEqual(rock);
    expect(pushBoulder(rock, spot, { x: 200, y: 0 }, 3, { x: 100, y: 0 }, 1)).toEqual(rock);
    expect(pushBoulder(rock, spot, { x: 0, y: 0 }, 3, { x: 0, y: 0 }, 1)).toEqual(rock);
    expect(pushBoulder(rock, spot, { x: 0, y: 0 }, 3, { x: -40, y: 0 }, 1)).toEqual(rock);
  });

  it('moves deterministically toward the marked spot and clamps at it', () => {
    const start = { x: 0, y: 0 }, spot = { x: 50, y: 0 }, player = { x: 0, y: 0 };
    expect(pushBoulder(start, spot, player, 3, { x: 40, y: 0 }, 0.5)).toEqual({ x: 39, y: 0 });
    expect(pushBoulder(start, spot, player, 3, { x: 40, y: 0 }, 2)).toEqual(spot);
  });

  it('finishes all targets, fails after repeated blocked effort, and times out', () => {
    const starting = { rocks: [{ x: 82, y: 0 }], spots: [{ x: 0, y: 0 }], elapsed: 0, blocked: 0 };
    const finished = stepBoulders(starting, { x: 82, y: 0 }, 3, { x: -40, y: 0 }, 2);
    expect(finished.outcome).toBe('success');

    const blocked = { ...starting, rocks: [{ x: 0, y: 0 }], spots: [{ x: 100, y: 0 }] };
    const failed = stepBoulders(blocked, { x: 0, y: 0 }, 1, { x: 40, y: 0 }, 5);
    expect(failed.outcome).toBe('fail');
    const timed = stepBoulders({ ...blocked, elapsed: 54.9 }, { x: 500, y: 0 }, 3, { x: 40, y: 0 }, 0.2);
    expect(timed.outcome).toBe('fail');
  });
});
