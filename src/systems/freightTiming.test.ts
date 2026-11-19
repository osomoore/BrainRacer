import { describe, expect, it } from 'vitest';
import { FREIGHT } from '../config/gameConfig';
import { freightFrameAt } from './freightTiming';

const crossingStart = 1024;
const crossingWidth = 256;
const trainLength = 672;
const frame = (time: number) => freightFrameAt(time, crossingStart, crossingWidth, trainLength);

describe('freight crossing timing', () => {
  it('flashes and leaves time to stop or turn before the train enters', () => {
    const warning = FREIGHT.firstWarningSec;
    expect(frame(warning - 0.01).warningFlash).toBe(-1);
    expect(frame(warning).warningFlash).toBe(0);
    expect(frame(warning + FREIGHT.flashStepSec + 0.01).warningFlash).toBe(1);
    const arrival = warning + FREIGHT.warningLeadSec;
    expect(frame(arrival - 0.01).occupied).toBe(false);
    expect(frame(arrival).occupied).toBe(true);
    expect(frame(arrival).front).toBeCloseTo(crossingStart);
  });

  it('keeps flashing as the last car clears, then repeats the pass', () => {
    const departure = FREIGHT.firstWarningSec + FREIGHT.warningLeadSec + (crossingWidth + trainLength) / FREIGHT.speed;
    expect(frame(departure - 0.01).occupied).toBe(true);
    expect(frame(departure + 0.01).occupied).toBe(false);
    expect(frame(departure + 0.01).warningFlash).toBeGreaterThanOrEqual(0);
    expect(frame(departure + FREIGHT.warningTailSec + 0.01).warningFlash).toBe(-1);
    const early = FREIGHT.firstWarningSec + 1;
    expect(frame(early + FREIGHT.periodSec)).toEqual(frame(early));
  });
});
