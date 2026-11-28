import { BUDDY_KINDS, type BuddyKind } from '../../../shared/buddies/catalog';
import { WORLD_BUDDIES } from '../config';
import type { BuddySpot, WorldPlayerSave } from '../core/types';
import { hash } from '../gen/random';

const purchaseId = /^\d+:-?\d+,-?\d+:buddy$/;
const kinds = new Set<unknown>(BUDDY_KINDS);
type BuddySave = NonNullable<WorldPlayerSave['buddies']>;

export function normalizeBuddies(raw: unknown): BuddySave | undefined {
  if (!raw || typeof raw !== 'object' || !('purchases' in raw)) return;
  const { purchases } = raw;
  if (!purchases || typeof purchases !== 'object' || Array.isArray(purchases)) return;
  const valid = Object.fromEntries(Object.entries(purchases).filter(
    ([key, kind]) => purchaseId.test(key) && kinds.has(kind),
  )) as Record<string, BuddyKind>;
  const owned = Object.values(valid);
  if (!owned.length) return;
  const following = 'following' in raw ? raw.following as BuddyKind : undefined;
  return { purchases: valid, ...(following && owned.includes(following) ? { following } : {}) };
}

function ledgerKey(seed: number, spot: BuddySpot): string {
  return `${seed >>> 0}:${spot.id}`;
}

export function buddyOffer(seed: number, spot: BuddySpot, profileId: string, save: WorldPlayerSave): BuddyKind | undefined {
  if (save.buddies?.purchases[ledgerKey(seed, spot)]) return;
  return BUDDY_KINDS[hash(seed, spot.id, profileId) % BUDDY_KINDS.length];
}

export function buyBuddy(seed: number, spot: BuddySpot, profileId: string, save: WorldPlayerSave): 'bought' | 'short' | 'claimed' {
  const kind = buddyOffer(seed, spot, profileId, save);
  if (!kind) return 'claimed';
  if (save.stars < WORLD_BUDDIES.price) return 'short';
  const purchases = { ...save.buddies?.purchases, [ledgerKey(seed, spot)]: kind };
  save.stars -= WORLD_BUDDIES.price;
  save.buddies = { ...save.buddies, purchases };
  return 'bought';
}

export function ownedBuddies(save: WorldPlayerSave): BuddyKind[] {
  const owned = new Set(Object.values(save.buddies?.purchases ?? {}));
  return BUDDY_KINDS.filter(kind => owned.has(kind));
}

export function chooseBuddy(save: WorldPlayerSave, kind: BuddyKind | undefined): boolean {
  if (!save.buddies || save.buddies.following === kind || (kind && !ownedBuddies(save).includes(kind))) return false;
  if (kind) save.buddies.following = kind;
  else delete save.buddies.following;
  return true;
}
