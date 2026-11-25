import type { AspectId, Model, VariantId, WorkshopCatalog, WorkshopProgress } from '../core/types';
import { visibleAspectIds } from './aspects';
import { index } from './catalogIndex';

/** first starters + bought + 'open' - 'locked'; an aspect never ends up empty (its first starter stays). */
export function available(cat: WorkshopCatalog, p: Pick<WorkshopProgress, 'bought' | 'overrides' | 'easy'>): Set<VariantId> {
  const ix = index(cat);
  // Only the first starter of each aspect is part of a fresh build. The second
  // starter is a normal shop purchase, like every later variant.
  const set = new Set<VariantId>(cat.aspects.map((a) => a.starters[0]));
  for (const v of p.bought) if (ix.variantById.has(v)) set.add(v);
  for (const [v, o] of Object.entries(p.overrides)) {
    if (!ix.variantById.has(v)) continue;
    if (o === 'open') set.add(v);
  }
  for (const [v, o] of Object.entries(p.overrides)) if (o === 'locked') set.delete(v);
  // Aspects trimmed away on Easy stay pinned to their first starter (parts bought there are kept but not usable).
  const shown = new Set(visibleAspectIds(cat, p));
  for (const a of cat.aspects) {
    if (shown.has(a.id)) continue;
    for (const v of ix.byAspect.get(a.id) ?? []) if (v.id !== a.starters[0]) set.delete(v.id);
  }
  for (const a of cat.aspects) if (!(ix.byAspect.get(a.id) ?? []).some((v) => set.has(v.id))) set.add(a.starters[0]);
  return set;
}

export function availableFor(cat: WorkshopCatalog, p: Pick<WorkshopProgress, 'bought' | 'overrides' | 'easy'>, aspect: AspectId): VariantId[] {
  const set = available(cat, p);
  return (index(cat).byAspect.get(aspect) ?? []).filter((v) => set.has(v.id)).map((v) => v.id);
}

export function sanitizeModel(cat: WorkshopCatalog, p: Pick<WorkshopProgress, 'bought' | 'overrides' | 'easy'>, model: Model): Model {
  const ix = index(cat);
  const set = available(cat, p);
  const out: Model = {};
  for (const a of cat.aspects) {
    const cur = model[a.id];
    const v = ix.variantById.get(cur);
    if (v && v.aspect === a.id && set.has(cur)) { out[a.id] = cur; continue; }
    out[a.id] = (ix.byAspect.get(a.id) ?? []).find((x) => set.has(x.id))?.id ?? a.starters[0];
  }
  return out;
}
