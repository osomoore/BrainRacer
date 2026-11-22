/** Builds one player's challenges on demand (pure; used by the pause-style break scheduler). */
import { CHALLENGE, NEW_RACER } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type { Challenge, ChallengeKind, ChallengeMode, Difficulty, JbqSettings, PlayerId, QuestionTypes } from '../core/types';
import type { ChallengeGenerator } from './ChallengeGenerator';
import { kindsForMode, kindWeights } from './ChallengeScheduler';
import { JbqGenerator } from './jbqGenerator';
import { JBQ_SCHEDULE } from '../data/jbqSchedule';

export interface FactoryOptions {
  player: PlayerId;
  difficulty: Difficulty;
  generator: ChallengeGenerator;
  rng: Rng;
  mode?: ChallengeMode;
  questionTypes?: QuestionTypes;
  optionCount?: 3 | 4;
  /** JBQ settings (defaults to the new-racer defaults). */
  jbq?: JbqSettings;
  /** Local date "YYYY-MM-DD" for the JBQ study schedule (defaults to the first schedule row). */
  today?: string;
  /** This racer's correct-answer count for a JBQ question id (defaults to 0 = nothing learned yet). */
  jbqCount?: (id: number) => number;
}

export class ChallengeFactory {
  private readonly kinds: ChallengeKind[];
  private counter = 0;
  private readonly used = new Set<string>();
  private readonly jbqRecent = new Set<number>();
  private jbqGen: JbqGenerator | null = null;   // created on first use so non-JBQ racers keep their seeded sequences

  constructor(private readonly o: FactoryOptions) {
    this.kinds = kindsForMode(o.mode, o.questionTypes, o.difficulty);
  }

  make(placeWord: string | null = null): Challenge {
    const { difficulty, generator, rng, player } = this.o;
    const word = placeWord && this.kinds.includes('picToWord') ? placeWord : null;
    const kind = rng.weighted(this.kinds, kindWeights(this.kinds, difficulty));
    if (kind === 'jbq' && !word) return this.makeJbq();
    const pool = generator.targetPool(difficulty);
    if (pool.every((w) => this.used.has(w))) this.used.clear();
    const body = generator.generate(kind, difficulty, { ...(word ? { placeWord: word } : {}), recentWords: this.used, optionCount: this.o.optionCount ?? 4 });
    if (body.targetWord) this.used.add(body.targetWord);
    return {
      id: this.counter++ * 2 + player,
      player,
      kind: body.kind,
      prompt: body.prompt,
      options: body.options,
      correct: body.correct,
      durationSec: 0,
      source: body.placeWord ? 'place' : 'random',
      ...(body.placeWord ? { placeWord: body.placeWord } : {}),
    };
  }

  /** A Junior Bible Quiz question (ignores Difficulty). */
  private makeJbq(): Challenge {
    const { player } = this.o;
    const jbq = this.o.jbq ?? NEW_RACER.defaultJbq;
    this.jbqGen ??= new JbqGenerator(this.o.rng.fork(0x4a));
    const body = this.jbqGen.generate({
      points: jbq.points, scope: jbq.scope, date: this.o.today ?? JBQ_SCHEDULE[0].date,
      correctCount: this.o.jbqCount ?? (() => 0), optionCount: this.o.optionCount ?? CHALLENGE.pauseOptions as 3 | 4, recent: this.jbqRecent,
    });
    return {
      id: this.counter++ * 2 + player, player, kind: 'jbq', prompt: body.prompt, options: body.options,
      correct: body.correct, durationSec: 0, source: 'random', jbq: body.jbq,
    };
  }
}
