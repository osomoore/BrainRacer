/** Cached lookup tables for one catalog (catalogs are immutable, so a WeakMap cache is safe). */
import type {
  AspectId, FacetDef, FacetId, FacetPhrases, ScenarioDef, ScenarioId, ScenarioPhrases, StatDef, StatId, Variant,
  VariantId, WorkshopCatalog,
} from '../core/types';

export interface CatalogIndex {
  variantById: Map<VariantId, Variant>;
  /** Variants of each aspect in catalog order. */
  byAspect: Map<AspectId, Variant[]>;
  aspectIds: AspectId[];
  statDef: Map<StatId, StatDef>;
  starterIds: Set<VariantId>;
  scenarioById: Map<ScenarioId, ScenarioDef>;
  facetById: Map<FacetId, { facet: FacetDef; scenario: ScenarioDef }>;
  facetPhrases: Map<FacetId, FacetPhrases>;
  scenarioPhrases: Map<ScenarioId, ScenarioPhrases>;
}

const cache = new WeakMap<WorkshopCatalog, CatalogIndex>();

export function index(cat: WorkshopCatalog): CatalogIndex {
  const hit = cache.get(cat);
  if (hit) return hit;
  const ix: CatalogIndex = {
    variantById: new Map(cat.variants.map((v) => [v.id, v])),
    byAspect: new Map(cat.aspects.map((a) => [a.id, [] as Variant[]])),
    aspectIds: cat.aspects.map((a) => a.id),
    statDef: new Map(cat.stats.map((s) => [s.id, s])),
    starterIds: new Set(cat.aspects.flatMap((a) => [...a.starters])),
    scenarioById: new Map(cat.scenarios.map((s) => [s.id, s])),
    facetById: new Map(),
    facetPhrases: new Map(cat.facetPhrases.map((p) => [p.facet, p])),
    scenarioPhrases: new Map(cat.scenarioPhrases.map((p) => [p.scenario, p])),
  };
  for (const v of cat.variants) ix.byAspect.get(v.aspect)?.push(v);
  for (const sc of cat.scenarios) for (const f of sc.facets) ix.facetById.set(f.id, { facet: f, scenario: sc });
  cache.set(cat, ix);
  return ix;
}
