/** The progress the screens work with. Admin Mode: the sandbox as is (its 10 challenges must not be trimmed to the 3-card board). */
import type { PaneContext } from '../../core/runtime';
import type { WorkshopId, WorkshopProgress } from '../../core/types';
import { engine } from '../../logic';

export function currentProgress(ctx: PaneContext, ws: WorkshopId): WorkshopProgress {
  const save = ctx.save();
  if (ctx.adminMode && save.workshops[ws]) return save.workshops[ws]!;
  return engine.progressOf(save, ws);
}
