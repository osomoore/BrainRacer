import type { LeveledPhrases, SuccessPhrases } from '../core/types';

type Row = readonly [easy: string, medium: string, hard: string];
type Endings = readonly [string, string];

export function qualityRows(a: Row, b: Row): LeveledPhrases {
  return { easy: [a[0], b[0]], medium: [a[1], b[1]], hard: [a[2], b[2]] };
}

/** Two named sentence endings and two quality sentences per reading level. */
export function success(named: Endings, a: Row, b: Row, hard: Endings = named): SuccessPhrases {
  return { named: { easy: named, medium: named, hard }, quality: qualityRows(a, b) };
}
