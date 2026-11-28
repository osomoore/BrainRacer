import { buddyName, type BuddyKind } from '../../../shared/buddies/catalog';
import { WORLD_BUDDIES } from '../config';
import type { ReadingLevel } from '../core/types';

export const BUDDY_PRICE = `${WORLD_BUDDIES.price} stars`;
export const BUDDY_SHORT = `You need ${BUDDY_PRICE}.`;

export function buddyQuestion(kind: BuddyKind, reading: ReadingLevel): string {
  const name = buddyName(kind);
  return reading === 'starter' ? `${name}\nGo with it? ${BUDDY_PRICE}?`
    : `${name} wants to come along!\n${BUDDY_PRICE}?`;
}
