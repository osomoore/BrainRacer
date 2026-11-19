import { describe, expect, it } from 'vitest';
import { FREIGHT } from '../config/gameConfig';
import { canReform, debrisVelocity, detachedFrom, shouldSmash } from './freightSmash';

describe('freightSmash', () => {
  it('slow cars bounce, turbo or fast impacts smash', () => {
    expect(shouldSmash(false, 200)).toBe(false);
    expect(shouldSmash(false, FREIGHT.smashImpactSpeed)).toBe(true);
    expect(shouldSmash(true, 0)).toBe(true);
  });
  it('detaches hit car and everything behind it', () => {
    expect(detachedFrom(2, 5, [false, false, false, false, false])).toEqual([2, 3, 4]);
    expect(detachedFrom(0, 3, [false, false, false])).toEqual([0, 1, 2]);
    expect(detachedFrom(1, 4, [false, false, true, false])).toEqual([1, 3]);
  });
  it('re-forms only after the delay and when the slot is free', () => {
    expect(canReform(FREIGHT.reformSec - 0.1, 0, false)).toBe(false);
    expect(canReform(FREIGHT.reformSec, 0, true)).toBe(false);
    expect(canReform(FREIGHT.reformSec, 0, false)).toBe(true);
  });
  it('debris velocity is deterministic', () => {
    const v = debrisVelocity({ x: 1, y: 0 }, 100, { spread: 0, speedMul: 2 });
    expect(v.vx).toBeCloseTo(200);
    expect(v.vy).toBeCloseTo(0);
  });
});
