import type { Challenge, Leveled, LeveledPhrases, ReadingLevel } from '../core/types';

export const PHRASE_WORD_LIMIT: Record<ReadingLevel, number> = { starter: 5, easy: 6, medium: 8, hard: 12 };
/** Story lines on cards (two short sentences are fine). */
export const STORY_WORD_LIMIT: Record<ReadingLevel, number> = { starter: 6, easy: 10, medium: 12, hard: 14 };
/** Failure lines after the part names are filled in. */
export const FAIL_WORD_LIMIT: Record<ReadingLevel, number> = { starter: 6, easy: 12, medium: 14, hard: 16 };
export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

export function readingLines(bank: LeveledPhrases | undefined, reading: ReadingLevel): readonly string[] | undefined {
  const lines = bank?.[reading];
  if (lines?.length) return lines;
  return reading === 'starter' && bank?.easy?.length ? bank.easy : undefined;
}

export const readingText = (text: Leveled, reading: ReadingLevel): string => text[reading] ?? text.easy;

export const challengeTitle = (challenge: Challenge, reading: ReadingLevel): string =>
  reading === 'starter' ? challenge.starterTitle ?? challenge.title : challenge.title;

/** Position-based label for the three starter tests. */
export const starterTestTitle = (position: number): string => `Test ${position + 1}`;
export const starterBoardLabel = (position: number): string => String(position + 1);

export const STARTER_HINT = ['Check {aspect}.', 'Go to {aspect}.'] as const;
export const STARTER_PART = 'Get {part}.';
export const STARTER_SHORT_FIX = 'Get {parts}.';
export const STARTER_FAIL = 'Put on {parts}.';
export const STARTER_TEST_TITLE = 'Test Run';

export const STARTER_RESULTS = {
  win: 'You did it!',
  fail: 'It did not pass.',
  retry: 'Test it!',
  board: 'Pick a Test',
  shop: 'Back to Shop',
  lab: 'Back to Lab',
} as const;
