/** Seeded challenge generator. Candidates are validated with the solver (see docs/WORKSHOP.md). */
import { WS_RULES } from '../config';
import { Rng } from '../core/rng';
import type { Challenge, ChallengeId, Check, FacetDef, Model, ScenarioId, StarterSpec, VariantId, WorkshopCatalog } from '../core/types';
import { solve } from './solver';
import { allPass, computeModel } from './stats';
import { resolveSpec, specChecks } from './text';
import { clamp, flatChecks } from './util';

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
  /** Board shop rules: reject candidates outside the requested cost band. */
  accepts?: (checks: readonly Check[]) => boolean;
  fallback?: boolean;
  /** Optional facet-level filter (Easy: only requirements whose listed fixes use shown stations). */
  facetOk?: (facet: FacetDef, level: number) => boolean;
}

export interface GenResult { challenge: Challenge; minCost: number }

const challengeKeys = new WeakMap<Pick<Challenge, 'stages'>, string>();

function checksKey(checks: readonly Check[]): string {
  return JSON.stringify([...new Set(checks.map((check) => {
    switch (check.kind) {
      case 'statMin': return JSON.stringify([check.kind, check.stat, check.min]);
      case 'statMax': return JSON.stringify([check.kind, check.stat, check.max]);
      case 'anyOf': return JSON.stringify([check.kind, [...new Set(check.options.map(checksKey))].sort()]);
      default: return JSON.stringify([check.kind, check.tag]);
    }
  }))].sort());
}

export function challengeKey(c: Pick<Challenge, 'stages'>): string {
  // Resolved cards are immutable once offered. Refill scans their keys on every win.
  let key = challengeKeys.get(c);
  if (key === undefined) {
    key = checksKey(flatChecks(c));
    challengeKeys.set(c, key);
  }
  return key;
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

function buildSpec(rng: Rng, cat: WorkshopCatalog, tier: number, levelOk: (f: FacetDef, level: number) => boolean = () => true): StarterSpec | null {
  const row = tierRow(tier);
  const nStages = rng.int(row.stages[0], row.stages[1]);
  const okFacet = (f: FacetDef): boolean => f.minTier <= tier && f.levels.some((level) => levelOk(f, level));
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
    stages.push({ scenario: sc.id, facets: facets.map((f) => ({ facet: f.id, level: okLevel(f, pickLevel(rng, f, tier), levelOk) })) });
  }
  return { id: '', stages };
}

/** The picked level if allowed, else the nearest allowed one. */
function okLevel(f: FacetDef, level: number, levelOk: (f: FacetDef, level: number) => boolean): number {
  if (levelOk(f, level)) return level;
  return f.levels.filter((l) => levelOk(f, l)).reduce((best, l) => (Math.abs(l - level) < Math.abs(best - level) ? l : best));
}

/** A deterministic search when tier sampling cannot fill a slot. Try simple cards before pairs. */
function* fallbackSpecs(cat: WorkshopCatalog, rng: Rng, levelOk: (f: FacetDef, level: number) => boolean = () => true): Iterable<StarterSpec> {
  const stages = rng.shuffle(cat.scenarios.flatMap((scenario) => scenario.facets.flatMap((facet) =>
    facet.levels.filter((level) => levelOk(facet, level)).map((level) => ({ scenario: scenario.id, facets: [{ facet: facet.id, level }] })))));
  for (const stage of stages) yield { id: '', stages: [stage] };
  for (let i = 0; i < stages.length; i++) {
    for (const other of stages.slice(i + 1)) {
      if (stages[i].scenario !== other.scenario) yield { id: '', stages: [stages[i], other] };
    }
  }
}

export function generateChallenge(cat: WorkshopCatalog, id: ChallengeId, source: Challenge['source'], seed: number, p: GenParams): GenResult | null {
  const rng = new Rng(seed);
  const wantNewest = p.wantNewest ?? rng.chance(WS_RULES.newestChance);
  const availNoNewest = p.newest ? new Set([...p.avail].filter((v) => v !== p.newest)) : null;
  const curModel = computeModel(cat, p.current);
  const lastModel = p.lastWin ? computeModel(cat, p.lastWin) : null;
  const tried = new Set(p.usedKeys);
  const randomSpecs = Array.from({ length: p.fallback ? 0 : p.attempts }, () => buildSpec(rng, cat, p.tier, p.facetOk));
  const specs = p.fallback ? fallbackSpecs(cat, rng, p.facetOk) : randomSpecs;

  let best: { spec: StarterSpec; rank: number; cost: number } | null = null;
  for (const spec of specs) {
    if (!spec) continue;
    const checks = specChecks(cat, spec);
    const key = checksKey(checks);
    if (!checks.length || tried.has(key)) continue;
    tried.add(key);
    if (lastModel && allPass(checks, lastModel)) continue;
    const solvesNow = allPass(checks, curModel);
    if (solvesNow && p.strictCurrent) continue;
    if (p.accepts && !p.accepts(checks)) continue;
    const sol = p.lastWin || !p.accepts ? solve(cat, checks, p.avail, { ref: p.lastWin }) : null;
    if (!p.accepts && !sol) continue;
    const cost = sol && p.lastWin ? sol.cost : Infinity;
    const needsNewest = availNoNewest ? solve(cat, checks, availNoNewest, { stopAtFirst: true }) === null : false;
    const prefOk = !p.newest || (wantNewest ? needsNewest : !needsNewest);
    const unique = !p.avoidScenarios.has(spec.stages[0].scenario);
    const rank = (solvesNow ? 0 : 8) + (cost >= p.minChanged ? 4 : 0) + (prefOk ? 2 : 0) + (unique ? 1 : 0);
    if (!best || rank > best.rank) best = { spec, rank, cost };
    if (rank === 15 || (p.fallback && best)) break;
  }
  if (!best) return null;
  const challenge = resolveSpec(cat, best.spec, { id, source, tier: p.tier, seed });
  return { challenge, minCost: best.cost };
}
