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
  doggy: 'doggy',
  hay: 'hay',
  apple: 'apple',
  bell: 'bell',
  bear: 'bear',
  log: 'log',
  frog: 'frog',
};

export const GIVER_NAMES = {
  turtle: 'the turtle',
  owl: 'the owl',
  goat: 'the goat',
  farmer: 'the farmer',
} as const;

export const OTHER_GIVER = 'your pal';
export const QUEST_PHRASES = {
  visitPond: {
    starter: ['The ducks need a snack. Go to the pond. Help them.'],
    easy: ['Hungry ducks! Feed them at a pond.'],
    medium: ['The ducks are hungry. Feed them at a pond.'],
    hard: ['The ducks are hungry. Find a pond and feed them a snack.'],
  },
  fetch: {
    starter: ['It is for the {use}. Try the {biome}. Get {a} {item}. Bring it back.'],
    easy: ['Bring me {a} {item} for my {use}.'],
    medium: ['For my {use}, bring me {a} {item}. Try the {biome}.'],
    hard: ['I need {a} {item} for my {use}. Try {biome}, then bring it back.'],
  },
  deliver: {
    starter: ['The duck can swim. Pick it up here. Take it to the pond.'],
    easy: ['Swim time! Drive my duck to the pond.'],
    medium: ['My duck wants a swim. Carry it to a pond.'],
    hard: ['My duck wants a swim. Pick it up and give it a ride to a pond.'],
  },
  hay: {
    starter: ['The cows need hay. Pick up the hay. Go to the cow pen. Drop it there.'],
    easy: ['Hungry cows! Take hay to a cow pen.'],
    medium: ['Hungry cows! Pick up hay. Drop it at any cow pen.'],
    hard: ['Our cows are hungry. Pick up a hay bale and drop it at any cow pen.'],
  },
  bell: {
    starter: ['The sun is up. Ring the bell.'],
    easy: ['Time to eat! Ring a bell.'],
    medium: ['Dinner is ready. Find a farm or camp bell and ring it.'],
    hard: ['Dinner is ready. Ring a bell at a farm or camp so everyone knows.'],
  },
  bear: {
    starter: ['The bear is asleep. Honk or roar. Wake it up.'],
    easy: ['Bear overslept. Honk or roar near the bear.'],
    medium: ['The bear slept in. Honk or roar nearby to wake it.'],
    hard: ['The bear missed breakfast. Honk or roar near one in Snowy Hills or by Dark Woods.'],
  },
  pathLog: {
    starter: ['The log is stuck. Push it off the path.'],
    easy: ['Stuck log! Push it off the path.'],
    medium: ['A log is in the way. Push it off the path.'],
    hard: ['A log is in the way. Push it off the path so we can pass.'],
  },
  frog: {
    starter: ['Go to the frog. Help it hop.'],
    easy: ['The frog is shy. Go say hi.'],
    medium: ['The frog wants a friend. Say hi by its lily pad.'],
    hard: ['The frog could use a friend. Say hi to one in Lake or Mud Marsh.'],
  },
  apple: {
    starter: ['I need an apple. Bump the apple tree. Pick it up. Bring it back.'],
    easy: ['Snack time! Bump an apple tree. Bring one.'],
    medium: ['I need a snack. Bump an apple tree. Bring one back.'],
    hard: ['I need a snack. Bump an apple tree, pick up an apple, and bring it back.'],
  },
  doggy: {
    starter: ['Help the doggy get home. Pick it up here. Go to a farm. Drop it off.'],
    easy: ['Lost doggy! Take it to a farm.'],
    medium: ['This doggy is lost. Pick it up and drive to a farm.'],
    hard: ['This doggy lost its way. Pick it up here and take it to any farm.'],
  },
} as const satisfies Record<string, Record<ReadingLevel, readonly string[]>>;
