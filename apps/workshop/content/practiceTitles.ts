import type { WorkshopId } from '../core/types';

export const PRACTICE_TITLES: Readonly<Record<WorkshopId, Readonly<Record<string, string>>>> = {
  race: {
    wheels: 'Tire Test',
    engine: 'Up the Hill',
    gears: 'Gear Run',
    springs: 'Bump Road',
    bumpers: 'Push and Roll',
    paint: 'Paint Day',
    body: 'Box Trip',
    shape: 'Wind Test',
    size: 'Find Your Gate',
    extra: 'One More Trick',
  },
  dino: {
    color: 'Hide and Seek',
    head: 'Head Tricks',
    teeth: 'Snack Time',
    claws: 'Claw Tricks',
    legs: 'Foot Test',
    move: 'Move Day',
    tail: 'Tail Play',
    body: 'Body Tricks',
    size: 'Find Your Den',
    extra: 'One More Trick',
  },
};
