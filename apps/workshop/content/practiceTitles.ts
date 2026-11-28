import type { WorkshopId } from '../core/types';

export const PRACTICE_TITLES: Readonly<Record<WorkshopId, Readonly<Record<string, string>>>> = {
  race: {
    wheels: 'Tire Trail',
    engine: 'Up the Hill',
    gears: 'Gear Run',
    springs: 'Bump Road',
    bumpers: 'Push and Roll',
    paint: 'Color Show',
    body: 'Box Trip',
    shape: 'Windy Road',
    size: 'Find Your Gate',
    extra: 'One More Trick',
  },
  dino: {
    color: 'Hide and Seek',
    head: 'Look and Listen',
    teeth: 'Snack Time',
    claws: 'Claw Tricks',
    legs: 'Foot Path',
    move: 'Move Day',
    tail: 'Swish and Wag',
    body: 'Dino Show',
    size: 'Find Your Den',
    extra: 'One More Trick',
  },
};

export const STARTER_PRACTICE_TITLES: typeof PRACTICE_TITLES = {
  race: {
    wheels: 'Grip Run',
    engine: 'Hill Run',
    gears: 'Shift Up',
    springs: 'Bump Hop',
    bumpers: 'Push Job',
    paint: 'Tint Fun',
    body: 'Box Trip',
    shape: 'Fit In',
    size: 'Big Gap',
    extra: 'Fun Bit',
  },
  dino: {
    color: 'Hide Spot',
    head: 'Hat Fun',
    teeth: 'Snack Grab',
    claws: 'Grab It',
    legs: 'Big Kick',
    move: 'Step Up',
    tail: 'Tail Swish',
    body: 'Flex Fun',
    size: 'Den Fit',
    extra: 'Fun Bit',
  },
};
