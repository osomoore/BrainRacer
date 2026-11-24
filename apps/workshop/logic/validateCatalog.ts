/** Content validator: returns a list of problems (empty = fine). Used by tests and by content authors. */
import { READING_LEVELS } from '../core/types';
import type { Check, WorkshopCatalog } from '../core/types';
import { index } from './catalogIndex';
import { solve, solvable } from './solver';
import { allPass, computeModel, defaultModel } from './stats';
import { starterChallenge } from './starters';
import { flatChecks } from './util';
import { WS_RULES } from '../config';

const MIN_TIER0_STARTER_ONLY_FACETS = 3;

export function validateCatalog(cat: WorkshopCatalog): string[] {
  const out: string[] = [];
  const ix = index(cat);
  const w = cat.id;
  const err = (m: string): void => { out.push(`[${w}] ${m}`); };

  // --- ids
  const dup = (what: string, ids: string[]): void => {
    const seen = new Set<string>();
    for (const id of ids) { if (seen.has(id)) err(`duplicate ${what} id "${id}"`); seen.add(id); }
  };
  dup('aspect', cat.aspects.map((a) => a.id));
  dup('variant', cat.variants.map((v) => v.id));
  dup('stat', cat.stats.map((s) => s.id));
  dup('scenario', cat.scenarios.map((s) => s.id));
  dup('facet', cat.scenarios.flatMap((s) => s.facets.map((f) => f.id)));
  dup('starter', cat.starters.map((s) => s.id));

  // --- variants
  const allTags = new Set<string>();
  for (const v of cat.variants) {
    if (!ix.byAspect.has(v.aspect)) err(`variant ${v.id}: unknown aspect "${v.aspect}"`);
    if (!v.id.startsWith(`${v.aspect}.`)) err(`variant ${v.id}: id must be prefixed "${v.aspect}."`);
    for (const k of Object.keys(v.stats)) if (!ix.statDef.has(k)) err(`variant ${v.id}: unknown stat "${k}"`);
    for (const t of v.tags) allTags.add(t);
  }
  for (const a of cat.aspects) {
    if ((ix.byAspect.get(a.id) ?? []).length < 2) err(`aspect ${a.id}: needs at least 2 variants`);
    for (const s of a.starters) {
      const v = ix.variantById.get(s);
      if (!v) err(`aspect ${a.id}: starter "${s}" does not exist`);
      else if (v.aspect !== a.id) err(`aspect ${a.id}: starter "${s}" belongs to ${v.aspect}`);
    }
    if (a.starters[0] === a.starters[1]) err(`aspect ${a.id}: starters must differ`);
  }

  // --- unlock order
  const nonStarters = cat.variants.filter((v) => !ix.starterIds.has(v.id)).map((v) => v.id);
  const counts = new Map<string, number>();
  for (const u of cat.unlockOrder) counts.set(u, (counts.get(u) ?? 0) + 1);
  for (const id of nonStarters) if ((counts.get(id) ?? 0) !== 1) err(`unlockOrder: "${id}" appears ${counts.get(id) ?? 0} times (need exactly 1)`);
  for (const [id, n] of counts) {
    if (!ix.variantById.has(id)) err(`unlockOrder: unknown variant "${id}"`);
    else if (ix.starterIds.has(id)) err(`unlockOrder: "${id}" is a starter`);
    else if (n > 1 && !nonStarters.includes(id)) err(`unlockOrder: "${id}" repeated`);
  }

  // --- scenarios, facets, phrases
  const allVariants = new Set(cat.variants.map((v) => v.id));
  const starterVariants = new Set(ix.starterIds);
  let tier0StarterOnly = 0;
  const checkRefs = (where: string, checks: Check[]): void => {
    for (const c of checks) {
      if ((c.kind === 'statMin' || c.kind === 'statMax') && !ix.statDef.has(c.stat)) err(`${where}: unknown stat "${c.stat}"`);
      if ((c.kind === 'tag' || c.kind === 'noTag') && !allTags.has(c.tag)) err(`${where}: no variant has tag "${c.tag}"`);
    }
  };
  const sentences = (where: string, rec: Readonly<Record<string, readonly string[] | undefined>> | undefined): void => {
    for (const r of READING_LEVELS) {
      const arr = rec?.[r];
      if (!arr || arr.length < 2) err(`${where} [${r}]: needs >= 2 sentences`);
      else if (arr.some((s) => !s || !s.trim())) err(`${where} [${r}]: empty sentence`);
    }
  };
  for (const sc of cat.scenarios) {
    const sp = ix.scenarioPhrases.get(sc.id);
    if (!sp) err(`scenario ${sc.id}: no scenarioPhrases`);
    else {
      if (sp.title.length < 1) err(`scenario ${sc.id}: no title`);
      sentences(`scenario ${sc.id} intro`, sp.intro);
    }
    if (sc.facets.length === 0) err(`scenario ${sc.id}: no facets`);
    for (const f of sc.facets) {
      if (!f.id.startsWith(`${sc.id}.`)) err(`facet ${f.id}: id must be prefixed "${sc.id}."`);
      if (f.levels.length === 0) err(`facet ${f.id}: no levels`);
      if (f.views.length === 0) err(`facet ${f.id}: no views`);
      if (!ix.byAspect.has(f.hintAspect)) err(`facet ${f.id}: unknown hintAspect "${f.hintAspect}"`);
      const ph = ix.facetPhrases.get(f.id);
      if (!ph) err(`facet ${f.id}: no facetPhrases`);
      else {
        if (ph.requirement.length < f.levels.length) err(`facet ${f.id}: ${ph.requirement.length} requirement phrase rows for ${f.levels.length} levels`);
        ph.requirement.forEach((row, i) => sentences(`facet ${f.id} requirement[${i}]`, row));
        sentences(`facet ${f.id} hint`, ph.hint);
      }
      for (const lv of f.levels) {
        const checks = f.check(lv);
        if (checks.length === 0) err(`facet ${f.id} level ${lv}: no checks`);
        checkRefs(`facet ${f.id} level ${lv}`, checks);
        if (!solvable(cat, checks, allVariants)) err(`facet ${f.id} level ${lv}: not solvable even with every variant`);
      }
      if (sc.minTier === 0 && f.minTier === 0 && f.levels.some((lv) => solvable(cat, f.check(lv), starterVariants))) tier0StarterOnly++;
    }
  }
  for (const p of cat.facetPhrases) if (!ix.facetById.has(p.facet)) err(`facetPhrases: unknown facet "${p.facet}"`);
  for (const p of cat.scenarioPhrases) if (!ix.scenarioById.has(p.scenario)) err(`scenarioPhrases: unknown scenario "${p.scenario}"`);
  if (tier0StarterOnly < MIN_TIER0_STARTER_ONLY_FACETS) {
    err(`only ${tier0StarterOnly} tier-0 facets are solvable with starter variants alone (need >= ${MIN_TIER0_STARTER_ONLY_FACETS})`);
  }

  // --- starters
  if (cat.starters.length < WS_RULES.boardSize) err(`needs at least ${WS_RULES.boardSize} starters`);
  const def = defaultModel(cat);
  const defCm = computeModel(cat, def);
  for (const spec of cat.starters) {
    const problems = out.length;
    for (const st of spec.stages) {
      const sc = ix.scenarioById.get(st.scenario);
      if (!sc) { err(`starter ${spec.id}: unknown scenario "${st.scenario}"`); continue; }
      for (const f of st.facets) {
        const fd = ix.facetById.get(f.facet);
        if (!fd || fd.scenario.id !== sc.id) err(`starter ${spec.id}: facet "${f.facet}" is not in scenario ${sc.id}`);
        else if (!fd.facet.levels.includes(f.level)) err(`starter ${spec.id}: level ${f.level} is not a level of ${f.facet}`);
      }
    }
    if (out.length > problems) continue;
    const checks = flatChecks(starterChallenge(cat, spec));
    checkRefs(`starter ${spec.id}`, checks);
    if (allPass(checks, defCm)) err(`starter ${spec.id}: already solved by the default model`);
    const sol = solve(cat, checks, starterVariants, { ref: def });
    if (!sol) err(`starter ${spec.id}: not solvable with starter variants`);
    else if (sol.cost > 1) err(`starter ${spec.id}: needs ${sol.cost} aspects changed (should need 1)`);
  }
  return out;
}
