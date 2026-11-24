import { WS_RULES } from '../config';
import { Rng } from '../core/rng';
import type { Challenge, ChallengeId, Model, Requirement, Variant, VariantId, WorkshopCatalog } from '../core/types';
import { challengeKey } from './generator';
import { partTag } from './stats';

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
  const titlePool = [...new Set(cat.scenarioPhrases.flatMap((sp) => sp.title).filter(Boolean))];
  if (titlePool.length === 0) titlePool.push(...cat.scenarios.map((sc) => sc.label));
  /** Real flavor titles from the content's scenario phrase titles; two parts join two different ones like a two-stage card. */
  const flavorTitle = (n: number): string => {
    const r = new Rng(seed ^ 0x2f6e2b1);
    const first = titlePool[Math.floor(r.next() * titlePool.length)];
    if (n === 1 || titlePool.length < 2) return first;
    const rest = titlePool.filter((t) => t !== first);
    return first + ' & ' + rest[Math.floor(r.next() * rest.length)];
  };
  const make = (variants: Variant[]): Challenge => {
    const requirements = variants.map((part, i): Requirement => {
      const aspect = cat.aspects.find((a) => a.id === part.aspect);
      const hint = 'Visit the ' + (aspect?.label ?? part.aspect) + ' station.';
      return {
        id: 's0r' + i, facet: 'practice.' + part.aspect, level: 1,
        checks: [{ kind: 'tag', tag: partTag(part.id) }],
        text: {
          easy: 'Use ' + part.name + '.',
          medium: 'Fit the ' + part.name + '.',
          hard: 'Install the ' + part.name + '.',
        },
        hint: { aspect: part.aspect, text: { easy: hint, medium: hint, hard: hint } },
      };
    });
    return {
      id, workshop: cat.id, title: flavorTitle(variants.length),
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
