/** Per-player challenge timeline (pure; time is injected in seconds). */
import { CHALLENGE, DIFFICULTY } from '../config/gameConfig';
import { normalizeQuestionTypes } from '../config/questionsPolicy';
import type { Rng } from '../core/rng';
import type { AnswerSlot, Challenge, ChallengeKind, ChallengeMode, ChallengeResult, Difficulty, PlayerId, QuestionType, QuestionTypes } from '../core/types';
import type { ChallengeGenerator } from './ChallengeGenerator';

export type SchedulerEvent =
  | { type: 'shown'; challenge: Challenge }
  | { type: 'resolved'; challenge: Challenge; result: ChallengeResult; chosen: AnswerSlot | null };

export type SchedulerState = 'idle' | 'active' | 'resolved';

export interface SchedulerOptions {
  player: PlayerId;
  difficulty: Difficulty;
  intervalSec: number;
  generator: ChallengeGenerator;
  rng: Rng;
  startDelaySec: number;
  questionTypes?: QuestionTypes;
  /** Legacy fallback when questionTypes is absent (missing = 'words'). */
  mode?: ChallengeMode;
}

/**
 * Kinds allowed by the player's selections or by their legacy mode. Math is addition up to Normal and
 * multiplication on Hard; reading is picture->word and word->picture; jbq is the Junior Bible Quiz.
 */
export function kindsForMode(mode?: ChallengeMode, questionTypes?: QuestionTypes, difficulty: Difficulty = 'normal'): ChallengeKind[] {
  const types = normalizeQuestionTypes(questionTypes, mode);
  const kinds: ChallengeKind[] = [];
  if (types.reading) kinds.push('picToWord');
  if (types.math) kinds.push(difficulty === 'hard' ? 'multiplication' : 'math');
  if (types.reading) kinds.push('wordToPic');
  if (types.jbq) kinds.push('jbq');
  return kinds;
}

const typeOfKind = (k: ChallengeKind): QuestionType => k === 'jbq' ? 'jbq' : k === 'math' || k === 'multiplication' ? 'math' : 'reading';

/** Pick weights for `kinds`: each enabled question TYPE (math, reading, jbq) gets an equal share, split by the difficulty's kind weights within a type. */
export function kindWeights(kinds: readonly ChallengeKind[], difficulty: Difficulty): number[] {
  const w = DIFFICULTY[difficulty].typeWeights;
  const typeSum = new Map<QuestionType, number>();
  for (const k of kinds) typeSum.set(typeOfKind(k), (typeSum.get(typeOfKind(k)) ?? 0) + w[k]);
  return kinds.map((k) => w[k] / (typeSum.get(typeOfKind(k)) || 1) / typeSum.size);
}

export class ChallengeScheduler {
  private readonly player: PlayerId;
  private readonly difficulty: Difficulty;
  private readonly generator: ChallengeGenerator;
  private readonly rng: Rng;
  private readonly kinds: ChallengeKind[];
  readonly periodSec: number;

  private _state: SchedulerState = 'idle';
  private _current: Challenge | null = null;
  private startAt: number;          // when the first challenge appears
  private endsAt = 0;               // end of the current period
  private counter = 0;
  private queuedPlace: string | null = null;
  private readonly lastPlaceAt = new Map<string, number>();
  private readonly used = new Set<string>();

  constructor(o: SchedulerOptions) {
    this.player = o.player;
    this.difficulty = o.difficulty;
    this.generator = o.generator;
    this.rng = o.rng;
    // DEPRECATED drive style: JBQ is Stop & Answer only, so the drive scheduler never asks it.
    const kinds = kindsForMode(o.mode, o.questionTypes, o.difficulty).filter((k) => k !== 'jbq');
    this.kinds = kinds.length > 0 ? kinds : ['picToWord', 'wordToPic'];
    this.periodSec = o.intervalSec * DIFFICULTY[o.difficulty].periodMultiplier;
    this.startAt = o.startDelaySec;
  }

  get state(): SchedulerState { return this._state; }
  get current(): Challenge | null { return this._current; }
  /** Seconds left in the current period (0 when idle). */
  remainingSec(now: number): number { return this._state === 'idle' ? 0 : Math.max(0, this.endsAt - now); }

  update(now: number): SchedulerEvent[] {
    const events: SchedulerEvent[] = [];
    this.advance(now, events);
    return events;
  }

  answer(slot: AnswerSlot, now: number, timeExpired = false): SchedulerEvent[] {
    const events: SchedulerEvent[] = [];
    if (!timeExpired) this.advance(now, events);
    const c = this._current;
    if (this._state !== 'active' || !c) return events;
    this._state = 'resolved';
    events.push({ type: 'resolved', challenge: c, result: slot === c.correct ? 'correct' : 'wrong', chosen: slot });
    return events;
  }

  notifyPlace(word: string, now: number): SchedulerEvent[] {
    const events: SchedulerEvent[] = [];
    this.advance(now, events);
    const last = this.lastPlaceAt.get(word);
    if (last !== undefined && now - last < CHALLENGE.placeCooldownSec) return events;
    if (!this.kinds.includes('picToWord')) return events;   // place challenges are word challenges
    if (this._state === 'active') {
      if (this.queuedPlace !== null) return events;   // one queued place at a time
      this.queuedPlace = word;
    } else {
      this.start(now, word, events);
    }
    this.lastPlaceAt.set(word, now);
    return events;
  }

  private advance(now: number, events: SchedulerEvent[]): void {
    if (this._state === 'idle') {
      if (now >= this.startAt) this.start(this.startAt, null, events);   // period counts from the planned start
      else return;
    }
    while (now >= this.endsAt) {
      if (this._state === 'active' && this._current) {
        events.push({ type: 'resolved', challenge: this._current, result: 'timeout', chosen: null });
      }
      const place = this.queuedPlace;
      this.queuedPlace = null;
      this.start(this.endsAt, place, events);
    }
  }

  private start(at: number, placeWord: string | null, events: SchedulerEvent[]): void {
    const kind = this.rng.weighted(this.kinds, kindWeights(this.kinds, this.difficulty));
    const pool = this.generator.targetPool(this.difficulty);
    if (pool.every((w) => this.used.has(w))) this.used.clear();
    const body = this.generator.generate(kind, this.difficulty, {
      ...(placeWord ? { placeWord } : {}),
      recentWords: this.used,
    });
    if (body.targetWord) this.used.add(body.targetWord);
    const challenge: Challenge = {
      id: this.counter++ * 2 + this.player,
      player: this.player,
      kind: body.kind,
      prompt: body.prompt,
      options: body.options,
      correct: body.correct,
      durationSec: this.periodSec,
      source: body.placeWord ? 'place' : 'random',
      ...(body.placeWord ? { placeWord: body.placeWord } : {}),
    };
    this._current = challenge;
    this._state = 'active';
    this.endsAt = at + this.periodSec;
    events.push({ type: 'shown', challenge });
  }
}
