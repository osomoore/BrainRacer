/** Aspects in play. On Starter and Easy only WS_EASY_ASPECTS[workshop] are shown and used; the others stay pinned to their first starter. */
import { WS_EASY_ASPECTS } from '../config';
import type { AspectDef, AspectId, ReadingLevel, VariantId, WorkshopCatalog, WorkshopId, WorkshopProgress } from '../core/types';
import { index } from './catalogIndex';

type Leveled = Pick<WorkshopProgress, 'easy'>;

/** Aspect ids in catalog order, trimmed to four on Starter and Easy. */
export function aspectIdsAt(cat: Pick<WorkshopCatalog, 'id' | 'aspects'>, easy: boolean | undefined): AspectId[] {
  const all = cat.aspects.map((a) => a.id);
  if (!easy) return all;
  const keep = new Set<string>(WS_EASY_ASPECTS[cat.id] ?? []);
  const shown = all.filter((id) => keep.has(id));
  return shown.length ? shown : all;
}

/** Aspect ids used by this board. */
export function visibleAspectIds(cat: Pick<WorkshopCatalog, 'id' | 'aspects'>, p: Leveled): AspectId[] {
  return aspectIdsAt(cat, p.easy);
}

export function visibleAspects(cat: WorkshopCatalog, p: Leveled): AspectDef[] {
  const ids = new Set(visibleAspectIds(cat, p));
  return cat.aspects.filter((a) => ids.has(a.id));
}

/** True when `aspect` is trimmed away for this progress. Needs only the workshop id, so it also works from a saved challenge. */
export function isHiddenAspect(workshop: WorkshopId, p: Leveled, aspect: AspectId): boolean {
  if (!p.easy) return false;
  const keep = WS_EASY_ASPECTS[workshop];
  return !!keep?.length && !keep.includes(aspect);
}

/** True when every part belongs to a visible aspect (an empty list is fine). */
export function partsVisible(cat: WorkshopCatalog, p: Leveled, parts: readonly VariantId[]): boolean {
  const ix = index(cat);
  const visible = new Set(visibleAspectIds(cat, p));
  return parts.every((id) => {
    const aspect = ix.variantById.get(id)?.aspect;
    return aspect !== undefined && visible.has(aspect);
  });
}

/** The progress flag that goes with a reading level. */
export const easyFlag = (reading: ReadingLevel | undefined): { easy?: true } => (reading === 'starter' || reading === 'easy') ? { easy: true } : {};
