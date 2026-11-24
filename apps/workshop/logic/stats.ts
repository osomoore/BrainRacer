import type { Check, ComputedModel, Model, VariantId, WorkshopCatalog } from '../core/types';
import { index } from './catalogIndex';
import { clamp } from './util';

export const partTag = (variant: VariantId): string => 'variant:' + variant;

/** stat = clamp(base + sum of variant stats); tags = union. Unknown variant ids are ignored. */
export function computeModel(cat: WorkshopCatalog, model: Model): ComputedModel {
  const ix = index(cat);
  const stats: Record<string, number> = {};
  for (const s of cat.stats) stats[s.id] = s.base;
  const tags = new Set<string>();
  for (const aspect of ix.aspectIds) {
    const v = ix.variantById.get(model[aspect]);
    if (!v) continue;
    for (const [k, val] of Object.entries(v.stats)) if (k in stats && val !== undefined) stats[k] += val;
    for (const t of v.tags) tags.add(t);
    tags.add(partTag(v.id));
  }
  for (const s of cat.stats) stats[s.id] = clamp(stats[s.id], s.min, s.max);
  return { stats, tags };
}

/** Unknown stats read as 0. */
export function checkPasses(check: Check, cm: ComputedModel): boolean {
  switch (check.kind) {
    case 'statMin': return (cm.stats[check.stat] ?? 0) >= check.min;
    case 'statMax': return (cm.stats[check.stat] ?? 0) <= check.max;
    case 'tag': return cm.tags.has(check.tag);
    case 'noTag': return !cm.tags.has(check.tag);
    case 'anyOf': return check.options.some((option) => allPass(option, cm));
  }
}

export function allPass(checks: readonly Check[], cm: ComputedModel): boolean {
  return checks.every((c) => checkPasses(c, cm));
}

export function defaultModel(cat: WorkshopCatalog): Model {
  return Object.fromEntries(cat.aspects.map((a) => [a.id, a.starters[0]]));
}
