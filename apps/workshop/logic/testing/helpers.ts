/** Test helpers: deep freeze, random synthetic catalogs. */
import { Rng } from '../../core/rng';
import type { AspectDef, Check, StatDef, Variant, WorkshopCatalog } from '../../core/types';
import { FIXTURE_CATALOG } from './fixtureCatalog';

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) deepFreeze((o as Record<string, unknown>)[k]);
  }
  return o;
}

const STAT_IDS = ['a', 'b', 'c', 'd'];
const TAGS = ['t1', 't2', 't3'];

/** Random catalog with `aspects` x `variantsPer` variants (no scenarios); for solver tests. */
export function syntheticCatalog(seed: number, aspects: number, variantsPer: number): WorkshopCatalog {
  const rng = new Rng(seed);
  const stats: StatDef[] = STAT_IDS.map((id) => ({ id, label: id, base: rng.int(0, 3), min: 0, max: 12 }));
  const asp: AspectDef[] = [];
  const vars: Variant[] = [];
  for (let i = 0; i < aspects; i++) {
    const id = `x${i}`;
    asp.push({ id, label: id, starters: [`${id}.0`, `${id}.1`], visibleFromTop: true });
    for (let j = 0; j < variantsPer; j++) {
      const st: Record<string, number> = {};
      for (const s of STAT_IDS) if (rng.chance(0.5)) st[s] = rng.int(-2, 3);
      vars.push({ id: `${id}.${j}`, aspect: id, name: `${id}${j}`, stats: st, tags: TAGS.filter(() => rng.chance(0.12)), note: '' });
    }
  }
  return { ...FIXTURE_CATALOG, id: 'dino', stats, aspects: asp, variants: vars, scenarios: [], facetPhrases: [], scenarioPhrases: [], unlockOrder: [], starters: [] };
}

export function randomChecks(rng: Rng, n: number): Check[] {
  const out: Check[] = [];
  for (let i = 0; i < n; i++) {
    const k = rng.int(0, 3);
    if (k === 0) out.push({ kind: 'statMin', stat: rng.pick(STAT_IDS), min: rng.int(2, 14) });
    else if (k === 1) out.push({ kind: 'statMax', stat: rng.pick(STAT_IDS), max: rng.int(-1, 8) });
    else if (k === 2) out.push({ kind: 'tag', tag: rng.pick(TAGS) });
    else out.push({ kind: 'noTag', tag: rng.pick(TAGS) });
  }
  return out;
}
