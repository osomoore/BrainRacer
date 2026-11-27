import { describe, expect, it } from 'vitest';
import { WORLD_ACTIVITIES } from '../../../config';
import { startHerd, stepHerd } from './state';

const pen = { x: 0, y: 0 }, sheep = { x: 92, y: 0 };
const behind = { x: 148, y: 0 }, stopped = { x: 0, y: 0 };
const clear = () => true;
const tuning = WORLD_ACTIVITIES.herdSheep;

describe('Herd Sheep', () => {
  it('nudges sheep away from an approaching creation, even with no loud trait', () => {
    const start = startHerd([sheep]);
    expect(stepHerd(start, pen, behind, { x: 25, y: 0 }, false, 0, 0.5, clear).sheep[0].at).toEqual(sheep);
    const nudged = stepHerd(start, pen, behind, { x: -25, y: 0 }, false, 0, 0.5, clear);
    expect(nudged.sheep[0].penned).toBe(true);
    expect(nudged.outcome).toBe('success');
  });

  it('uses loudness for both the honk reach and the distance each sheep flees', () => {
    const start = startHerd([sheep, { x: -92, y: 0 }]);
    const distant = { x: 92, y: 132 };
    expect(stepHerd(start, pen, distant, stopped, true, 0, 0.1, clear).sheep[0].at).toEqual(sheep);
    const quiet = stepHerd(start, pen, { x: 92, y: 80 }, stopped, true, 0, 0.5, clear);
    let loud = stepHerd(start, pen, distant, stopped, true, 3, 0.3, clear);
    loud = stepHerd(loud, pen, distant, stopped, false, 3, 0.4, clear);
    expect(loud.sheep[0].at.y).toBeLessThan(quiet.sheep[0].at.y);
    expect(loud.sheep[1].at.x).toBe(-92);
    expect(loud.outcome).toBe('running');
  });

  it('keeps penned sheep put, respects barriers, and fails when time runs out', () => {
    const start = startHerd([sheep, { x: -92, y: 0 }]);
    expect(stepHerd(start, pen, behind, stopped, true, 2, 0.1, () => false).sheep[0].at).toEqual(sheep);
    const penned = stepHerd(start, pen, behind, stopped, true, 2, 0.3, clear);
    const honked = stepHerd(penned, pen, pen, stopped, true, 2, 0.3, clear);
    expect(honked.sheep[0]).toEqual(penned.sheep[0]);
    expect(stepHerd(honked, pen, pen, stopped, false, 2, tuning.timeoutSeconds, clear).outcome).toBe('fail');
  });
});
