import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../../workshop/content';
import { defaultModel } from '../../workshop/logic/stats';
import type { Model, WorkshopId } from '../core/types';
import { terrainWall } from './rules';
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
    expect(Object.values(abilities).filter(value => value === 1).length).toBeGreaterThan(5);
    expect(Math.max(...Object.values(abilities))).toBe(1);
    expect(abilities).toMatchObject({ light: 0, heat: 0, smash: 0, raised: 0 });
  });

  it('maps car specialties and water gear from Workshop stats and tags', () => {
    expect(build('race', { wheels: 'wheels.mud', gears: 'gears.fourByFour' }).mud).toBe(3);
    expect(build('race', { wheels: 'wheels.snow' }).snow).toBe(3);
    expect(build('race', { wheels: 'wheels.monster', body: 'body.jeep' }).rough).toBe(3);
    expect(build('race', { extra: 'extra.snorkel' }).water).toBe(2);
    expect(build('race', { extra: 'extra.floats' }).water).toBe(3);
    expect(build('race', { extra: 'extra.winch' })).toMatchObject({ mud: 2, push: 2, winch: 1, rocket: 0 });
    expect(build('race', { extra: 'extra.rocket', springs: 'springs.bouncy' })).toMatchObject({ jump: 3, rocket: 1, winch: 0 });
    expect(build('race', { extra: 'extra.radiator' }).heat).toBe(3);
    expect(build('race', { extra: 'extra.rallyLights' }).light).toBe(3);
    expect(build('race', { paint: 'paint.yellow', body: 'body.van', engine: 'engine.efficient' }))
      .toMatchObject({ light: 0, heat: 0, carry: 3 });
  });

  it('raises World road speed modestly with engine and gear upgrades', () => {
    const stock = build('race').speed;
    const upgrades: Model[] = [
      { engine: 'engine.big' }, { engine: 'engine.turbo' },
      { gears: 'gears.speedy' }, { engine: 'engine.turbo', gears: 'gears.speedy' },
    ];
    for (const parts of upgrades) {
      const speed = build('race', parts).speed;
      expect(speed).toBeGreaterThanOrEqual(stock * 1.10 - 0.001);
      expect(speed).toBeLessThanOrEqual(stock * 1.25);
    }
    const climber = build('race', { gears: 'gears.climbing' });
    expect(climber.speed).toBeLessThan(stock);
    expect(climber.mud).toBeGreaterThan(build('race').mud);
    expect(climber.rough).toBeGreaterThan(build('race').rough);
  });

  it.each(['starter', 'easy', 'medium', 'hard'] as const)('applies the World reading rule at %s', reading => {
    const young = reading === 'starter' || reading === 'easy';
    const car = traitsOf({ workshop: 'race', model: defaultModel(CATALOGS.race) }, reading);
    const dino = traitsOf({ workshop: 'dino', model: defaultModel(CATALOGS.dino) }, reading);
    expect(car).toMatchObject({ heat: young ? 3 : 0, light: 0 });
    expect(dino).toMatchObject({ light: young ? 3 : 0, heat: 0 });
    expect(terrainWall({ kind: 'road', biome: 'desert', covered: false, dark: 0, heat: 1 }, car))
      .toBe(young ? undefined : 'heat');
    expect(terrainWall({ kind: 'road', biome: 'darkwood', covered: false, dark: 1 }, dino))
      .toBe(young ? undefined : 'dark');
  });

  it('gives heat dissipation to cool dinos and smash to the contact parts', () => {
    expect(build('dino', { color: 'color.sandy' }).heat).toBe(2);
    expect(build('dino', { body: 'body.slim' }).heat).toBe(2);
    expect(build('dino', { extra: 'extra.frill' }).heat).toBe(3);
    expect(build('dino', { body: 'body.sail' })).toMatchObject({ heat: 3, cold: 2 });
    expect(build('dino', { head: 'head.horned' }).smash).toBe(1);
    expect(build('dino', { tail: 'tail.heavy' }).smash).toBe(1);
    expect(build('race', { bumpers: 'bumpers.pusher' })).toMatchObject({ smash: 1, pushBumper: 1 });
    expect(build('race', { gears: 'gears.climbing', shape: 'shape.wedge' }).smash).toBe(0);
  });

  it('maps dino specialties from Workshop stats and tags', () => {
    expect(build('dino', { claws: 'claws.digging', head: 'head.longNeck', move: 'move.fly', extra: 'extra.glow' }))
      .toMatchObject({ dig: 3, reach: 3, jump: 3, light: 3, wings: 1 });
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
