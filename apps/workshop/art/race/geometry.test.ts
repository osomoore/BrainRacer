import { describe, expect, it } from 'vitest';
import { jeepSpareMount, raceGeom, raceLooks, winchMount } from './geometry';
import { BODY, JEEP_SPARE, SHAPE, SIZE_SCALE, SPRING, WHEEL, WINCH_SCALE } from './looks';

describe('Race Shop attachments', () => {
  it('keeps the low spare and raised winch clear of the running tires', () => {
    for (const body of Object.keys(BODY)) {
      for (const shape of Object.keys(SHAPE)) {
        for (const size of Object.keys(SIZE_SCALE)) {
          for (const wheels of Object.keys(WHEEL)) {
            for (const springs of Object.keys(SPRING)) {
              const model = { body, shape, size, wheels, springs };
              const look = raceLooks(model);
              const geo = raceGeom(look);
              const radius = geo.wheelRadius * (look.wheel.tread === 'monster' ? 1 + 14 / look.wheel.r : 1) + 4;
              const winch = winchMount(look, geo);
              const housingBack = winch.x - 28 * WINCH_SCALE;
              const housingBottom = winch.y + 2 - geo.rideRaise;
              expect(winch.y, JSON.stringify(model)).toBeLessThan(geo.bottom - 4);
              expect(Math.hypot(housingBack - geo.frontAxle, housingBottom - geo.hubY), JSON.stringify(model)).toBeGreaterThan(radius);

              if (body === 'body.jeep') {
                const spare = jeepSpareMount(look, geo);
                const lowerEdge = spare.y + JEEP_SPARE.diameter;
                const spareFront = spare.x + JEEP_SPARE.depth + 3;
                const spareBottom = lowerEdge + 3 - geo.rideRaise;
                expect(lowerEdge, JSON.stringify(model)).toBeCloseTo(geo.bottom - 25);
                expect(Math.hypot(spareFront - geo.rearAxle, spareBottom - geo.hubY), JSON.stringify(model)).toBeGreaterThan(radius);
              }
            }
          }
        }
      }
    }
  });
});
