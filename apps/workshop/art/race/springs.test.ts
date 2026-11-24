import { describe, expect, it } from 'vitest';
import { WS_ART } from '../../config';
import { RACE_VARIANTS } from '../../content/race/variants';
import { bodyLowerEdge, bodyTopAtAxle, raceGeom, raceLooks, SPRING_POKE_MARGIN, springEnds, springHeight, springPitch, tireRadius } from './geometry';
import { SPRING_BOB_MAX, SPRING_INSET } from './looks';

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
          // Where the wheel arch cuts the body above the axle there is no body left above it to hide the coil top in;
          // the spring then never pokes above the body (checked below) but the top can't be tucked in, so skip that check.
          const hideable = bodyTopAtAxle(springs, geo, ax) - geo.rideRaise + SPRING_POKE_MARGIN + 2 * SPRING_BOB_MAX < bodyLowerEdge(geo) - geo.rideRaise - 2;
          if ((hideable && !(ends.top < bodyEdge)) || !(ends.bottom > tireTop) || tireTop - bodyEdge < WS_ART.raceSpringGapMin) { bad.push(`${JSON.stringify(model)} ax=${ax} bob=${bob}`); break; }
        }
      }
    }
  return bad;
}

describe('race springs', () => {
  it('hides the top inside the body and the bottom behind the tire for every build', () => {
    expect(springFailures((id, _l, g, ax) => springHeight(id, g, ax))).toEqual([]);
  });

  it('tucks the coil top at least min(2 coil pitches, available room) inside the body for every build', () => {
    const bad: string[] = [];
    for (const body of ids('body')) for (const shape of ids('shape')) for (const size of ids('size'))
      for (const wheels of ids('wheels')) for (const springs of ids('springs')) {
        const model = { body, shape, size, wheels, springs };
        const look = raceLooks(model), geo = raceGeom(look);
        for (const ax of [geo.frontAxle, geo.rearAxle]) {
          const H = Math.round(springHeight(springs, geo, ax));
          const edge = bodyLowerEdge(geo) - geo.rideRaise;
          const ceil = geo.chassisTop(ax) - geo.rideRaise + SPRING_INSET;
          const depth = edge - springEnds(springs, H, geo, 0).top;
          // The cap is enforced at full bob, which lifts the coil top further than the body, so that bob travel is not usable room at rest.
          const bobLift = springEnds(springs, H, geo, 0).top - springEnds(springs, H, geo, SPRING_BOB_MAX).top;
          const room = edge - ceil - bobLift;
          const want = Math.min(2 * springPitch(springs, H), room);
          if (depth < want - 1.5) bad.push(`${JSON.stringify(model)} ax=${ax} depth=${depth.toFixed(1)} want=${want.toFixed(1)}`);
        }
      }
    expect(bad).toEqual([]);
  });
  it('never shows any part of the spring (coil or shock) above the body silhouette at its axle, at every bob', () => {
    const bad: string[] = [];
    for (const body of ids('body')) for (const shape of ids('shape')) for (const size of ids('size'))
      for (const wheels of ids('wheels')) for (const springs of ids('springs')) {
        const model = { body, shape, size, wheels, springs };
        const look = raceLooks(model), geo = raceGeom(look);
        for (const ax of [geo.frontAxle, geo.rearAxle]) {
          const H = Math.round(springHeight(springs, geo, ax));
          const bodyTop = bodyTopAtAxle(springs, geo, ax) - geo.rideRaise;
          for (const bob of [0, SPRING_BOB_MAX / 2, SPRING_BOB_MAX]) {
            // Both the body and the spring ride up by bob, so compare in the body's frame (the bob cancels except for the spring's own scale).
            const top = springEnds(springs, H, geo, bob).top + bob;
            if (top < bodyTop - 1) bad.push(`${JSON.stringify(model)} ax=${ax} bob=${bob} top=${top.toFixed(1)} bodyTop=${bodyTop.toFixed(1)}`);
          }
        }
      }
    expect(bad).toEqual([]);
  });
});
