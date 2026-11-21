export const QUEUED_MAP_LABEL = {
  brickworks: 'Brickworks',
  mushroom: 'Mushroom Island',
  tundra: 'Frozen Tundra',
  volcano: 'Volcano',
  candy: 'Candyland',
  castle: 'Castle',
  airport: 'Airport',
  house: 'In My House',
} as const;

export type QueuedMap = keyof typeof QUEUED_MAP_LABEL;
export const QUEUED_MAPS = Object.keys(QUEUED_MAP_LABEL) as QueuedMap[];

export function isQueuedMap(map: string): map is QueuedMap {
  return Object.hasOwn(QUEUED_MAP_LABEL, map);
}
