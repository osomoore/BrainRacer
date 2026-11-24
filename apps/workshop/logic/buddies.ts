import { BUDDY_KINDS, type BuddyKind } from '../../../shared/buddies/catalog';
import { WS_BUDDIES } from '../config';
import { Rng } from '../core/rng';
import type { WorkshopBuddies, WorkshopProgress } from '../core/types';

const DEFAULT_BUDDY: BuddyKind = 'dino';
const known = new Set<unknown>(BUDDY_KINDS);
const isBuddy = (value: unknown): value is BuddyKind => known.has(value);

/** The buddy a new profile starts with, drawn from its seed (the same seed always gives the same buddy). */
export function startingBuddy(seed: number): BuddyKind {
  return new Rng(seed).pick(BUDDY_KINDS);
}

/**
 * `start` is the buddy owned when nothing is saved yet (legacy saves without buddy data get the dino).
 * Saved ownership is kept as saved, so a profile whose starting buddy is not the dino may not own the dino.
 */
export function normalizeBuddies(raw: unknown, start: BuddyKind = DEFAULT_BUDDY): WorkshopBuddies {
  const saved = raw && typeof raw === 'object' ? raw as Partial<Record<keyof WorkshopBuddies, unknown>> : {};
  const unlocked = [...new Set(Array.isArray(saved.unlocked) ? saved.unlocked.filter(isBuddy) : [])];
  if (unlocked.length === 0) unlocked.push(start);
  const selected = isBuddy(saved.selected) && unlocked.includes(saved.selected) ? saved.selected : unlocked.includes(start) ? start : unlocked[0];
  const wins = typeof saved.progress === 'number' && Number.isFinite(saved.progress) ? Math.floor(saved.progress) : 0;
  const progress = unlocked.length === BUDDY_KINDS.length
    ? WS_BUDDIES.winsPerUnlock
    : Math.max(0, Math.min(wins, WS_BUDDIES.winsPerUnlock - 1));
  return { unlocked, selected, progress };
}

/** Called after a challenge first passes validation as a win. */
export function advanceBuddies(buddies: WorkshopBuddies, seed: number, cleverWin: boolean): {
  buddies: WorkshopBuddies;
  unlockedBuddy?: BuddyKind;
} {
  if (buddies.unlocked.length === BUDDY_KINDS.length) return { buddies };
  const progress = buddies.progress + (cleverWin ? 2 : 1);
  if (progress < WS_BUDDIES.winsPerUnlock) return { buddies: { ...buddies, progress } };

  const locked = BUDDY_KINDS.filter((buddy) => !buddies.unlocked.includes(buddy));
  const unlockedBuddy = new Rng(seed).pick(locked);
  return {
    buddies: {
      ...buddies,
      unlocked: [...buddies.unlocked, unlockedBuddy],
      progress: locked.length === 1 ? WS_BUDDIES.winsPerUnlock : progress - WS_BUDDIES.winsPerUnlock,
    },
    unlockedBuddy,
  };
}

export function setBuddy(p: WorkshopProgress, buddy: BuddyKind): WorkshopProgress {
  if (!p.buddies.unlocked.includes(buddy) || p.buddies.selected === buddy) return p;
  return { ...p, buddies: { ...p.buddies, selected: buddy } };
}
