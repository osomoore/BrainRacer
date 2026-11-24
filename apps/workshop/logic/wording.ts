import type { ReadingLevel } from '../core/types';

export const PHRASE_WORD_LIMIT: Record<ReadingLevel, number> = { easy: 6, medium: 8, hard: 12 };
/** Story lines on cards (two short sentences are fine). */
export const STORY_WORD_LIMIT: Record<ReadingLevel, number> = { easy: 10, medium: 12, hard: 14 };
/** Failure lines after the part names are filled in. */
export const FAIL_WORD_LIMIT: Record<ReadingLevel, number> = { easy: 12, medium: 14, hard: 16 };
export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
