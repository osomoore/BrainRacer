import { describe, expect, it } from 'vitest';
import { crossingStop, fuelReading, waterEnvelope } from './choreography';

describe('race run choreography', () => {
  it('runs the fuel gauge from full down to the chosen reading without overshooting', () => {
    for (const reserve of [0, 0.14, 0.28]) {
      expect(fuelReading(-1, reserve)).toBe(1);
      expect(fuelReading(2, reserve)).toBeCloseTo(reserve);
      const readings = [0, 0.25, 0.5, 0.75, 1].map((t) => fuelReading(t, reserve));
      expect(readings).toEqual([...readings].sort((a, b) => b - a));
    }
  });

  it('returns the suspension smoothly to its dry height at each bank', () => {
    expect(waterEnvelope(-0.1)).toBe(0);
    expect(waterEnvelope(0)).toBe(0);
    expect(waterEnvelope(0.5)).toBe(1);
    expect(waterEnvelope(0.1)).toBeCloseTo(waterEnvelope(0.9));
    expect(waterEnvelope(1)).toBe(0);
    expect(waterEnvelope(1.1)).toBe(0);
  });

  it.each([40, 130, 280])('keeps noses of different sizes outside the crossing', (nose) => {
    expect(crossingStop(600, nose, 155) + nose).toBe(445);
  });
});
