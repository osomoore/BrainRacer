import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../../workshop/content';
import { defaultModel } from '../../workshop/logic/stats';
import type { Model, WorkshopId } from '../core/types';
import { traitsOf } from './traits';

function build(workshop: WorkshopId, parts: Model = {}) {
  return traitsOf({ workshop, model: { ...defaultModel(CATALOGS[workshop]), ...parts } });
}

describe('creation traits', () => {
  it.each(['race', 'dino'] as const)('gives the default %s mostly level-one abilities', workshop => {
    const { kind, speed, turn, accel, width, height, ...abilities } = build(workshop);
    expect(kind).toBe(workshop === 'race' ? 'car' : 'dino');
    expect({ width, height }).toEqual({ width: 2, height: 2 });
    for (const value of [speed, turn, accel]) expect(value).toBeGreaterThan(0);
    expect(Object.values(abilities).filter(value => value === 1).length).toBeGreaterThan(7);
    expect(Math.max(...Object.values(abilities))).toBe(1);
  });

  it('maps car specialties and water gear from Workshop stats and tags', () => {
    expect(build('race', { wheels: 'wheels.mud', gears: 'gears.fourByFour' }).mud).toBe(3);
    expect(build('race', { wheels: 'wheels.snow' }).snow).toBe(3);
    expect(build('race', { wheels: 'wheels.monster', body: 'body.jeep' }).rough).toBe(3);
    expect(build('race', { extra: 'extra.snorkel' }).water).toBe(2);
    expect(build('race', { extra: 'extra.floats' }).water).toBe(3);
    expect(build('race', { extra: 'extra.winch' })).toMatchObject({ mud: 2, push: 2 });
    expect(build('race', { extra: 'extra.rocket', springs: 'springs.bouncy' }).jump).toBe(3);
    expect(build('race', { paint: 'paint.yellow', body: 'body.van' })).toMatchObject({ light: 3, carry: 3 });
  });

  it('maps dino specialties from Workshop stats and tags', () => {
    expect(build('dino', { claws: 'claws.digging', head: 'head.longNeck', move: 'move.fly', extra: 'extra.glow' }))
      .toMatchObject({ dig: 3, reach: 3, jump: 3, light: 3 });
    expect(build('dino', { tail: 'tail.paddle', legs: 'legs.flippers', move: 'move.swim' }).water).toBe(3);
    expect(build('dino', { tail: 'tail.paddle' }).water).toBe(2);
    expect(build('dino', { size: 'size.huge', body: 'body.sail', head: 'head.crest' }))
      .toMatchObject({ push: 3, cold: 3, loud: 3 });
  });

  it('lets body size and height-affecting parts change passage fit', () => {
    expect(build('race', { size: 'size.tiny' })).toMatchObject({ width: 1, height: 1 });
    expect(build('race', { size: 'size.big', wheels: 'wheels.monster', springs: 'springs.lifted' }))
      .toMatchObject({ width: 4, height: 4 });
    expect(build('dino', { size: 'size.small', move: 'move.stand' })).toMatchObject({ width: 1, height: 2 });
    expect(build('dino', { size: 'size.huge' })).toMatchObject({ width: 4, height: 4 });
  });
});
