/**
 * Tiny local solver for content balance tests (the real engine lives in logic/). Pure, no Phaser.
 * Finds one model, using only `allowed` variants, that passes every check.
 */
import type { Check, Model, VariantId, WorkshopCatalog } from '../../core/types';
import { allPass } from '../../logic/stats';

export function computeStats(cat: WorkshopCatalog, model: Model): { stats: Record<string, number>; tags: Set<string> } {
  const stats: Record<string, number> = {};
  for (const s of cat.stats) stats[s.id] = s.base;
  const tags = new Set<string>();
  for (const vid of Object.values(model)) {
    const v = cat.variants.find((x) => x.id === vid);
    if (!v) throw new Error(`unknown variant ${vid}`);
    for (const [k, d] of Object.entries(v.stats)) stats[k] = (stats[k] ?? 0) + (d ?? 0);
    for (const t of v.tags) tags.add(t);
  }
  for (const s of cat.stats) stats[s.id] = Math.max(s.min, Math.min(s.max, stats[s.id]));
  return { stats, tags };
}

export function passes(cat: WorkshopCatalog, model: Model, checks: readonly Check[]): boolean {
  return allPass(checks, computeStats(cat, model));
}

export function defaultModel(cat: WorkshopCatalog): Model {
  return Object.fromEntries(cat.aspects.map((a) => [a.id, a.starters[0]]));
}

export function starterSet(cat: WorkshopCatalog): Set<VariantId> {
  return new Set(cat.aspects.flatMap((a) => [...a.starters]));
}

/** Depth-first search with stat bounds. Returns a passing model or null. */
export function solve(cat: WorkshopCatalog, checks: readonly Check[], allowed: ReadonlySet<VariantId>): Model | null {
  const basicChecks = checks.flatMap((check) => check.kind === 'anyOf' ? check.options.flat() : [check]);
  const statIds = [...new Set(basicChecks.flatMap((c) => (c.kind === 'statMin' || c.kind === 'statMax' ? [c.stat] : [])))];
  const tagIds = [...new Set(basicChecks.flatMap((c) => (c.kind === 'tag' || c.kind === 'noTag' ? [c.tag] : [])))];
  // Options per aspect, deduplicated by what the checks can see (keeps the search tiny).
  const opts = cat.aspects.map((a) => {
    const seen = new Set<string>();
    return cat.variants.filter((v) => {
      if (v.aspect !== a.id || !allowed.has(v.id)) return false;
      const key = [...statIds.map((s) => v.stats[s] ?? 0), ...tagIds.map((t) => v.tags.includes(t))].join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  if (opts.some((o) => o.length === 0)) return null;
  const base = Object.fromEntries(cat.stats.map((s) => [s.id, s.base]));
  // remaining max/min contribution per stat from aspect i onward
  const n = opts.length;
  const remMax: Record<string, number[]> = {};
  const remMin: Record<string, number[]> = {};
  for (const s of statIds) {
    remMax[s] = new Array(n + 1).fill(0);
    remMin[s] = new Array(n + 1).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      const ds = opts[i].map((v) => v.stats[s] ?? 0);
      remMax[s][i] = remMax[s][i + 1] + Math.max(...ds);
      remMin[s][i] = remMin[s][i + 1] + Math.min(...ds);
    }
  }
  const pick: string[] = [];
  const sum: Record<string, number> = Object.fromEntries(statIds.map((s) => [s, 0]));
  const rec = (i: number): boolean => {
    for (const c of checks) {
      if (c.kind === 'statMin' && base[c.stat] + sum[c.stat] + remMax[c.stat][i] < c.min) return false;
      if (c.kind === 'statMax' && base[c.stat] + sum[c.stat] + remMin[c.stat][i] > c.max) return false;
    }
    for (const c of checks) {
      if (c.kind === 'tag' && !pick.slice(0, i).some((id) => cat.variants.find((v) => v.id === id)!.tags.includes(c.tag))
        && !opts.slice(i).some((o) => o.some((v) => v.tags.includes(c.tag)))) return false;
    }
    if (i === n) {
      const model = Object.fromEntries(cat.aspects.map((a, k) => [a.id, pick[k]]));
      return passes(cat, model, checks);
    }
    for (const v of opts[i]) {
      pick[i] = v.id;
      for (const s of statIds) sum[s] += v.stats[s] ?? 0;
      const ok = rec(i + 1);
      for (const s of statIds) sum[s] -= v.stats[s] ?? 0;
      if (ok) return true;
    }
    return false;
  };
  if (!rec(0)) return null;
  return Object.fromEntries(cat.aspects.map((a, k) => [a.id, pick[k]]));
}

/** Aspects where changing just that one part of `from` (to an allowed variant) passes the checks. */
export function oneChangeFixes(cat: WorkshopCatalog, from: Model, checks: readonly Check[], allowed: ReadonlySet<VariantId>): VariantId[] {
  const out: VariantId[] = [];
  for (const v of cat.variants) {
    if (!allowed.has(v.id) || from[v.aspect] === v.id) continue;
    if (passes(cat, { ...from, [v.aspect]: v.id }, checks)) out.push(v.id);
  }
  return out;
}
