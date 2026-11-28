import type { Rng } from '../../workshop/core/rng';
import { WORLD_BUDDIES } from '../config';
import { hexKey } from './hex';
import type { HexLayout } from './layout';

export function buildBuddySpot(layout: HexLayout, rng: Rng): void {
  const { plan } = layout;
  if (plan.home || !rng.chance(WORLD_BUDDIES.spotChance)) return;
  // Leave room for the hand prompt without competing with adjacent activities or props.
  const at = layout.place(rng, WORLD_BUDDIES.spotClearance, 'ground');
  if (at) plan.buddySpot = { id: `${hexKey(plan.coord)}:buddy`, at };
}
