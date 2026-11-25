import type { RequirementResult, Stage, Variant, WorkshopCatalog } from '../../core/types';
import { partTag } from '../../logic/stats';

export interface PracticeBeat {
  part: Variant;
  passed: boolean;
}

/** Every practice requirement in this stage is reached, including ones after a mismatch. */
export function practiceBeats(
  catalog: WorkshopCatalog, stage: Stage, results: readonly RequirementResult[],
): PracticeBeat[] {
  return stage.requirements.flatMap((req) => {
    const check = req.checks.find((check) => check.kind === 'tag');
    const part = check && catalog.variants.find((v) => req.facet === 'practice.' + v.aspect && check.tag === partTag(v.id));
    const result = results.find((r) => r.id === req.id && r.reached);
    return part && result ? [{ part, passed: result.passed }] : [];
  });
}
