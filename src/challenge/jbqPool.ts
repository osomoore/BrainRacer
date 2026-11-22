/** JBQ question pool for a racer: the scope range, growing backwards through earlier weeks once everything in it is learned. */
import { CHALLENGE } from '../config/gameConfig';
import type { JbqLevel, JbqScope } from '../core/types';
import { jbqPointsOf, jbqRange, previousChunks } from './jbqScope';

const ids = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Question ids to draw from. `correctCount(id)` = how many times this racer answered the question correctly. */
export function jbqPool(level: JbqLevel, scope: JbqScope, date: string, correctCount: (id: number) => number): number[] {
  const base = jbqRange(level, scope, date);
  const pool = new Set(ids(base.from, base.to));
  if (level === 'basics') return [...pool];   // fixed set: no growth
  const learned = (id: number) => correctCount(id) >= CHALLENGE.jbqMasteredCorrect;
  for (const [from, to] of previousChunks(jbqPointsOf(level), date)) {
    if (![...pool].every(learned)) break;
    const chunk = ids(from, to);
    if (chunk.every((id) => pool.has(id))) continue;   // already inside the pool
    chunk.forEach((id) => pool.add(id));
  }
  return [...pool].sort((a, b) => a - b);
}
