/**
 * Constraint solver: given checks and the available variants, find a build that satisfies every check and
 * (optionally) changes as few aspects as possible from a reference build. Branch and bound over aspects,
 * with variants collapsed by their effect on the relevant stats/tags; aspects that cannot matter are fixed.
 */
import type { BasicCheck, Check, Model, VariantId, WorkshopCatalog } from '../core/types';
import { index } from './catalogIndex';
import { partTag } from './stats';

export interface SolveOptions {
  /** Reference build for the change count (null: every solution costs 0 and the first one wins). */
  ref?: Model | null;
  /** Optional additive cost per variant, in place of the reference-build change count. */
  variantCosts?: ReadonlyMap<VariantId, number>;
  /** Only look for solutions strictly below this cost. */
  costLimit?: number;
  /** Return the first solution found (feasibility only). */
  stopAtFirst?: boolean;
}

export interface Solution {
  build: Model;
  /** Minimum variant cost, or number of aspects changed from the reference. */
  cost: number;
}

interface Group { contrib: number[]; mask: number; variant: VariantId; cost: number }

const MAX_TAGS = 30;

export function solve(cat: WorkshopCatalog, checks: readonly Check[], avail: ReadonlySet<VariantId>, opts: SolveOptions = {}): Solution | null {
  const alternatives = checks.find((check) => check.kind === 'anyOf');
  if (!alternatives) return solveConjunction(cat, checks as readonly BasicCheck[], avail, opts);

  // Each complete branch describes one build, including all the other requirements.
  const remaining = checks.filter((check) => check !== alternatives);
  let best: Solution | null = null;
  for (const option of alternatives.options) {
    const candidate = solve(cat, [...remaining, ...option], avail, { ...opts, costLimit: best?.cost ?? opts.costLimit });
    if (!candidate) continue;
    best = candidate;
    if (opts.stopAtFirst || candidate.cost === 0) break;
  }
  return best;
}

