/**
 * Direct failure hints: after a failed run, each failed requirement (at most WS_RULES.failLinesMax) gets one line
 * that names a fix. The fix is one the player already owns, else one they can afford, else any listed fix.
 * The chosen parts are saved per challenge (WorkshopProgress.failHints) and rendered at the current reading level.
 */
import { WS_RULES } from '../config';
import type {
  BasicCheck, Challenge, FailNote, Model, ReadingLevel, Requirement, RunResult, VariantId, WorkshopCatalog, WorkshopProgress,
} from '../core/types';
import { partsVisible, visibleAspectIds } from './aspects';
import { available } from './available';
import { index } from './catalogIndex';
import { purchaseRoutes } from './shop';
import { checkOptions, hybridChecks } from './namedFixes';
import { solve } from './solver';
import { allPass, checkPasses, computeModel, partTag } from './stats';
import { flatChecks } from './util';
import { FAIL_WORD_LIMIT, readingLines, STARTER_FAIL, STARTER_PART, STARTER_SHORT_FIX, wordCount } from './wording';

const PARTS = '{parts}';
const PART = '{part}';
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** How a part reads inside a sentence ("a Winch", "the Small size"). */
export function partPhrase(cat: WorkshopCatalog, id: VariantId, _reading?: ReadingLevel): string {
  return cat.partPhrases?.[id] ?? index(cat).variantById.get(id)?.name ?? id;
}

