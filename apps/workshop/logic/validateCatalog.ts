/** Content validator: returns a list of problems (empty = fine). Used by tests and by content authors. */
import { READING_LEVELS } from '../core/types';
import type { BasicCheck, Check, FacetDef, ReadingLevel, Variant, VariantId, WorkshopCatalog } from '../core/types';
import { index } from './catalogIndex';
import { solve, solvable } from './solver';
import { allPass, computeModel, defaultModel, partTag } from './stats';
import { starterChallenge } from './starters';
import { flatChecks } from './util';
import { WS_RULES } from '../config';

const MIN_TIER0_STARTER_ONLY_FACETS = 3;
const GUIDELINE_WORD_LIMIT: Record<ReadingLevel, number> = { easy: 6, medium: 8, hard: 12 };
const TITLE_WORD_LIMIT = 4;
/** Words beginning readers stumble on (found in the 2026 text review), plus idioms. Part names are allowed. */
export const HARD_WORDS: readonly string[] = [
  'canyon', 'dune', 'dunes', 'flock', 'shoo', 'shove', 'slippery', 'twisty', 'zigzag', 'pebble', 'pebbles', 'gooey',
  'coconut', 'freezing', 'sneaky', 'cruncher', 'turner', 'ledge', 'pesky', 'heave', 'sag', 'snowstorm', 'traction',
  'terrain', 'obstacle', 'clearance', 'navigate', 'accelerate', 'conceal', 'durable', 'get a grip', 'is a wall',
];
const PLACEHOLDER = /[{}<>[\]_|\\]|\b(?:TODO|TBD|XXX|FIXME)\b|\.\.\./;

export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The variants a guideline names: variant names as shown at the stations (an optional plural "s" is fine) and the
 * catalog's approved aliases. Longer names win, so "Big Engine" does not also count as the size "Big".
 */
export function namedVariants(cat: WorkshopCatalog, line: string): Set<VariantId> {
  const names = new Map<string, Set<VariantId>>();
  const add = (name: string, ids: readonly VariantId[]): void => {
    const key = name.toLowerCase();
    const set = names.get(key) ?? new Set<VariantId>();
    ids.forEach((id) => set.add(id));
    names.set(key, set);
  };
  for (const v of cat.variants) add(v.name, [v.id]);
  for (const [alias, ids] of Object.entries(cat.partAliases ?? {})) add(alias, ids);
  let rest = ` ${line.toLowerCase()} `;
  const out = new Set<VariantId>();
  for (const [name, ids] of [...names].sort((a, b) => b[0].length - a[0].length)) {
    const stem = name.endsWith('s') ? `${escapeRe(name.slice(0, -1))}s?` : `${escapeRe(name)}s?`;
    const re = new RegExp(`(?<![a-z0-9])${stem}(?![a-z0-9])`, 'g');
    if (!re.test(rest)) continue;
    ids.forEach((id) => out.add(id));
    rest = rest.replace(re, (m) => ' '.repeat(m.length));
  }
  return out;
}

/** True when picking `v` (instead of its aspect's default part) moves the model toward passing `c`. */
export function variantHelps(cat: WorkshopCatalog, v: Variant, c: BasicCheck): boolean {
  const aspect = cat.aspects.find((a) => a.id === v.aspect);
  const base = cat.variants.find((x) => x.id === aspect?.starters[0]);
  const delta = (stat: string): number => (v.stats[stat] ?? 0) - (base?.stats[stat] ?? 0);
  if (c.kind === 'statMin') return delta(c.stat) > 0;
  if (c.kind === 'statMax') return delta(c.stat) < 0;
  if (c.kind === 'tag') return partTag(v.id) === c.tag || v.tags.includes(c.tag);
  return !v.tags.includes(c.tag);
}

const describeCheck = (c: BasicCheck): string => c.kind === 'statMin' ? `${c.stat} >= ${c.min}`
  : c.kind === 'statMax' ? `${c.stat} <= ${c.max}` : c.kind === 'tag' ? `tag ${c.tag}` : `no tag ${c.tag}`;

/** What a guideline fails to name: a helping part for every check (and for every option of an any-of). */
export function lineProblems(cat: WorkshopCatalog, checks: readonly Check[], line: string): string[] {
  const named = [...namedVariants(cat, line)].map((id) => cat.variants.find((v) => v.id === id)).filter((v): v is Variant => !!v);
  const missing = (c: BasicCheck): boolean => c.kind !== 'noTag' && !named.some((v) => variantHelps(cat, v, c));
  const out: string[] = [];
  for (const c of checks) {
    if (c.kind === 'anyOf') {
      const recipes = c.options.filter((option) => option.every((b) => b.kind === 'tag' && b.tag.startsWith('variant:')));
      if (recipes.length) {
        // When a facet accepts alternate named builds, each phrase can teach one complete build.
        if (!recipes.some((option) => option.every((b) => !missing(b)))) out.push('names no complete build');
        continue;
      }
      c.options.forEach((option, i) => {
        for (const b of option) if (missing(b)) out.push(`names no part for option ${i + 1} (${describeCheck(b)})`);
      });
    } else if (missing(c)) out.push(`names no part for ${describeCheck(c)}`);
  }
  return out;
}

export interface ValidateOptions {
  /**
   * Check the kid-facing wording too (titles, part names, row lengths, duplicates, hard words). Default true;
   * synthetic test fixtures with placeholder text turn it off.
   */
  wording?: boolean;
}

