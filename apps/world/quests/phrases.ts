import type { BiomeId, ItemId, ReadingLevel } from '../core/types';

export const BIOME_NAMES: Record<BiomeId, string> = {
  meadow: 'Meadow',
  mud: 'Mud Marsh',
  rocky: 'Rocky Hills',
  lake: 'Lake',
  darkwood: 'Dark Woods',
  snow: 'Snowy Hills',
  desert: 'Desert',
  jungle: 'Jungle',
  canyon: 'Canyon',
  geyser: 'Hot Springs',
};

export const ITEM_NAMES: Record<ItemId, string> = {
  rock: 'rock',
  mudPie: 'mud pie',
  shell: 'shell',
  pinecone: 'pine cone',
  snowball: 'snowball',
  cactusFlower: 'cactus flower',
  fern: 'fern',
  crystal: 'crystal',
  feather: 'feather',
  egg: 'egg',
  duck: 'duck',
  lamb: 'lamb',
};

export const GIVER_NAMES = {
  turtle: 'the turtle',
  owl: 'the owl',
  goat: 'the goat',
  farmer: 'the farmer',
} as const;

export const OTHER_GIVER = 'your pal';
export const QUEST_PHRASES = {
  visitItem: {
    starter: ['Go to the {item}. Tap the hand.'],
    easy: ['Find {a} {item}. Tap the hand.'],
    medium: ['Look for {a} {item}, then tap the hand.'],
    hard: ['When you spot {a} {item}, go up to it and press the hand.'],
  },
  visitPond: {
    starter: ['Go to the pond. Help the ducks.'],
    easy: ['Feed the ducks at the pond.'],
    medium: ['Head to a pond and feed the ducks there.'],
    hard: ['Find a duck pond and stop by to feed the ducks.'],
  },
  fetch: {
    starter: [
      'Go to the {biome}. Get {a} {item}. Bring it back.',
      'Drive to the {biome}. Pick up {a} {item}. Bring it back.',
      'Go to the {biome}. Grab {a} {item}. Go back with it.',
    ],
    easy: [
      'Get {a} {item} at {biome}. Return.',
      'Find {a} {item} in {biome}. Return.',
      'Bring {a} {item} back from {biome}.',
    ],
    medium: [
      'Find {a} {item} in the {biome}, then bring it back.',
      'Head to the {biome} for {a} {item}, then come back.',
      'Pick up {a} {item} in {biome} and come back.',
    ],
    hard: [
      'Look for {a} {item} in the {biome}, then bring it back to {who}.',
      'When you find {a} {item} in the {biome}, take it back to {who}.',
      'Head to {biome} and pick up {a} {item} to bring back to {who}.',
    ],
  },
  deliver: {
    starter: ['Get the duck here. Go to the pond.'],
    easy: ['Take my duck to the pond.'],
    medium: ['Pick up my duck and give it a ride to a pond.'],
    hard: ['Pick up my duck, then give it a ride to a pond.'],
  },
} as const satisfies Record<string, Record<ReadingLevel, readonly string[]>>;
