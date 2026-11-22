import type { Challenge, Model, RequirementResult, RunResult, StageResult, WorkshopCatalog } from '../core/types';
import { allPass, computeModel } from './stats';

/** Every requirement is evaluated; the run ends at the first stage with a failing requirement. */
export function evaluate(cat: WorkshopCatalog, model: Model, challenge: Challenge): RunResult {
  const cm = computeModel(cat, model);
  const raw = challenge.stages.map((st) => st.requirements.map((r) => ({ id: r.id, passed: allPass(r.checks, cm) })));
  const failIdx = raw.findIndex((rs) => rs.some((r) => !r.passed));
  const passed = failIdx < 0;
  const endStage = passed ? Math.max(0, raw.length - 1) : failIdx;
  const stages: StageResult[] = [];
  const requirements: RequirementResult[] = [];
  raw.forEach((rs, i) => {
    const reached = i <= endStage;
    const first = rs.find((r) => !r.passed);
    const sr: StageResult = { index: i, passed: !first, reached };
    if (first) sr.firstFail = first.id;
    stages.push(sr);
    for (const r of rs) requirements.push({ id: r.id, passed: r.passed, reached });
  });
  return { passed, endStage, stages, requirements };
}
