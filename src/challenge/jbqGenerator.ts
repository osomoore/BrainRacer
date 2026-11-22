/** Builds JBQ (Junior Bible Quiz) challenge bodies. Phaser-free; randomness comes from the injected Rng. */
import { CHALLENGE } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type { AnswerSlot, ChallengeOption, JbqPoints, JbqScope } from '../core/types';
import rawRows from '../data/jbq.json';
import { jbqPool } from './jbqPool';

export interface JbqQuestion { id: number; points: JbqPoints; type: string; q: string; a: string; ref?: string; verse?: string }
export const JBQ_QUESTIONS = rawRows as JbqQuestion[];

export interface JbqGenerateOpts {
  points: JbqPoints;
  scope: JbqScope;
  /** Local date "YYYY-MM-DD". */
  date: string;
  /** Correct answers so far for a question id (this racer). */
  correctCount: (id: number) => number;
  optionCount?: 3 | 4;
  /** Question ids already asked this race (avoided until the pool is used up; cleared by the generator when exhausted). */
  recent?: Set<number>;
}

export interface GeneratedJbq {
  prompt: { kind: 'text'; text: string };
  options: ChallengeOption[];
  correct: AnswerSlot;
  jbq: { id: number; points: JbqPoints };
}

/** Compare answers by words only: "Jesus (Christ)" and "(Jesus) Christ" are the same answer. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** What makes two answers "the same" (reference + text for quotations). */
const answerKey = (q: JbqQuestion) => norm(q.ref !== undefined ? `${q.ref} ${q.verse ?? ''}` : q.a);
const isQuote = (q: JbqQuestion) => q.ref !== undefined && q.verse !== undefined;

const optionOf = (q: JbqQuestion): ChallengeOption =>
  isQuote(q) ? { kind: 'verse', ref: q.ref as string, text: q.verse as string } : { kind: 'text', text: q.a };

export class JbqGenerator {
  private readonly byId = new Map<number, JbqQuestion>();

  constructor(private readonly rng: Rng, private readonly questions: readonly JbqQuestion[] = JBQ_QUESTIONS) {
    for (const q of questions) this.byId.set(q.id, q);
  }

  generate(o: JbqGenerateOpts): GeneratedJbq {
    const count = o.optionCount ?? 4;
    const q = this.pickQuestion(o);
    o.recent?.add(q.id);
    const wrong = this.pickWrong(q, count - 1);
    const correct = this.rng.int(0, count - 1) as AnswerSlot;
    const rest = [...wrong];
    const options = Array.from({ length: count }, (_, i) => optionOf(i === correct ? q : rest.shift() as JbqQuestion));
    return { prompt: { kind: 'text', text: q.q }, options, correct, jbq: { id: q.id, points: q.points } };
  }

  private pickQuestion(o: JbqGenerateOpts): JbqQuestion {
    const all = jbqPool(o.points, o.scope, o.date, o.correctCount).flatMap((id) => this.byId.get(id) ?? []);
    const pool = all.length > 0 ? all : this.questions.filter((q) => q.points === o.points);
    let fresh = o.recent ? pool.filter((q) => !o.recent!.has(q.id)) : pool;
    if (fresh.length === 0) {
      pool.forEach((q) => o.recent?.delete(q.id));   // pool used up: start over
      fresh = pool;
    }
    const weights = fresh.map((q) => (o.correctCount(q.id) >= CHALLENGE.jbqMasteredCorrect ? 1 : CHALLENGE.jbqUnmasteredWeight));
    return this.rng.weighted(fresh, weights);
  }

  /**
   * Wrong answers from the whole point level: same type first, then the same type from other levels,
   * then any type of the level, then anything. Never the correct answer or each other's duplicate.
   */
  private pickWrong(q: JbqQuestion, n: number): JbqQuestion[] {
    const taken = new Set([answerKey(q)]);
    const chosen: JbqQuestion[] = [];
    const quote = isQuote(q);
    const tiers: ((c: JbqQuestion) => boolean)[] = [
      (c) => c.points === q.points && c.type === q.type,
      (c) => c.type === q.type,
      (c) => c.points === q.points && isQuote(c) === quote,
      (c) => isQuote(c) === quote,
    ];
    // Each tier first tries answers of similar length (so the right one doesn't stand out by size), then any length.
    const len = (c: JbqQuestion) => Math.max(1, answerKey(c).length);
    const similar = (c: JbqQuestion) => Math.max(len(c), len(q)) / Math.min(len(c), len(q)) <= CHALLENGE.jbqLengthRatio;
    const passes = tiers.flatMap((t) => [(c: JbqQuestion) => t(c) && similar(c), t]);
    for (const tier of passes) {
      const hits = this.rng.shuffle(this.questions.filter((c) => c.id !== q.id && tier(c)));
      for (const c of hits) {
        if (chosen.length >= n) break;
        const key = answerKey(c);
        if (taken.has(key)) continue;
        taken.add(key);
        chosen.push(c);
      }
      if (chosen.length >= n) break;
    }
    return chosen;
  }
}