export function joinParts(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * Fill a template's "{parts}" with the parts. When the whole list is too long for the reading level, the first
 * parts are named. Easy through Hard append "and more" when parts are omitted.
 */
export function fillParts(cat: WorkshopCatalog, template: string, parts: readonly VariantId[], reading: ReadingLevel): string {
  const names = parts.map((id) => partPhrase(cat, id, reading));
  const render = (list: string): string => {
    const line = template.replace(PARTS, list);
    return template.startsWith(PARTS) ? cap(line) : line;
  };
  for (let n = names.length; n >= 1; n--) {
    const shown = names.slice(0, n);
    const line = render(joinParts(n === names.length || reading === 'starter' ? shown : [...shown, 'more']));
    if (wordCount(line) <= FAIL_WORD_LIMIT[reading]) return line;
    const short = STARTER_SHORT_FIX.replace(PARTS, joinParts(shown));
    if (reading === 'starter' && wordCount(short) <= FAIL_WORD_LIMIT.starter) return short;
    if (n === 1) return line;
  }
  return render('');
}

/** A practice situation, or a direct part instruction at Starter. */
export function practiceStory(cat: WorkshopCatalog, part: VariantId, reading: ReadingLevel): string {
  const template = cat.practiceStories?.[part]?.[reading]?.[0];
  if (reading !== 'starter') return template ?? 'The next practice run is ready.';
  const instruction = template ?? STARTER_PART;
  return instruction.replace(PART, partPhrase(cat, part, reading));
}

/** The complete fixes a requirement lists: its named fixes, or the parts a practice card asks for. */
export function fixesOf(req: Requirement): VariantId[][] {
  if (req.namedFixes?.length) return req.namedFixes.map((fix) => [...fix]);
  const tags = req.checks.flatMap((c) => c.kind === 'tag' && c.tag.startsWith('variant:') ? [c.tag.slice('variant:'.length)] : []);
  return tags.length ? [tags] : [];
}

/** Owned fix first, then one the wallet covers, then any; cheaper and shorter fixes win ties. */
export function chooseFix(cat: WorkshopCatalog, p: Pick<WorkshopProgress, 'wallet' | 'bought' | 'overrides' | 'easy'>,
  allFixes: readonly (readonly VariantId[])[]): VariantId[] | null {
  // Never name a part from an aspect that is hidden on Easy.
  const fixes = allFixes.filter((fix) => partsVisible(cat, p, fix));
  if (!fixes.length) return null;
  const owned = available(cat, p);
  const routes = purchaseRoutes(cat, p);
  const ranked = fixes.map((fix, i) => {
    const cost = fix.reduce((sum, id) => sum + (owned.has(id) ? 0 : routes.get(id)?.cost ?? Infinity), 0);
    return { fix, i, cost, rank: cost === 0 ? 0 : cost <= p.wallet ? 1 : 2 };
  });
  ranked.sort((a, b) => a.rank - b.rank || a.cost - b.cost || a.fix.length - b.fix.length || a.i - b.i);
  return [...ranked[0].fix];
}

/** A direct Starter requirement using one complete currently visible fix, or empty when no fix is visible. */
export function starterFixLine(cat: WorkshopCatalog, p: WorkshopProgress, req: Requirement): string {
  const fix = chooseFix(cat, p, fixesOf(req));
  return fix?.length ? STARTER_SHORT_FIX.replace(PARTS, joinParts(fix.map((id) => partPhrase(cat, id, 'starter')))) : '';
}

/** Parts not installed yet come first (they are the news), keeping fix order otherwise. */
function orderParts(fix: readonly VariantId[], model: Model): VariantId[] {
  const installed = new Set(Object.values(model));
  return [...fix.filter((id) => !installed.has(id)), ...fix.filter((id) => installed.has(id))];
}

/** One note per failed, reached requirement (in challenge order), at most WS_RULES.failLinesMax. */
export function failNotes(cat: WorkshopCatalog, p: WorkshopProgress, challenge: Challenge, result: RunResult): FailNote[] {
  if (result.passed) return [];
  const byId = new Map(result.requirements.map((r) => [r.id, r]));
  const failed = challenge.stages.flatMap((s) => s.requirements).filter((req) => {
    const r = byId.get(req.id);
    return !!r && !r.passed && r.reached;
  });
  if (!failed.length) return [];

  const routes = purchaseRoutes(cat, p);
  const candidates = available(cat, p);
  for (const id of routes.keys()) candidates.add(id);
  const variants = index(cat).variantById;
  const visibleAspects = new Set(visibleAspectIds(cat, p));
  const scale = cat.aspects.length + 1;
  const variantCosts = new Map<VariantId, number>();
  for (const id of candidates) {
    const aspect = variants.get(id)?.aspect;
    // One coin outweighs every possible per-aspect change-count tie-break.
    variantCosts.set(id, (routes.get(id)?.cost ?? 0) * scale + Number(p.model[aspect ?? ''] !== id));
  }
  const solution = solve(cat, flatChecks(challenge), candidates, { variantCosts });
  const currentModel = computeModel(cat, p.model);
  const solvedModel = solution ? computeModel(cat, solution.build) : null;
  const changedVisible = solution ? cat.aspects.flatMap((aspect) => {
    const after = solution.build[aspect.id];
    return after && after !== p.model[aspect.id] && variants.has(after) && visibleAspects.has(aspect.id) ? [after] : [];
  }) : [];

  const positiveContributors = (req: Requirement): VariantId[] => {
    if (!solution || !solvedModel) return [];
    const branches = checkOptions(hybridChecks(req.checks, req.namedFixes));
    const helps = (id: VariantId, branch: readonly BasicCheck[]): boolean => {
      const part = variants.get(id);
      if (!part) return false;
      const before = variants.get(p.model[part.aspect]);
      const tagsBefore = new Set(before ? [...before.tags, partTag(before.id)] : []);
      const tagsAfter = new Set([...part.tags, partTag(part.id)]);
      return branch.some((check) => {
        if (checkPasses(check, currentModel)) return false;
        if (check.kind === 'statMin') return (part.stats[check.stat] ?? 0) - (before?.stats[check.stat] ?? 0) > 0;
        if (check.kind === 'statMax') return (part.stats[check.stat] ?? 0) - (before?.stats[check.stat] ?? 0) < 0;
        if (check.kind === 'tag') return !tagsBefore.has(check.tag) && tagsAfter.has(check.tag);
        if (check.kind === 'noTag') return tagsBefore.has(check.tag) && !tagsAfter.has(check.tag);
        return false;
      });
    };
    const branch = branches.find((option) => allPass(option, solvedModel));
    if (!branch) return [];
    return changedVisible.filter((id) => helps(id, branch))
      .sort((a, b) => Number(variants.get(b)?.aspect === req.hint.aspect) - Number(variants.get(a)?.aspect === req.hint.aspect));
  };

  const notes: FailNote[] = [];
  for (const req of failed) {
    const fix = solution
      ? positiveContributors(req)
      : orderParts(chooseFix(cat, p, fixesOf(req)) ?? [], p.model);
    if (!fix.length) continue;
    notes.push({ req: req.id, parts: fix });
    if (notes.length >= WS_RULES.failLinesMax) break;
  }
  return notes;
}

/** Failure templates for a requirement: the facet's, or the practice ones. */
export function failTemplates(cat: WorkshopCatalog, facet: string, reading: ReadingLevel): readonly string[] {
  const bank = facet.startsWith('practice.') ? cat.practiceFail : cat.stories?.[facet]?.fail;
  return readingLines(bank, reading) ?? [reading === 'starter' ? STARTER_FAIL : `You needed ${PARTS}.`];
}

/** The lines for saved notes at a reading level (notes for requirements no longer in the challenge are skipped). */
export function failLines(cat: WorkshopCatalog, challenge: Challenge, notes: readonly FailNote[] | undefined, reading: ReadingLevel): string[] {
  const reqs = new Map(challenge.stages.flatMap((s) => s.requirements).map((r) => [r.id, r]));
  return (notes ?? []).slice(0, WS_RULES.failLinesMax).flatMap((note, k) => {
    const req = reqs.get(note.req);
    if (!req || !note.parts.length) return [];
    const templates = failTemplates(cat, req.facet, reading);
    const template = templates[Math.abs(challenge.seed + k) % templates.length];
    const fallback = reading === 'starter' && templates === failTemplates(cat, req.facet, 'easy');
    return [fillParts(cat, template, note.parts, fallback ? 'easy' : reading)];
  });
}
