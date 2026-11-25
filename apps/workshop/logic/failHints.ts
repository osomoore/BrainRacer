/**
 * Direct failure hints: after a failed run, each failed requirement (at most WS_RULES.failLinesMax) gets one line
 * that names a fix. The fix is one the player already owns, else one they can afford, else any listed fix.
 * The chosen parts are saved per challenge (WorkshopProgress.failHints) and rendered at the current reading level.
 */
import { WS_RULES } from '../config';
import type {
  Challenge, FailNote, Model, ReadingLevel, Requirement, RunResult, VariantId, WorkshopCatalog, WorkshopProgress,
} from '../core/types';
import { partsVisible } from './aspects';
import { available } from './available';
import { index } from './catalogIndex';
import { purchaseRoutes } from './shop';
import { FAIL_WORD_LIMIT, readingLines, STARTER_FAIL, STARTER_PART, STARTER_SHORT_FIX, wordCount } from './wording';

const PARTS = '{parts}';
const PART = '{part}';
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** How a part reads inside a sentence ("a Winch", "the Small size"). */
export function partPhrase(cat: WorkshopCatalog, id: VariantId, reading?: ReadingLevel): string {
  return (reading !== 'starter' ? cat.partPhrases?.[id] : undefined) ?? index(cat).variantById.get(id)?.name ?? id;
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

/** A practice story: the station's template with the part filled in. */
export function practiceStory(cat: WorkshopCatalog, part: VariantId, reading: ReadingLevel): string {
  const v = index(cat).variantById.get(part);
  const bank = v ? cat.practiceStories?.[v.aspect] : undefined;
  if (reading === 'starter' && !bank?.starter?.length && bank?.easy?.length) return practiceStory(cat, part, 'easy');
  const template = bank?.[reading]?.[0] ?? (reading === 'starter' ? STARTER_PART : undefined);
  if (!template) return `Use ${v?.name ?? part}.`;
  const line = template.replace(PART, partPhrase(cat, part, reading));
  return template.startsWith(PART) ? cap(line) : line;
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

/** Parts not installed yet come first (they are the news), keeping fix order otherwise. */
function orderParts(fix: readonly VariantId[], model: Model): VariantId[] {
  const installed = new Set(Object.values(model));
  return [...fix.filter((id) => !installed.has(id)), ...fix.filter((id) => installed.has(id))];
}

/** One note per failed, reached requirement (in challenge order), at most WS_RULES.failLinesMax. */
export function failNotes(cat: WorkshopCatalog, p: WorkshopProgress, challenge: Challenge, result: RunResult): FailNote[] {
  if (result.passed) return [];
  const byId = new Map(result.requirements.map((r) => [r.id, r]));
  const notes: FailNote[] = [];
  for (const req of challenge.stages.flatMap((s) => s.requirements)) {
    const r = byId.get(req.id);
    if (!r || r.passed || !r.reached) continue;
    const fix = chooseFix(cat, p, fixesOf(req));
    if (!fix) continue;
    notes.push({ req: req.id, parts: orderParts(fix, p.model) });
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
