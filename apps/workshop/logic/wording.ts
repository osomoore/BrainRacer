import type { ReadingLevel } from '../core/types';

export const PHRASE_WORD_LIMIT: Record<ReadingLevel, number> = { easy: 6, medium: 8, hard: 12 };
export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
