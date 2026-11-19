import { describe, expect, it } from 'vitest';
import { FREIGHT } from '../config/gameConfig';
import { generateIndustrial } from '../world/gen/industrial';
import { carriagePose, crossingFrame, freightFrontAt, measureCircuit } from './freightTiming';

const rail = generateIndustrial(3).industrial!.rail;
const circuit = measureCircuit(rail);
const [first, second] = circuit.crossings;
const trainLength = 672;
const lap = circuit.length / FREIGHT.speed;
const frame = (time: number, crossing = first) => crossingFrame(circuit, crossing, freightFrontAt(circuit, time), trainLength);

describe('continuous industrial freight', () => {
  it('wraps forward and backward on the same circuit and carries wheelsets smoothly over the seam', () => {
    expect(circuit.sample(-20)).toEqual(circuit.sample(circuit.length - 20));
    expect(circuit.sample(circuit.length)).toEqual(rail.points[0]);
    const before = carriagePose(circuit, -0.1, 90), after = carriagePose(circuit, 0.1, 90);
    expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(0.21);
    expect(Math.abs(before.angle - after.angle)).toBeLessThan(0.01);
    expect(freightFrontAt(circuit, 10) - freightFrontAt(circuit, 9)).toBe(FREIGHT.speed);
    expect(circuit.sample(freightFrontAt(circuit, 10 + lap)).x).toBeCloseTo(circuit.sample(freightFrontAt(circuit, 10)).x);
  });

  it.each([first, second])('warns before arrival and until the last carriage clears each crossing', (crossing) => {
    const warning = FREIGHT.firstWarningSec + (crossing.start - first.start) / FREIGHT.speed;
    const arrival = warning + FREIGHT.warningLeadSec;
    const departure = arrival + (crossing.width + trainLength) / FREIGHT.speed;
    expect(frame(warning - 0.01, crossing).warningFlash).toBe(-1);
    expect(frame(warning + 0.01, crossing).warningFlash).toBe(0);
    expect(frame(warning + FREIGHT.flashStepSec + 0.01, crossing).warningFlash).toBe(1);
    expect(frame(arrival - 0.01, crossing).occupied).toBe(false);
    expect(frame(arrival + 0.01, crossing).occupied).toBe(true);
    expect(frame(departure - 0.01, crossing).occupied).toBe(true);
    expect(frame(departure + 0.01, crossing).occupied).toBe(false);
    expect(frame(departure + 0.01, crossing).warningFlash).toBeGreaterThanOrEqual(0);
    expect(frame(departure + FREIGHT.warningTailSec + 0.01, crossing).warningFlash).toBe(-1);
    expect(frame(arrival + 0.01 + lap, crossing)).toEqual(frame(arrival + 0.01, crossing));
  });

  it('keeps the opposite crossing open through every warning', () => {
    for (let time = 0; time < lap; time += 0.02) {
      expect(frame(time).warningFlash >= 0 && frame(time, second).warningFlash >= 0).toBe(false);
    }
  });
});
