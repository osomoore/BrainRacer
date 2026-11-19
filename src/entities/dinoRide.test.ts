import { describe, expect, it } from 'vitest';
import { DINO, DINO_RIDE } from '../config/gameConfig';
import {
  addHits, clampInside, dinoBoardable, dinoBoardDistance, healthFrac, hitValue, newRideTimer, returnChoice, rideSecondsShown, stepRide,
} from './dinoRide';

describe('dino hits', () => {
  it('three single hits beat the dino, each takes a third of the bar', () => {
    expect(DINO.hitsToDefeat).toBe(3);
    let hits = 0;
    const fracs: number[] = [];
    let defeated = false;
    for (let i = 0; i < 3; i++) {
      expect(defeated).toBe(false);
      ({ hits, defeated } = addHits(hits, hitValue(false, DINO.teamHits), DINO.hitsToDefeat));
      fracs.push(healthFrac(hits, DINO.hitsToDefeat));
    }
    expect(defeated).toBe(true);
    expect(fracs[0]).toBeCloseTo(2 / 3);
    expect(fracs[1]).toBeCloseTo(1 / 3);
    expect(fracs[2]).toBe(0);
  });

  it('a team hit counts double and hits never overflow', () => {
    expect(hitValue(true, 2)).toBe(2);
    expect(hitValue(true, 0)).toBe(1);
    const a = addHits(0, 2, 3);
    expect(a).toEqual({ hits: 2, defeated: false });
    expect(addHits(2, 2, 3)).toEqual({ hits: 3, defeated: true });
  });
});

describe('ride timer', () => {
  it('runs out once after the full duration', () => {
    const t = newRideTimer(DINO_RIDE.durationSec);
    let ended = 0;
    for (let i = 0; i < DINO_RIDE.durationSec * 60 + 30; i++) if (stepRide(t, 1 / 60, false)) ended++;
    expect(ended).toBe(1);
    expect(t.left).toBe(0);
  });

  it('does not count frozen (question) time', () => {
    const t = newRideTimer(2);
    for (let i = 0; i < 600; i++) expect(stepRide(t, 0.1, true)).toBe(false);
    expect(t.left).toBe(2);
    stepRide(t, 1.5, false);
    expect(t.left).toBeCloseTo(0.5);
    expect(stepRide(t, 1, false)).toBe(true);
  });

  it('shows whole seconds rounded up', () => {
    expect(rideSecondsShown(20)).toBe(20);
    expect(rideSecondsShown(19.01)).toBe(20);
    expect(rideSecondsShown(0.2)).toBe(1);
    expect(rideSecondsShown(0)).toBe(0);
  });
});

describe('boarding', () => {
  it('only a tame dino without a rider can be boarded', () => {
    expect(dinoBoardable({ active: true, tamed: true, rider: null })).toBe(true);
    expect(dinoBoardable({ active: true, tamed: true })).toBe(true);
    expect(dinoBoardable({ active: true, tamed: false, rider: null })).toBe(false);
    expect(dinoBoardable({ active: true, tamed: true, rider: 1 })).toBe(false);
    expect(dinoBoardable({ active: false, tamed: true, rider: null })).toBe(false);
  });

  it('measures reach from the dino edge', () => {
    expect(dinoBoardDistance({ x: 0, y: 0 }, { x: 300, y: 400 }, 150)).toBe(350);
  });

  it('returns to the own car when it is close and working, otherwise respawns', () => {
    expect(returnChoice({ x: 100, y: 0, usable: true }, { x: 0, y: 0 }, 1400)).toBe('own');
    expect(returnChoice({ x: 3000, y: 0, usable: true }, { x: 0, y: 0 }, 1400)).toBe('respawn');
    expect(returnChoice({ x: 100, y: 0, usable: false }, { x: 0, y: 0 }, 1400)).toBe('respawn');
    expect(returnChoice(null, { x: 0, y: 0 }, 1400)).toBe('respawn');
  });

  it('keeps the ridden dino inside the world', () => {
    expect(clampInside({ x: 500, y: 500 }, 1000, 1000, 100)).toBeNull();
    expect(clampInside({ x: -20, y: 1200 }, 1000, 1000, 100)).toEqual({ x: 100, y: 900 });
  });
});
