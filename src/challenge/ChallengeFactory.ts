/** Builds one player's challenges on demand (pure; used by the pause-style break scheduler). */
import { DIFFICULTY } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type { Challenge, ChallengeKind, ChallengeMode, Difficulty, PlayerId, QuestionTypes } from '../core/types';
import type { ChallengeGenerator } from './ChallengeGenerator';
import { kindsForMode } from './ChallengeScheduler';

export interface FactoryOptions {
  player: PlayerId;
  difficulty: Difficulty;
  generator: ChallengeGenerator;
  rng: Rng;
  mode?: ChallengeMode;
  questionTypes?: QuestionTypes;
  optionCount?: 3 | 4;
}

export class ChallengeFactory {
  private readonly kinds: ChallengeKind[];
  private counter = 0;
  private readonly used = new Set<string>();

  constructor(private readonly o: FactoryOptions) {
    this.kinds = kindsForMode(o.mode, o.questionTypes, o.difficulty);
  }

  make(placeWord: string | null = null): Challenge {
    const { difficulty, generator, rng, player } = this.o;
    const word = placeWord && this.kinds.includes('picToWord') ? placeWord : null;
    const kind = rng.weighted(this.kinds, this.kinds.map((k) => DIFFICULTY[difficulty].typeWeights[k]));
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
}
