export const UNLOCK_BUDDIES = {
  fairy: { name: 'Fairy', glow: 0xff8bed },
  bumblebee: { name: 'Bumblebee', glow: 0xffda5b },
  owl: { name: 'Night Owl', glow: 0xe2b0ff },
  rocket: { name: 'Rocket', glow: 0xff9259 },
  bombBuddy: { name: 'Bomb Buddy', glow: 0xffb349 },
  cloudPuff: { name: 'Cloud Puff', glow: 0xb7eaff },
  firefly: { name: 'Firefly', glow: 0xe8ff83 },
  jelly: { name: 'Jelly', glow: 0x96f4ff },
  puffCub: { name: 'Puff Cub', glow: 0xc6ff8f },
  sporeSprout: { name: 'Spore Sprout', glow: 0xffb4ea },
  squareSnowman: { name: 'Square Snowman', glow: 0xbafaff },
  ember: { name: 'Ember', glow: 0xffb670 },
  sugarSprite: { name: 'Sugar Sprite', glow: 0xffa7d9 },
  crownSquire: { name: 'Crown Squire', glow: 0xffe17f },
  paperPlane: { name: 'Paper Plane', glow: 0xb8eeff },
  yarnBall: { name: 'Yarn Ball', glow: 0xffbd9f },
} as const;

export type UnlockBuddy = keyof typeof UNLOCK_BUDDIES;
export type BuddyKind = 'dino' | 'star' | UnlockBuddy;

export const BUDDY_KINDS: readonly BuddyKind[] = [
  'dino', 'star', ...Object.keys(UNLOCK_BUDDIES) as UnlockBuddy[],
];

export const BUDDY_DINO_FRAMES = ['buddy_dino_0', 'buddy_dino_1', 'buddy_dino_2'] as const;
export const BUDDY_GLOW_TEXTURE = 'buddy_glow';

export function buddyName(kind: BuddyKind): string {
  if (kind === 'dino') return 'Flying Dino';
  if (kind === 'star') return 'Twinkle Star';
  return UNLOCK_BUDDIES[kind].name;
}

export function buddyTexture(kind: BuddyKind): string {
  return kind === 'dino' ? BUDDY_DINO_FRAMES[0] : `buddy_${kind}`;
}
