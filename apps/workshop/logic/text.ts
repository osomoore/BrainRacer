/** Turns a scenario/facet selection into a fully resolved, saved Challenge (checks + text for every reading level). */
import { WS_RULES } from '../config';
import type { Challenge, ChallengeId, Check, FacetDef, Leveled, Requirement, Stage, StarterSpec, WorkshopCatalog } from '../core/types';
import { READING_LEVELS } from '../core/types';
import { Rng } from '../core/rng';
import { index } from './catalogIndex';

export interface ChallengeMeta {
  id: ChallengeId;
  source: Challenge['source'];
  tier: number;
  seed: number;
}

function pickAt(r: number, arr: readonly string[] | undefined, fallback: string): string {
  return arr && arr.length > 0 ? arr[Math.min(arr.length - 1, Math.floor(r * arr.length))] : fallback;
}

/** Always consumes exactly one rng draw so output stays stable whether or not phrases exist. */
function pick(rng: Rng, arr: readonly string[] | undefined, fallback: string): string {
  return pickAt(rng.next(), arr, fallback);
}

/**
 * The problem named on the card for one stage: the facet's level title when the stage has one requirement,
 * otherwise the scenario title (written to fit every facet of the scenario). Falls back to the scenario label.
 */
export function stageTitle(cat: WorkshopCatalog, st: StarterSpec['stages'][number]): string {
  const ix = index(cat);
  const fallback = ix.scenarioPhrases.get(st.scenario)?.title[0] ?? ix.scenarioById.get(st.scenario)?.label ?? st.scenario;
  if (st.facets.length !== 1) return fallback;
  const fs = st.facets[0];
  const titles = ix.facetPhrases.get(fs.facet)?.title;
  const def = ix.facetById.get(fs.facet)?.facet;
  if (!titles || titles.length === 0) return fallback;
  return titles[Math.min(def ? levelIndex(def, fs.level) : 0, titles.length - 1)];
}

export function levelIndex(f: FacetDef, level: number): number {
  const i = f.levels.indexOf(level);
  if (i >= 0) return i;
  let best = 0;
  f.levels.forEach((l, k) => { if (Math.abs(l - level) < Math.abs(f.levels[best] - level)) best = k; });
  return best;
}

/** Concrete checks of a spec (cheap: no text). Unknown scenario/facet ids are skipped. */
export function specChecks(cat: WorkshopCatalog, spec: Pick<StarterSpec, 'stages'>): Check[] {
  const ix = index(cat);
  return spec.stages.flatMap((st) => st.facets.flatMap((f) => ix.facetById.get(f.facet)?.facet.check(f.level) ?? []));
}

export function resolveSpec(cat: WorkshopCatalog, spec: Pick<StarterSpec, 'stages'>, meta: ChallengeMeta): Challenge {
  const ix = index(cat);
  const rng = new Rng(meta.seed ^ 0x5bd1e995);

  const titles = spec.stages.map((st) => {
    rng.next(); // titles used to be drawn at random; keep the draw so the line picks below stay stable
    return stageTitle(cat, st);
  });
  const title = titles.length <= 1 ? (titles[0] ?? 'Challenge')
    : titles.length === 2 ? `${titles[0]} & ${titles[1]}` : `${titles[0]} Adventure`;

  // No intro or story text: the title names the problem, each requirement names the fix.
  const intro: Leveled = { easy: '', medium: '', hard: '' };

  const stages: Stage[] = spec.stages.map((st, si) => {
    const requirements: Requirement[] = [];
    const params: Record<string, number> = {};
    let allSide = st.facets.length > 0;
    st.facets.forEach((fs, ri) => {
      const def = ix.facetById.get(fs.facet)?.facet;
      params[fs.facet] = fs.level;
      if (!def?.views.includes('side')) allSide = false;
      const phr = ix.facetPhrases.get(fs.facet);
      const reqPhr = phr && phr.requirement.length > 0
        ? phr.requirement[Math.min(def ? levelIndex(def, fs.level) : 0, phr.requirement.length - 1)] : undefined;
      const hintAspect = def?.hintAspect ?? '';
      const aspectLabel = cat.aspects.find((a) => a.id === hintAspect)?.label ?? hintAspect;
      // One draw picks the row (alternative i) for every reading level, so Easy/Medium/Hard say the same fix.
      // The other two draws are kept so the rng stream (and the hint picks) stay where they were.
      const row = rng.next(); rng.next(); rng.next();
      const text = {} as Leveled;
      for (const r of READING_LEVELS) text[r] = pickAt(row, reqPhr?.[r], `Build something for ${fs.facet}.`);
      const hint = {} as Leveled;
      for (const r of READING_LEVELS) hint[r] = pick(rng, phr?.hint[r], `Try changing the ${aspectLabel}.`);
      requirements.push({
        id: `s${si}r${ri}`, facet: fs.facet, level: fs.level,
        checks: (def?.check(fs.level) ?? []).map((check) => check.kind === 'anyOf'
          ? { ...check, options: check.options.map((option) => option.map((item) => ({ ...item }))) }
          : { ...check }),
        text, hint: { aspect: hintAspect, text: hint },
      });
    });
    return { scenario: st.scenario, view: allSide ? 'side' : 'top', params, requirements };
  });

  return {
    id: meta.id, workshop: cat.id, title, intro, stages, tier: meta.tier, source: meta.source,
    seed: meta.seed, genVersion: WS_RULES.genVersion,
  };
}
