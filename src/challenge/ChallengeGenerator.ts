/** Pure challenge-body generator (Phaser-free). All randomness comes from the injected Rng. */
import { CHALLENGE, DIFFICULTY } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type {
  AnswerSlot, ChallengeKind, ChallengeOption, ChallengePrompt, Difficulty, WordCategory,
} from '../core/types';
import { challengeScenesFor } from '../data/places';
import { ALL_WORDS, scenesForWord } from '../data/scenes';
import { WORD_META } from '../data/wordMeta';
import { wordsConflict } from './conflicts';
import { generateMath } from './mathGen';

export interface GenerateOpts {
  placeWord?: string;
  /** Words to avoid as the target (falls back to ignoring this if nothing else is left). */
  recentWords?: ReadonlySet<string>;
  /** Answer count: 3 (drive style, default) or 4 (pause style diamond). */
  optionCount?: 3 | 4;
}

export interface GeneratedChallenge {
  kind: ChallengeKind;
  prompt: ChallengePrompt;
  options: ChallengeOption[];
  correct: AnswerSlot;
  placeWord?: string;
  /** The word being asked about (undefined for math). */
  targetWord?: string;
}

/** One relaxation level for distractor choice. */
interface Tier { similar: boolean; category: boolean; simple: boolean }

const hasSpace = (w: string) => w.includes(' ');
const firstLetter = (w: string) => w[0];

export class ChallengeGenerator {
  constructor(private readonly rng: Rng) {}

  /** Words that can be a (non-place) target at this difficulty. */
  targetPool(difficulty: Difficulty): string[] {
    const p = DIFFICULTY[difficulty].words;
    return ALL_WORDS.filter((w) => (!p.simpleOnly || WORD_META[w].simple) && (p.allowMultiWord || !hasSpace(w)));
  }

  /** Place targets obey the same word profile as ordinary targets (simpleOnly / multi-word). */
  placeAllowed(word: string, difficulty: Difficulty): boolean {
    const p = DIFFICULTY[difficulty].words;
    return (!p.simpleOnly || WORD_META[word]?.simple === true) && (p.allowMultiWord || !hasSpace(word));
  }

  generate(kind: ChallengeKind, difficulty: Difficulty, opts: GenerateOpts = {}): GeneratedChallenge {
    const count = opts.optionCount ?? 3;
    const place = opts.placeWord && scenesForWord(opts.placeWord).length > 0 && this.placeAllowed(opts.placeWord, difficulty)
      ? opts.placeWord : undefined; // a too-hard place word falls through to a normal challenge
    if (place) {
      const k: ChallengeKind = this.rng.chance(CHALLENGE.placeWordToPicChance) ? 'wordToPic' : 'picToWord';
      return this.generateWord(k, difficulty, place, opts.recentWords, count);
    }
    if (kind === 'math') return this.generateMathChallenge(difficulty, count);
    return this.generateWord(kind, difficulty, undefined, opts.recentWords, count);
  }

  private generateMathChallenge(difficulty: Difficulty, count: number): GeneratedChallenge {
    const m = generateMath(this.rng, difficulty, count);
    const correct = this.rng.int(0, count - 1) as AnswerSlot;
    const rest = [...m.distractors];
    const options = Array.from({ length: count }, (_, i): ChallengeOption =>
      ({ kind: 'text', text: String(i === correct ? m.answer : rest.shift()) }));
    return {
      kind: 'math',
      prompt: { kind: 'text', text: m.text },
      options,
      correct,
    };
  }

