import { WS_RULES } from '../config';
import { Rng } from '../core/rng';
import type { Challenge, ChallengeId, Model, Requirement, Variant, VariantId, WorkshopCatalog } from '../core/types';
import { challengeKey } from './generator';
import { partTag } from './stats';
import { practiceStory } from './failHints';

/** Practice cards borrow scenario titles, joining two different titles for a two-part build. */
export function practiceTitle(cat: WorkshopCatalog, seed: number, partCount: number): string {
  const pool = [...new Set(cat.scenarioPhrases.flatMap((sp) => sp.title).filter(Boolean))];
  if (pool.length === 0) pool.push(...cat.scenarios.map((sc) => sc.label));
  if (pool.length === 0) return 'Practice';
  const rng = new Rng(seed ^ 0x2f6e2b1);
  const first = rng.pick(pool);
  if (partCount <= 1 || pool.length < 2) return first;
  return first + ' & ' + rng.pick(pool.filter((t) => t !== first));
}

/** Owned-part practice keeps the board playable when the authored catalog is out of ready cards. */
export function practiceChallenge(
  cat: WorkshopCatalog, id: ChallengeId, seed: number, tier: number, owned: ReadonlySet<VariantId>,
  current: Model, lastWin: Model | null, usedKeys: ReadonlySet<string>,
  allowCurrent = false,
): Challenge | null {
  const rng = new Rng(seed);
  const parts = rng.shuffle(cat.variants.filter((part) => owned.has(part.id)
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
      id, workshop: cat.id, title: practiceTitle(cat, seed, variants.length),
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
