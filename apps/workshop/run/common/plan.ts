/**
 * Pure run planning (no Phaser): which stages play, how stages join, and which facets a stage shows as pass or fail.
 *
 *   planRun(challenge, result)            -> stage steps 0..result.endStage with the transition into each
 *   facetPlays(stage, stageResult, reqs)  -> one entry per facet of the stage; exactly one has `gag: true` on a failed stage
 *   orderPlays(plays, ['rocks.log', ...]) -> sort by the scenario's left-to-right order
 */
import type { Challenge, FacetId, RequirementResult, RunResult, Stage, StageResult, View } from '../../core/types';

export type Transition = 'none' | 'wipe' | 'roll';
export interface StageStep { index: number; stage: Stage; result: StageResult; transition: Transition; from?: View; to: View }

/** Stages 0..endStage; the transition into stage i depends on the view of stage i-1. */
export function planRun(challenge: Pick<Challenge, 'stages'>, result: Pick<RunResult, 'endStage' | 'stages'>): StageStep[] {
  const steps: StageStep[] = [];
  const last = Math.min(result.endStage, challenge.stages.length - 1);
  for (let i = 0; i <= last; i++) {
    const stage = challenge.stages[i];
    const prev = i > 0 ? challenge.stages[i - 1] : null;
    const res = result.stages[i] ?? { index: i, passed: true, reached: true };
    steps.push({ index: i, stage, result: res, transition: !prev ? 'none' : prev.view !== stage.view ? 'roll' : 'wipe', from: prev?.view, to: stage.view });
  }
  return steps;
}

export interface FacetPlay {
  facet: FacetId;
  level: number;
  /** The facet's requirements all passed. */
  pass: boolean;
  /** This facet's failure is the stage's gag (the stage failed and this is the first failing requirement's facet). */
  gag: boolean;
}

export function facetOfRequirement(stage: Stage, reqId: string | undefined): FacetId | undefined {
  return reqId === undefined ? undefined : stage.requirements.find((r) => r.id === reqId)?.facet;
}

export function facetPlays(stage: Stage, result: StageResult, reqs: readonly RequirementResult[] = []): FacetPlay[] {
  const passedById = new Map(reqs.map((r) => [r.id, r.passed] as const));
  const ids: FacetId[] = [];
  for (const r of stage.requirements) if (!ids.includes(r.facet)) ids.push(r.facet);
  for (const f of Object.keys(stage.params)) if (!ids.includes(f)) ids.push(f);
  let gagFacet = result.passed ? undefined : facetOfRequirement(stage, result.firstFail);
  const plays = ids.map((facet): FacetPlay => {
    const mine = stage.requirements.filter((r) => r.facet === facet);
    const pass = mine.every((r) => passedById.get(r.id) !== false);
    const level = stage.params[facet] ?? mine[0]?.level ?? 1;
    return { facet, level, pass, gag: false };
  });
  if (!result.passed && !gagFacet) gagFacet = plays.find((p) => !p.pass)?.facet ?? plays[0]?.facet;
  for (const p of plays) { p.gag = p.facet === gagFacet; if (p.gag) p.pass = false; else if (!result.passed) p.pass = true; }
  return plays;
}

/** Sort plays by `order` (facets not listed keep their relative order at the end). */
export function orderPlays(plays: readonly FacetPlay[], order: readonly FacetId[]): FacetPlay[] {
  const rank = (f: FacetId): number => { const i = order.indexOf(f); return i < 0 ? 999 : i; };
  return [...plays].sort((a, b) => rank(a.facet) - rank(b.facet));
}

/** Plays up to and including the gag (anything after a failure is never shown). */
export function playsUntilGag(plays: readonly FacetPlay[]): FacetPlay[] {
  const i = plays.findIndex((p) => p.gag);
  return i < 0 ? [...plays] : plays.slice(0, i + 1);
}
