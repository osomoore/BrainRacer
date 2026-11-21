import { describe, expect, it, vi } from 'vitest';
import { advanceGate, overlapsGate, shuttlePosition } from './queuedWorldCycle';

describe('timed world shortcuts', () => {
  it('warns before closing and waits for the crossing to clear', () => {
    const timing = { openSec: 24, warningSec: 3, closedSec: 6 };
    const occupied = vi.fn(() => true);
    const warning = advanceGate({ mode: 'open', elapsed: 23 }, 1, timing, occupied);
    expect(warning).toEqual({ mode: 'warning', elapsed: 0 });
    const almost = advanceGate(warning, 2.9, timing, occupied);
    expect(occupied).not.toHaveBeenCalled();
    const delayed = advanceGate(almost, 0.2, timing, occupied);
    expect(delayed).toEqual({ mode: 'warning', elapsed: 3 });
    const closed = advanceGate(delayed, 0.02, timing, () => false);
    expect(closed).toEqual({ mode: 'closed', elapsed: 0 });
    expect(advanceGate(closed, 6, timing, occupied)).toEqual({ mode: 'open', elapsed: 0 });
    expect(occupied).toHaveBeenCalledTimes(1);
  });

  it('considers the whole vehicle footprint even if the gate rotates', () => {
    const area = { x: 500, y: 100, depth: 64, span: 256, angle: Math.PI / 2 };
    expect(overlapsGate(area, { x: 500, y: 155 }, 24)).toBe(true);
    expect(overlapsGate(area, { x: 641, y: 100 }, 15)).toBe(true);
    expect(overlapsGate(area, { x: 644, y: 100 }, 15)).toBe(false);
    expect(overlapsGate(area, { x: 648, y: 152 }, 25)).toBe(false);
  });

  it('moves a shuttle through both track ends and back', () => {
    expect(shuttlePosition(0, 12)).toBe(-1);
    expect(shuttlePosition(3, 12)).toBeCloseTo(0);
    expect(shuttlePosition(6, 12)).toBe(1);
    expect(shuttlePosition(9, 12)).toBeCloseTo(0);
    expect(shuttlePosition(12, 12)).toBe(-1);
  });
});