export function validateCatalog(cat: WorkshopCatalog, opts: ValidateOptions = {}): string[] {
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
    allTags.add(partTag(v.id));
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
  const checkRefs = (where: string, checks: readonly Check[]): void => {
    for (const c of checks) {
      if (c.kind === 'anyOf') {
        if (c.options.length < 2) err(`${where}: any-of check needs at least 2 options`);
        c.options.forEach((option, i) => {
          const optionLabel = `${where} option ${i + 1}`;
          if (!option.length) err(`${optionLabel}: no checks`);
          checkRefs(optionLabel, option);
          if (!solvable(cat, option, allVariants)) err(`${optionLabel}: not solvable even with every variant`);
        });
      }
      if ((c.kind === 'statMin' || c.kind === 'statMax') && !ix.statDef.has(c.stat)) err(`${where}: unknown stat "${c.stat}"`);
      if ((c.kind === 'tag' || c.kind === 'noTag') && !allTags.has(c.tag)) err(`${where}: no variant has tag "${c.tag}"`);
    }
  };
  const sentences = (where: string, rec: Readonly<Record<string, readonly string[] | undefined>>, guideline = false): void => {
    for (const r of READING_LEVELS) {
      const arr = rec?.[r];
      if (!arr || arr.length < 2) err(`${where} [${r}]: needs >= 2 sentences`);
      else if (arr.some((s) => !s || !s.trim())) err(`${where} [${r}]: empty sentence`);
      if (guideline) for (const line of arr ?? []) {
        const limit = GUIDELINE_WORD_LIMIT[r];
        if (line.trim().split(/\s+/).length > limit) err(`${where} [${r}]: guideline exceeds ${limit} words: "${line}"`);
      }
    }
  };
  for (const sc of cat.scenarios) {
    const sp = ix.scenarioPhrases.get(sc.id);
    if (!sp) err(`scenario ${sc.id}: no scenarioPhrases`);
    else {
      if (sp.title.length < 1) err(`scenario ${sc.id}: no title`);
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
        ph.requirement.forEach((row, i) => sentences(`facet ${f.id} requirement[${i}]`, row, true));
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

  if (opts.wording ?? true) wording(cat, err);

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

/** Kid-facing wording rules: see docs/WORKSHOP.md "Content guide". */
function wording(cat: WorkshopCatalog, err: (m: string) => void): void {
  const ix = index(cat);
  const seenLines = new Map<string, string>();
  const seenTitles = new Map<string, string>();
  const hard = (where: string, text: string): void => {
    const low = ` ${text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ')} `;
    for (const w of HARD_WORDS) if (low.includes(` ${w} `)) err(`${where}: hard word "${w}": "${text}"`);
    if (PLACEHOLDER.test(text)) err(`${where}: leftover placeholder: "${text}"`);
    if (/\s{2,}/.test(text) || text !== text.trim()) err(`${where}: extra spaces: "${text}"`);
  };
  const title = (where: string, t: string): void => {
    hard(where, t);
    if (!/^[A-Z0-9][A-Za-z0-9 ',&!-]*$/.test(t)) err(`${where}: title must be capitalised words with no period: "${t}"`);
    if (wordCount(t) > TITLE_WORD_LIMIT) err(`${where}: title over ${TITLE_WORD_LIMIT} words: "${t}"`);
    const prev = seenTitles.get(t.toLowerCase());
    if (prev) err(`${where}: duplicate title "${t}" (also ${prev})`);
    else seenTitles.set(t.toLowerCase(), where);
  };
  for (const sc of cat.scenarios) {
    const sp = ix.scenarioPhrases.get(sc.id);
    if (sp) {
      if (sp.title.length !== 1) err(`scenario ${sc.id}: needs exactly 1 title (the stage title for 2+ requirements), has ${sp.title.length}`);
      sp.title.forEach((t) => title(`scenario ${sc.id} title`, t));
    }
    for (const f of sc.facets) {
      const ph = ix.facetPhrases.get(f.id);
      if (!ph) continue;
      if (!ph.title || ph.title.length !== f.levels.length) {
        err(`facet ${f.id}: needs one title per level (${f.levels.length}), has ${ph.title?.length ?? 0}`);
      }
      (ph.title ?? []).forEach((t, i) => title(`facet ${f.id} level ${f.levels[i] ?? i + 1} title`, t));
      ph.requirement.forEach((row, i) => facetRow(cat, f, i, row, err, seenLines, hard));
    }
  }
}

function facetRow(cat: WorkshopCatalog, f: FacetDef, i: number, row: Readonly<Record<ReadingLevel, readonly string[]>>,
  err: (m: string) => void, seen: Map<string, string>, hard: (where: string, text: string) => void): void {
  const lv = f.levels[Math.min(i, f.levels.length - 1)];
  const where = `facet ${f.id} level ${lv}`;
  const n = row.easy?.length ?? 0;
  if (READING_LEVELS.some((r) => (row[r]?.length ?? 0) !== n)) err(`${where}: Easy, Medium and Hard need the same number of rows`);
  const checks = f.check(lv);
  for (let k = 0; k < n; k++) {
    const counts = READING_LEVELS.map((r) => (row[r]?.[k] !== undefined ? wordCount(row[r][k]) : 0));
    if (counts[0] > counts[1] || counts[1] > counts[2]) {
      err(`${where} row ${k + 1}: words must go Easy <= Medium <= Hard (${counts.join(' / ')})`);
    }
  }
  for (const r of READING_LEVELS) (row[r] ?? []).forEach((line, k) => {
    const at = `${where} [${r}] row ${k + 1}`;
    hard(at, line);
    if (!/^[A-Z0-9].*[.!?]$/.test(line)) err(`${at}: start with a capital and end with . ! or ?: "${line}"`);
    for (const p of lineProblems(cat, checks, line)) err(`${at}: ${p}: "${line}"`);
    const prev = seen.get(line.toLowerCase());
    if (prev) err(`${at}: duplicate line (also ${prev}): "${line}"`);
    else seen.set(line.toLowerCase(), at);
  });
}
