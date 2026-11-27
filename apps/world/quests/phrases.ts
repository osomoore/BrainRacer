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
export const PLACES = { biome: 'to the {biome}', home: 'back home', giver: 'back to your pal' } as const;

export const QUEST_PHRASES = {
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
    starter: [
      'Take the {item}. Go {place}.',
      'Get the {item}. Drive {place}.',
      'Pick up the {item}. Go {place}.',
    ],
    easy: [
      'Take the {item} {place}.',
      'Bring the {item} {place}.',
      'Carry the {item} {place}.',
    ],
    medium: [
      'Take the {item} with you and go {place}.',
      'Give the {item} a ride and head {place}.',
      'Pick up the {item}, then take it {place}.',
    ],
    hard: [
      'Take the {item} from {who}, then give it a ride {place}.',
      'When you leave {who}, give the {item} a ride {place}.',
      'The {item} is ready, so take it with you and drive {place}.',
    ],
  },
} as const satisfies Record<'fetch' | 'deliver', Record<ReadingLevel, readonly string[]>>;
