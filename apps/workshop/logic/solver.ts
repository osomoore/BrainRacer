/**
 * Constraint solver: given checks and the available variants, find a build that satisfies every check and
 * (optionally) changes as few aspects as possible from a reference build. Branch and bound over aspects,
 * with variants collapsed by their effect on the relevant stats/tags; aspects that cannot matter are fixed.
 */
import type { Check, Model, VariantId, WorkshopCatalog } from '../core/types';
import { index } from './catalogIndex';

export interface SolveOptions {
  /** Reference build for the change count (null: every solution costs 0 and the first one wins). */
  ref?: Model | null;
  /** Only look for solutions that change fewer than this many aspects. */
  costLimit?: number;
  /** Return the first solution found (feasibility only). */
  stopAtFirst?: boolean;
}

export interface Solution {
  build: Model;
  /** Number of aspects changed from the reference (relevant aspects only). */
  cost: number;
}

interface Group { contrib: number[]; mask: number; variants: VariantId[]; cost: number }

const MAX_TAGS = 30;

export function solve(cat: WorkshopCatalog, checks: readonly Check[], avail: ReadonlySet<VariantId>, opts: SolveOptions = {}): Solution | null {
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
  const chosenVariant = (g: Group, refId: VariantId | undefined): VariantId => (refId && g.variants.includes(refId) ? refId : g.variants[0]);
  for (const aspect of ix.aspectIds) {
    const refId = ref?.[aspect];
    const map = new Map<string, Group>();
    for (const v of ix.byAspect.get(aspect) ?? []) {
      if (!avail.has(v.id)) continue;
      let mask = 0;
      for (const t of v.tags) { const b = tagBit.get(t); if (b !== undefined) mask |= 1 << b; }
      if (mask & forbMask) continue;
      const contrib = stats.map((s) => v.stats[s] ?? 0);
      const key = `${contrib.join(',')}|${mask}`;
      let g = map.get(key);
      if (!g) { g = { contrib, mask, variants: [], cost: ref ? 1 : 0 }; map.set(key, g); }
      g.variants.push(v.id);
      if (ref && v.id === refId) g.cost = 0;
    }
    const groups = [...map.values()];
    if (groups.length === 0) return null;
    if (groups.length === 1) {
      const g = groups[0];
      g.contrib.forEach((c, i) => { cur[i] += c; });
      curMask |= g.mask;
      const pickId = chosenVariant(g, refId);
      fixedPick.set(aspect, pickId);
      if (ref && pickId !== refId) baseCost++;
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
  const stopAtFirst = opts.stopAtFirst || !ref;

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
    build[aspect] = chosenVariant((bestChoice as Group[])[i], ref?.[aspect]);
  }
  return { build, cost: ref ? best : 0 };
}

export function solvable(cat: WorkshopCatalog, checks: readonly Check[], avail: ReadonlySet<VariantId>): boolean {
  return solve(cat, checks, avail, { stopAtFirst: true }) !== null;
}
