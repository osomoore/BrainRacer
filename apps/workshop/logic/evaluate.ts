import type { Challenge, ComputedModel, Model, Requirement, RequirementResult, RunResult, StageResult, WorkshopCatalog } from '../core/types';
import { checkOptions } from './namedFixes';
import { allPass, computeModel, partTag } from './stats';

function passRoute(req: Requirement, model: ComputedModel): RequirementResult['route'] {
  if (req.namedFixes?.some((parts) => parts.every((id) => model.tags.has(partTag(id))))) return 'named';
  if (!allPass(req.checks, model)) return null;
  const stat = checkOptions(req.checks).filter((option) => allPass(option, model))
    .every((option) => option.some((check) => check.kind === 'statMin' || check.kind === 'statMax'));
  return stat ? 'stat' : 'check';
}

/** Every requirement is evaluated; the run ends at the first stage with a failing requirement. */
export function evaluate(cat: WorkshopCatalog, model: Model, challenge: Challenge): RunResult {
  const cm = computeModel(cat, model);
  const raw = challenge.stages.map((st) => st.requirements.map((req) => {
    const route = passRoute(req, cm);
    return { id: req.id, passed: route !== null, route };
  }));
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
    for (const r of rs) requirements.push({ ...r, reached });
  });
  return { passed, cleverWin: passed && requirements.some((req) => req.route === 'stat'), endStage, stages, requirements };
}
