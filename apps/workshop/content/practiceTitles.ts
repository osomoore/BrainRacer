import type { WorkshopId } from '../core/types';

export const PRACTICE_TITLES: Readonly<Record<WorkshopId, Readonly<Record<string, string>>>> = {
  race: {
    wheels: 'Tire Test',
    engine: 'Up the Hill',
    gears: 'Gear Run',
    springs: 'Bump Road',
    bumpers: 'Push and Roll',
    paint: 'Color Show',
    body: 'Box Trip',
    shape: 'Wind Test',
    size: 'Find Your Gate',
    extra: 'One More Trick',
  },
  dino: {
    color: 'Hide and Seek',
    head: 'Look and Listen',
    teeth: 'Snack Time',
    claws: 'Claw Tricks',
    legs: 'Foot Test',
    move: 'Move Day',
    tail: 'Wag Test',
    body: 'Dino Show',
    size: 'Find Your Den',
    extra: 'One More Trick',
  },
};

export const STARTER_PRACTICE_TITLES: typeof PRACTICE_TITLES = {
  race: {
    wheels: 'Grip Test',
    engine: 'Hill Run',
    gears: 'Shift Test',
    springs: 'Hop Test',
    bumpers: 'Bump Test',
    paint: 'Tint Test',
    body: 'Box Trip',
    shape: 'Fit Test',
    size: 'Gap Test',
    extra: 'Fun Bit',
  },
  dino: {
    color: 'Hide Test',
    head: 'Hat Test',
    teeth: 'Snack Test',
    claws: 'Grab Test',
    legs: 'Kick Test',
    move: 'Step Test',
    tail: 'Swish Test',
    body: 'Flex Test',
    size: 'Den Test',
    extra: 'Fun Bit',
  },
};