  private generateWord(
    kind: 'picToWord' | 'wordToPic', difficulty: Difficulty, placeWord: string | undefined,
    recent: ReadonlySet<string> | undefined, count: number,
  ): GeneratedChallenge {
    const target = placeWord ?? this.pickTarget(difficulty, recent);
    const textOptions = kind === 'picToWord';
    const distractors = this.pickDistractors(target, difficulty, textOptions, count - 1);

    const sceneFor = (word: string, forTarget: boolean): string => {
      const ids = forTarget && placeWord ? challengeScenesFor(word) : scenesForWord(word).map((s) => s.id);
      return this.rng.pick(ids);
    };
    const toOption = (word: string, forTarget: boolean): ChallengeOption =>
      textOptions ? { kind: 'text', text: word } : { kind: 'image', sceneId: sceneFor(word, forTarget) };

    const correct = this.rng.int(0, count - 1) as AnswerSlot;
    const rest = [...distractors];
    const options = Array.from({ length: count }, (_, i) =>
      i === correct ? toOption(target, true) : toOption(rest.shift()!, false));

    const prompt: ChallengePrompt = textOptions
      ? { kind: 'image', sceneId: sceneFor(target, true) }
      : { kind: 'text', text: target };
    return {
      kind, prompt, options, correct,
      targetWord: target, ...(placeWord ? { placeWord } : {}),
    };
  }

  private pickTarget(difficulty: Difficulty, recent: ReadonlySet<string> | undefined): string {
    const pool = this.targetPool(difficulty);
    const fresh = recent ? pool.filter((w) => !recent.has(w)) : pool;
    return this.rng.pick(fresh.length > 0 ? fresh : pool);
  }

  /**
   * N distractor words, mutually non-conflicting and non-conflicting with the target.
   * Relaxation order when a pool runs dry: similarity, then category, then simpleOnly.
   * Conflicts/uniqueness are never relaxed.
   */
  private pickDistractors(target: string, difficulty: Difficulty, textOptions: boolean, n: number): string[] {
    const words = DIFFICULTY[difficulty].words;
    const targetCat = WORD_META[target].category;
    const chosen: string[] = [];
    for (let k = 0; k < n; k++) {
      const taken = [target, ...chosen];
      const base = ALL_WORDS.filter((w) => taken.every((t) => !wordsConflict(w, t)) && this.textAllowed(w, words, textOptions));
      chosen.push(this.pickFromTiers(base, target, targetCat, difficulty, textOptions));
    }
    return chosen;
  }

  /** Text options must obey simpleOnly / no-multi-word; image options are not read, so they don't. */
  private textAllowed(w: string, words: { allowMultiWord: boolean }, textOptions: boolean): boolean {
    return !textOptions || words.allowMultiWord || !hasSpace(w);
  }

  private pickFromTiers(
    base: string[], target: string, targetCat: WordCategory, difficulty: Difficulty, textOptions: boolean,
  ): string {
    const profile = DIFFICULTY[difficulty].words;
    const wantSimilar = profile.sameCategoryDistractors && difficulty === 'hard';
    const tiers: Tier[] = [
      { similar: wantSimilar, category: true, simple: textOptions && profile.simpleOnly },
      { similar: false, category: true, simple: textOptions && profile.simpleOnly },
      { similar: false, category: false, simple: textOptions && profile.simpleOnly },
      { similar: false, category: false, simple: false },
    ];
    // Easy prefers a *different* category; normal/hard prefer the *same* one.
    const sameCat = profile.sameCategoryDistractors;
    for (const t of tiers) {
      const hits = base.filter((w) => this.passes(w, target, targetCat, t, sameCat));
      if (hits.length > 0) return this.rng.pick(hits);
    }
    throw new Error(`no distractor available for ${target}`); // unreachable: tier 4 only filters conflicts
  }

  private passes(w: string, target: string, targetCat: WordCategory, t: Tier, sameCat: boolean): boolean {
    if (t.simple && !WORD_META[w].simple) return false;
    if (t.category && (WORD_META[w].category === targetCat) !== sameCat) return false;
    if (t.similar) {
      const closeLen = Math.abs(w.length - target.length) <= CHALLENGE.similarLengthDelta;
      if (!closeLen && firstLetter(w) !== firstLetter(target)) return false;
    }
    return true;
  }
}
