import { describe, expect, it } from 'vitest';
import { WS_ART } from '../../config';
import { RACE_VARIANTS } from '../../content/race/variants';
import { bodyLowerEdge, raceGeom, raceLooks, springEnds, springHeight, tireRadius } from './geometry';
import { SPRING_BOB_MAX } from './looks';

const ids = (aspect: string) => RACE_VARIANTS.filter((v) => v.aspect === aspect).map((v) => v.id);

function springFailures(height: (id: string, l: ReturnType<typeof raceLooks>, g: ReturnType<typeof raceGeom>, ax: number) => number): string[] {
  const bad: string[] = [];
  for (const body of ids('body')) for (const shape of ids('shape')) for (const size of ids('size'))
    for (const wheels of ids('wheels')) for (const springs of ids('springs')) {
      const model = { body, shape, size, wheels, springs };
      const look = raceLooks(model), geo = raceGeom(look);
      const tireTop = geo.hubY - tireRadius(look, geo);
      for (const ax of [geo.frontAxle, geo.rearAxle]) {
        const H = Math.round(height(springs, look, geo, ax));
        for (const bob of [0, SPRING_BOB_MAX / 2, SPRING_BOB_MAX]) {
          const ends = springEnds(springs, H, geo, bob);
          const bodyEdge = bodyLowerEdge(geo) - geo.rideRaise - bob;
          if (!(ends.top < bodyEdge) || !(ends.bottom > tireTop) || tireTop - bodyEdge < WS_ART.raceSpringGapMin) { bad.push(`${JSON.stringify(model)} ax=${ax} bob=${bob}`); break; }
        }
      }
    }
  return bad;
}

describe('race springs', () => {
  it('hides the top inside the body and the bottom behind the tire for every build', () => {
    expect(springFailures((id, _l, g, ax) => springHeight(id, g, ax))).toEqual([]);
  });
});
