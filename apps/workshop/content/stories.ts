/**
 * Shared helpers for story text (see docs/WORKSHOP.md "Content guide"). A story line describes the problem so the
 * kind of part that helps is obvious, without being a bare instruction. A failure template names the fix: its one
 * "{parts}" is replaced by the parts (as `partPhrases` writes them). Plain ASCII.
 */
import type { AspectId, FacetStory, LeveledPhrases, Variant, VariantId } from '../core/types';

/** One line per reading level (one row). */
export const tri = (easy: string, medium: string, hard: string): LeveledPhrases => ({ easy: [easy], medium: [medium], hard: [hard] });

/** Story rows per facet level ([easy, medium, hard] each), then the failure templates. */
export const story = (levels: ReadonlyArray<readonly [string, string, string]>, fail: readonly [string, string, string]): FacetStory =>
  ({ story: levels.map(([e, m, h]) => tri(e, m, h)), fail: tri(...fail) });

export interface PartWords {
  /** Aspect -> noun after the name ("size" makes "the Small size"). */
  suffix?: Readonly<Record<AspectId, string>>;
  /** Aspects whose parts take "the" instead of "a". */
  the?: readonly AspectId[];
  /** Exact phrases that override the rules. */
  exact?: Readonly<Record<VariantId, string>>;
}

/**
 * How each part reads inside a sentence: names ending in "s" or "ing" and names with a suffix noun that is not
 * countable stay bare ("Mud Tires", "Flying", "Fire Red paint"); others get "a" or "an" ("a Winch", "an Electric Motor").
 */
export function partPhrases(variants: readonly Variant[], words: PartWords): Record<VariantId, string> {
  const out: Record<VariantId, string> = {};
  for (const v of variants) {
    const exact = words.exact?.[v.id];
    if (exact) { out[v.id] = exact; continue; }
    const suffix = words.suffix?.[v.aspect];
    const noun = suffix ? `${v.name} ${suffix}` : v.name;
    const bare = !suffix && (/s$/.test(v.name) || /ing$/.test(v.name) || /^[0-9]/.test(v.name));
    const uncountable = suffix === 'paint' || suffix === 'skin';
    const article = words.the?.includes(v.aspect) ? 'the' : /^[AEIOU]/.test(noun) ? 'an' : 'a';
    out[v.id] = bare || uncountable ? noun : `${article} ${noun}`;
  }
  return out;
}

/** Failure lines for practice cards (both workshops). */
export const PRACTICE_FAIL: LeveledPhrases = tri(
  'This test was all about {parts}.',
  'This test was checking for {parts}. Try again!',
  'The test was checking for {parts}, so put that part on and try again.',
);
