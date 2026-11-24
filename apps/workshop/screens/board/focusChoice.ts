export type BoardFocusKey = `card:${string}` | 'cardPrev' | 'cardNext' | 'textPrev' | 'textNext' | 'newChallenges' | 'test' | 'back';

export function restoreChallengeIndex(ids: readonly string[], challengeId: string | undefined, previousIndex: number): number {
  const index = ids.indexOf(challengeId ?? '');
  return index >= 0 ? index : Math.min(previousIndex, Math.max(0, ids.length - 1));
}

const otherArrow = {
  cardPrev: 'cardNext', cardNext: 'cardPrev', textPrev: 'textNext', textNext: 'textPrev',
} as const;

export function chooseBoardFocus(saved: BoardFocusKey | undefined, available: readonly BoardFocusKey[], selectedCard: BoardFocusKey | undefined): BoardFocusKey | undefined {
  if (saved && available.includes(saved)) return saved;
  if (saved === 'cardPrev' || saved === 'cardNext' || saved === 'textPrev' || saved === 'textNext') {
    const sibling = otherArrow[saved];
    if (available.includes(sibling)) return sibling;
  }
  return selectedCard ?? available[0];
}
