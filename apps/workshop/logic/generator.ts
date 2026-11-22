/** Seeded challenge generator. Candidates are validated with the solver (see docs/WORKSHOP.md). */
import { WS_RULES } from '../config';
import { Rng } from '../core/rng';
import type { Challenge, ChallengeId, FacetDef, Model, ScenarioId, StarterSpec, VariantId, WorkshopCatalog } from '../core/types';
import { solve } from './solver';
import { allPass, computeModel } from './stats';
import { resolveSpec, specChecks } from './text';
import { clamp } from './util';

export interface GenParams {
  tier: number;
  avail: ReadonlySet<VariantId>;
  current: Model;
  lastWin: Model | null;
  /** Wanted minimum changed aspects vs lastWin (relaxed to 1 inside the attempt budget). */
  minChanged: number;
  /** Most recently unlocked, still available variant (null: no preference). */
  newest: VariantId | null;
  /** Default: drawn from the seed with WS_RULES.newestChance. */
  wantNewest?: boolean;
  /** Signatures of challenges that already exist (never duplicated). */
  usedKeys: ReadonlySet<string>;
  /** First scenarios of challenges already on the board (avoided when possible). */
  avoidScenarios: ReadonlySet<ScenarioId>;
  attempts: number;
  /** false (admin): a candidate solved by the current model is only ranked lower, not rejected. */
  strictCurrent: boolean;
}

export interface GenResult { challenge: Challenge; minCost: number }

export function specKey(spec: Pick<StarterSpec, 'stages'>): string {
  return spec.stages.map((s) => `${s.scenario}:${s.facets.map((f) => `${f.facet}@${f.level}`).join('+')}`).join('|');
}

export function challengeKey(c: Pick<Challenge, 'stages'>): string {
  return c.stages.map((s) => `${s.scenario}:${s.requirements.map((r) => `${r.facet}@${r.level}`).join('+')}`).join('|');
}

function pickLevel(rng: Rng, f: FacetDef, tier: number): number {
  const n = f.levels.length;
  if (n <= 1) return f.levels[0];
  const base = (clamp(tier, 0, WS_RULES.maxTier) / WS_RULES.maxTier) * (n - 1);
  return f.levels[clamp(Math.floor(base + rng.next() * 0.999), 0, n - 1)];
}

export function tierRow(tier: number): { stages: readonly [number, number]; reqs: readonly [number, number] } {
  return WS_RULES.tierTable[Math.min(tier, WS_RULES.tierTable.length - 1)];
}

function buildSpec(rng: Rng, cat: WorkshopCatalog, tier: number): StarterSpec | null {
  const row = tierRow(tier);
  const nStages = rng.int(row.stages[0], row.stages[1]);
  const okFacet = (f: FacetDef): boolean => f.minTier <= tier && f.levels.length > 0;
  const eligible = cat.scenarios.filter((s) => s.minTier <= tier && s.facets.some(okFacet));
  if (!eligible.length) return null;
  const usedFacets = new Set<string>();
  const usedScen = new Set<string>();
  const stages: StarterSpec['stages'][number][] = [];
  for (let k = 0; k < nStages; k++) {
    let pool = eligible.filter((s) => !usedScen.has(s.id));
    if (!pool.length) pool = eligible;
    const sc = rng.pick(pool);
    usedScen.add(sc.id);
    const nReq = rng.int(row.reqs[0], row.reqs[1]);
    const facets = rng.shuffle(sc.facets.filter((f) => okFacet(f) && !usedFacets.has(f.id))).slice(0, nReq);
    if (!facets.length) return null;
    for (const f of facets) usedFacets.add(f.id);
    stages.push({ scenario: sc.id, facets: facets.map((f) => ({ facet: f.id, level: pickLevel(rng, f, tier) })) });
  }
  return { id: '', stages };
}

/** Generates one challenge, or null when no valid candidate is found within the attempt budget. */
export function generateChallenge(cat: WorkshopCatalog, id: ChallengeId, source: Challenge['source'], seed: number, p: GenParams): GenResult | null {
  const rng = new Rng(seed);
  const wantNewest = p.wantNewest ?? rng.chance(WS_RULES.newestChance);
  const availNoNewest = p.newest ? new Set([...p.avail].filter((v) => v !== p.newest)) : null;
  const curModel = computeModel(cat, p.current);
  const lastModel = p.lastWin ? computeModel(cat, p.lastWin) : null;

  let best: { spec: StarterSpec; rank: number; cost: number } | null = null;
  for (let attempt = 0; attempt < p.attempts; attempt++) {
    const spec = buildSpec(rng, cat, p.tier);
    if (!spec) continue;
    if (p.usedKeys.has(specKey(spec))) continue;
    const checks = specChecks(cat, spec);
    if (!checks.length) continue;
    if (lastModel && allPass(checks, lastModel)) continue;
    const solvesNow = allPass(checks, curModel);
    if (solvesNow && p.strictCurrent) continue;
    const sol = solve(cat, checks, p.avail, { ref: p.lastWin });
    if (!sol) continue;
    const cost = p.lastWin ? Math.max(1, sol.cost) : Infinity;
    const needsNewest = availNoNewest ? solve(cat, checks, availNoNewest, { stopAtFirst: true }) === null : false;
    const prefOk = !p.newest || (wantNewest ? needsNewest : !needsNewest);
    const unique = !p.avoidScenarios.has(spec.stages[0].scenario);
    const rank = (solvesNow ? 0 : 8) + (cost >= p.minChanged ? 4 : 0) + (prefOk ? 2 : 0) + (unique ? 1 : 0);
    if (!best || rank > best.rank) best = { spec, rank, cost };
    if (rank === 15) break;
    if (attempt >= p.attempts / 2 && rank >= 14) break;
    if (attempt >= (p.attempts * 3) / 4 && rank >= 12) break;
  }
  if (!best) return null;
  const challenge = resolveSpec(cat, best.spec, { id, source, tier: p.tier, seed });
  return { challenge, minCost: best.cost };
}
