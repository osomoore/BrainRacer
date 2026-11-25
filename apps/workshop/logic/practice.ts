import { WS_RULES } from '../config';
import { Rng } from '../core/rng';
import type { Challenge, ChallengeId, Model, Requirement, Variant, VariantId, WorkshopCatalog, WorkshopId } from '../core/types';
import { PRACTICE_TITLES } from '../content/practiceTitles';
import { challengeKey } from './generator';
import { partTag } from './stats';
import { practiceStory } from './failHints';

/** Name the parts in the same order as their requirements on the card. */
export function practiceTitle(workshop: WorkshopId, parts: readonly Pick<Variant, 'aspect'>[]): string {
  return parts.map(({ aspect }) => PRACTICE_TITLES[workshop][aspect] ?? 'Practice').join(' & ');
}

/** Owned-part practice keeps the board playable when the authored catalog is out of ready cards. */
export function practiceChallenge(
  cat: WorkshopCatalog, id: ChallengeId, seed: number, tier: number, owned: ReadonlySet<VariantId>,
  current: Model, lastWin: Model | null, usedKeys: ReadonlySet<string>,
  allowCurrent = false, visible?: ReadonlySet<string>,
): Challenge | null {
  const rng = new Rng(seed);
  const parts = rng.shuffle(cat.variants.filter((part) => owned.has(part.id) && (!visible || visible.has(part.aspect))
    && (allowCurrent || cat.variants.some((other) => other.aspect === part.aspect && other.id !== part.id && owned.has(other.id)))));
  const intro = '';
  const make = (variants: Variant[]): Challenge => {
    const requirements = variants.map((part, i): Requirement => {
      const aspect = cat.aspects.find((a) => a.id === part.aspect);
      const hint = 'Visit the ' + (aspect?.label ?? part.aspect) + ' station.';
      return {
        id: 's0r' + i, facet: 'practice.' + part.aspect, level: 1,
        checks: [{ kind: 'tag', tag: partTag(part.id) }],
        text: {
          easy: practiceStory(cat, part.id, 'easy'),
          medium: practiceStory(cat, part.id, 'medium'),
          hard: practiceStory(cat, part.id, 'hard'),
        },
        hint: { aspect: part.aspect, text: { easy: hint, medium: hint, hard: hint } },
      };
    });
    return {
      id, workshop: cat.id, title: practiceTitle(cat.id, variants),
      intro: { easy: intro, medium: intro, hard: intro },
      stages: [{ scenario: 'practice', view: 'side', params: {}, requirements }],
      tier, source: 'generated', seed, genVersion: WS_RULES.genVersion,
    };
  };

  const pairs = parts.flatMap((part, i) => parts.slice(i + 1)
    .filter((other) => other.aspect !== part.aspect).map((other) => [part, other]));
  const candidates = [...parts.map((part) => [part]), ...pairs];
  let relaxed: Challenge | null = null;
  for (const variants of candidates) {
    const changes = (model: Model): number => variants.filter((part) => model[part.aspect] !== part.id).length;
    if (!allowCurrent && (!changes(current) || (lastWin && !changes(lastWin)))) continue;
    const challenge = make(variants);
    if (usedKeys.has(challengeKey(challenge))) continue;
    if (!lastWin || changes(lastWin) >= WS_RULES.minChangedAspects) return challenge;
    relaxed ??= challenge;
  }
  return relaxed;
}
