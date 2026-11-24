import type { AspectId, Model, VariantId, WorkshopCatalog, WorkshopProgress } from '../core/types';
import { index } from './catalogIndex';

/** starters + earned + 'open' - 'locked'; an aspect never ends up empty (its first starter stays). */
export function available(cat: WorkshopCatalog, p: Pick<WorkshopProgress, 'earned' | 'overrides'>): Set<VariantId> {
  const ix = index(cat);
  const set = new Set<VariantId>(ix.starterIds);
  for (const v of p.earned) if (ix.variantById.has(v)) set.add(v);
  for (const [v, o] of Object.entries(p.overrides)) {
    if (!ix.variantById.has(v)) continue;
    if (o === 'open') set.add(v);
  }
  for (const [v, o] of Object.entries(p.overrides)) if (o === 'locked') set.delete(v);
  for (const a of cat.aspects) {
    if (!(ix.byAspect.get(a.id) ?? []).some((v) => set.has(v.id))) set.add(a.starters[0]);
  }
  return set;
}

export function availableFor(cat: WorkshopCatalog, p: Pick<WorkshopProgress, 'earned' | 'overrides'>, aspect: AspectId): VariantId[] {
  const set = available(cat, p);
  return (index(cat).byAspect.get(aspect) ?? []).filter((v) => set.has(v.id)).map((v) => v.id);
}

export function sanitizeModel(cat: WorkshopCatalog, p: Pick<WorkshopProgress, 'earned' | 'overrides'>, model: Model): Model {
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
