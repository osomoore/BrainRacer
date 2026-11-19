/**
 * Which words must never share a challenge (near-synonyms, one-contains-the-other, look-alikes).
 * Hand-checked pairs live in src/data/wordMeta.json `confusableWith` (single source of truth).
 */
import { WORD_META } from '../data/wordMeta';

function hasWholeWord(haystack: string, needle: string): boolean {
  return (` ${haystack} `).includes(` ${needle} `);
}

/** True when `a` and `b` are the same word, listed confusable, or one is a whole-word part of the other. */
export function wordsConflict(a: string, b: string): boolean {
  if (a === b) return true;
  if (WORD_META[a]?.confusableWith.includes(b) || WORD_META[b]?.confusableWith.includes(a)) return true;
  return hasWholeWord(a, b) || hasWholeWord(b, a);
}
