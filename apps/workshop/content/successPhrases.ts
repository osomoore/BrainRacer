import type { LeveledPhrases, SuccessPhrases } from '../core/types';

type Row = readonly [starter: string, easy: string, medium: string, hard: string];
type Endings = readonly [string, string];

export function qualityRows(a: Row, b: Row): LeveledPhrases {
  return { starter: [a[0], b[0]], easy: [a[1], b[1]], medium: [a[2], b[2]], hard: [a[3], b[3]] };
}

/** Two named sentence endings and two quality sentences per reading level. */
export function success(starter: readonly string[], named: Endings, a: Row, b: Row, hard: Endings = named): SuccessPhrases {
  return { named: { starter, easy: named, medium: named, hard }, quality: qualityRows(a, b) };
}