function solveConjunction(cat: WorkshopCatalog, checks: readonly BasicCheck[], avail: ReadonlySet<VariantId>, opts: SolveOptions): Solution | null {
  const ix = index(cat);
  const ref = opts.ref ?? null;

  // --- reduce checks to raw bounds on (unclamped) stat sums and tag masks
  const lo = new Map<string, number>();
  const hi = new Map<string, number>();
  const req = new Set<string>();
  const forb = new Set<string>();
  for (const c of checks) {
    if (c.kind === 'statMin') {
      const d = ix.statDef.get(c.stat);
      if (!d) { if (0 < c.min) return null; continue; }
      if (c.min <= d.min) continue;
      if (c.min > d.max) return null;
      lo.set(c.stat, Math.max(lo.get(c.stat) ?? -Infinity, c.min));
    } else if (c.kind === 'statMax') {
      const d = ix.statDef.get(c.stat);
      if (!d) { if (0 > c.max) return null; continue; }
      if (c.max >= d.max) continue;
      if (c.max < d.min) return null;
      hi.set(c.stat, Math.min(hi.get(c.stat) ?? Infinity, c.max));
    } else if (c.kind === 'tag') req.add(c.tag);
    else forb.add(c.tag);
  }
  for (const t of req) if (forb.has(t)) return null;

  const stats = [...new Set([...lo.keys(), ...hi.keys()])];
  const tagBit = new Map<string, number>();
  for (const t of [...req, ...forb]) tagBit.set(t, tagBit.size);
  if (tagBit.size > MAX_TAGS) throw new Error(`solver: more than ${MAX_TAGS} distinct tags in one problem`);
  const reqMask = [...req].reduce((m, t) => m | (1 << tagBit.get(t)!), 0);
  const forbMask = [...forb].reduce((m, t) => m | (1 << tagBit.get(t)!), 0);
  const loArr = stats.map((s) => lo.get(s) ?? -Infinity);
  const hiArr = stats.map((s) => hi.get(s) ?? Infinity);
  const cur = stats.map((s) => ix.statDef.get(s)!.base);
  let curMask = 0;

  // --- per-aspect option groups
  const fixedPick = new Map<string, VariantId>();
  let baseCost = 0;
  const free: { aspect: string; groups: Group[]; spread: number }[] = [];
  for (const aspect of ix.aspectIds) {
    const refId = ref?.[aspect];
    const map = new Map<string, Group>();
    for (const v of ix.byAspect.get(aspect) ?? []) {
      if (!avail.has(v.id)) continue;
      let mask = 0;
      for (const t of v.tags) { const b = tagBit.get(t); if (b !== undefined) mask |= 1 << b; }
      const installedPartBit = tagBit.get(partTag(v.id));
      if (installedPartBit !== undefined) mask |= 1 << installedPartBit;
      if (mask & forbMask) continue;
      const contrib = stats.map((s) => v.stats[s] ?? 0);
      const key = `${contrib.join(',')}|${mask}`;
      const cost = opts.variantCosts ? (opts.variantCosts.get(v.id) ?? 0) : Number(!!ref && v.id !== refId);
      const group = map.get(key);
      if (!group || cost < group.cost) map.set(key, { contrib, mask, variant: v.id, cost });
    }
    const groups = [...map.values()];
    if (groups.length === 0) return null;
    if (groups.length === 1) {
      const g = groups[0];
      g.contrib.forEach((c, i) => { cur[i] += c; });
      curMask |= g.mask;
      fixedPick.set(aspect, g.variant);
      baseCost += g.cost;
      continue;
    }
    let spread = 0;
    stats.forEach((_s, i) => {
      const vals = groups.map((g) => g.contrib[i]);
      spread += Math.max(...vals) - Math.min(...vals);
    });
    spread += 5 * groups.filter((g) => g.mask !== groups[0].mask).length;
    groups.sort((a, b) => a.cost - b.cost);
    free.push({ aspect, groups, spread });
  }
  free.sort((a, b) => b.spread - a.spread);
  const n = free.length;

  // suffix bounds
  const sufMax: number[][] = [];
  const sufMin: number[][] = [];
  const sufTag: number[] = new Array(n + 1).fill(0);
  sufMax[n] = stats.map(() => 0);
  sufMin[n] = stats.map(() => 0);
  for (let i = n - 1; i >= 0; i--) {
    sufMax[i] = stats.map((_s, k) => sufMax[i + 1][k] + Math.max(...free[i].groups.map((g) => g.contrib[k])));
    sufMin[i] = stats.map((_s, k) => sufMin[i + 1][k] + Math.min(...free[i].groups.map((g) => g.contrib[k])));
    sufTag[i] = sufTag[i + 1] | free[i].groups.reduce((m, g) => m | g.mask, 0);
  }

  let best = opts.costLimit ?? Infinity;
  let bestChoice: Group[] | null = null;
  const choice: Group[] = new Array(n);
  let done = false;
  const stopAtFirst = opts.stopAtFirst || (!ref && !opts.variantCosts);

  const dfs = (i: number, cost: number): void => {
    if (done || cost >= best) return;
    for (let k = 0; k < stats.length; k++) {
      if (cur[k] + sufMax[i][k] < loArr[k] || cur[k] + sufMin[i][k] > hiArr[k]) return;
    }
    if (((curMask | sufTag[i]) & reqMask) !== reqMask) return;
    if (i === n) {
      best = cost;
      bestChoice = choice.slice();
      if (stopAtFirst) done = true;
      return;
    }
    const groups = free[i].groups;
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const savedMask = curMask;
      for (let k = 0; k < stats.length; k++) cur[k] += g.contrib[k];
      curMask |= g.mask;
      choice[i] = g;
      dfs(i + 1, cost + g.cost);
      for (let k = 0; k < stats.length; k++) cur[k] -= g.contrib[k];
      curMask = savedMask;
      if (done) return;
    }
  };
  dfs(0, baseCost);
  if (!bestChoice) return null;

  const build: Model = {};
  for (const aspect of ix.aspectIds) {
    const fixed = fixedPick.get(aspect);
    if (fixed) { build[aspect] = fixed; continue; }
    const i = free.findIndex((f) => f.aspect === aspect);
    build[aspect] = (bestChoice as Group[])[i].variant;
  }
  return { build, cost: best };
}

export function solvable(cat: WorkshopCatalog, checks: readonly Check[], avail: ReadonlySet<VariantId>): boolean {
  return solve(cat, checks, avail, { stopAtFirst: true }) !== null;
}
