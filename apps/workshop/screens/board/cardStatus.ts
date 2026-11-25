/**
 * Pure (Phaser-free) status badge for a board card: does the player already own everything the challenge needs
 * (check mark), can they buy what is missing right now (dollar sign), or not yet (red X).
 */
import type { Challenge, WorkshopCatalog, WorkshopProgress } from '../../core/types';
import { affordability } from '../../logic/affordability';
import { flatChecks } from '../../logic/util';

export type CardStatus = 'owned' | 'buyable' | 'locked';

/** One affordability budget per board build; call `of` per card. */
export function cardStatuses(cat: WorkshopCatalog, p: Pick<WorkshopProgress, 'wallet' | 'bought' | 'overrides' | 'easy'>) {
  const budget = affordability(cat, p);
  return {
    of(c: Pick<Challenge, 'stages'>): CardStatus {
      const cheapest = budget.cheapest(flatChecks(c));
      if (!cheapest) return 'locked';
      if (cheapest.cost === 0) return 'owned';
      return cheapest.cost <= p.wallet ? 'buyable' : 'locked';
    },
  };
}

/** Badge glyph and colour key per status. */
export const CARD_STATUS_BADGE: Record<CardStatus, { glyph: string; color: 'green' | 'yellow' | 'red' }> = {
  owned: { glyph: '✓', color: 'green' },
  buyable: { glyph: '$', color: 'yellow' },
  locked: { glyph: 'X', color: 'red' },
};
