/** Content validator: returns a list of problems (empty = fine). Used by tests and by content authors. */
import { STARTER_PRACTICE_TITLES } from '../content/practiceTitles';
import { starterWordProblems } from '../content/starterWords';
import { READING_LEVELS } from '../core/types';
import type { BasicCheck, Check, FacetDef, LeveledPhrases, ReadingLevel, Variant, WorkshopCatalog } from '../core/types';
import { index } from './catalogIndex';
import { solve, solvable } from './solver';
import { allPass, computeModel, defaultModel, partTag } from './stats';
import { starterChallenge } from './starters';
import { flatChecks } from './util';
import { lineFixes, namedVariants, variantHelps } from './namedFixes';
import { WS_RULES } from '../config';
import { catalogFixes } from './text';
import { namedReason } from './successReasons';
import { FAIL_WORD_LIMIT, PHRASE_WORD_LIMIT, STORY_WORD_LIMIT, wordCount } from './wording';
import { fillParts, practiceStory } from './failHints';

export { namedVariants, variantHelps } from './namedFixes';

const MIN_TIER0_STARTER_ONLY_FACETS = 3;
const TITLE_WORD_LIMIT = 4;
const STARTER_GUIDELINE_WORD_LIMIT = 6;
const LATER_LEVELS = ['easy', 'medium', 'hard'] as const;

function starterWords(cat: WorkshopCatalog, where: string, line: string, err: (m: string) => void): void {
  for (const word of starterWordProblems(cat, line)) err(`${where}: Starter word "${word}" is not decodable: "${line}"`);
}

function starterSentence(cat: WorkshopCatalog, where: string, line: string, err: (m: string) => void): void {
  starterWords(cat, where, line, err);
  for (const sentence of line.match(/[^.!?]+/g) ?? []) {
    if (wordCount(sentence) < 2) err(`${where}: Starter sentences need at least 2 words: "${line}"`);
  }
}

function outOfOrder(counts: readonly number[]): boolean {
  return counts.some((count, i) => i > 0 && count < counts[i - 1]);
}
/** Words beginning readers stumble on (found in the 2026 text review), plus idioms. Part names are allowed. */
export const HARD_WORDS: readonly string[] = [
  'canyon', 'dune', 'dunes', 'flock', 'shoo', 'shove', 'slippery', 'twisty', 'zigzag', 'pebble', 'pebbles', 'gooey',
  'coconut', 'freezing', 'sneaky', 'cruncher', 'turner', 'ledge', 'pesky', 'heave', 'sag', 'snowstorm', 'traction',
  'terrain', 'obstacle', 'clearance', 'navigate', 'accelerate', 'conceal', 'durable', 'get a grip', 'is a wall',
];
const PLACEHOLDER = /[{}<>[\]_|\\]|\b(?:TODO|TBD|XXX|FIXME)\b|\.\.\./;

export { wordCount } from './wording';
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
      if (guideline && r !== 'starter') for (const line of arr ?? []) {
        const limit = PHRASE_WORD_LIMIT[r];
        if (wordCount(line) > limit) err(`${where} [${r}]: guideline exceeds ${limit} words: "${line}"`);
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
  const starterTitle = (where: string, t: string): void => {
    if (!/^[A-Z][A-Za-z &'!-]*$/.test(t) || wordCount(t) > TITLE_WORD_LIMIT) err(`${where}: invalid Starter title "${t}"`);
    starterWords(cat, where, t, err);
  };
  const completeSentence = (where: string, reading: ReadingLevel, phrase: string): void => {
    if (reading === 'starter') starterSentence(cat, where, phrase, err);
    else hard(where, phrase);
    if (!/^[A-Z0-9].*[.!?]$/.test(phrase)) err(`${where}: needs a complete sentence: "${phrase}"`);
    const limit = PHRASE_WORD_LIMIT[reading];
    if (wordCount(phrase) > limit) err(`${where}: exceeds ${limit} words: "${phrase}"`);
  };
  const successRows = (where: string, bank: LeveledPhrases, render = (line: string, _reading: ReadingLevel) => line): void => {
    const rows = READING_LEVELS.map((reading) => {
      const phrases = (bank?.[reading] ?? []).map((line) => render(line, reading));
      const at = `${where} [${reading}]`;
      if (new Set(phrases).size < 2) err(`${at}: needs at least 2 distinct sentences`);
      phrases.forEach((phrase) => completeSentence(at, reading, phrase));
      return phrases;
    });
    if (rows.some((row) => row.length !== rows[0].length)) err(`${where}: all reading levels need the same number of rows`);
    const [, easyRows, mediumRows, hardRows] = rows;
    easyRows.forEach((easy, i) => {
      const medium = mediumRows[i];
      const hard = hardRows[i];
      if (medium && hard && (wordCount(easy) > wordCount(medium) || wordCount(medium) > wordCount(hard))) {
        err(`${where} row ${i + 1}: words must go Easy <= Medium <= Hard`);
      }
    });
  };
  for (const id of Object.keys(cat.successPhrases ?? {})) {
    if (!ix.facetById.has(id)) err(`success phrases: unknown facet "${id}"`);
  }
  for (const [id, name] of Object.entries(cat.successPartNames ?? {})) {
    if (!ix.variantById.has(id)) err(`success part name: unknown variant "${id}"`);
    if (!name.trim()) err(`success part name: empty name for "${id}"`);
  }
  for (const sc of cat.scenarios) {
    const sp = ix.scenarioPhrases.get(sc.id);
    if (sp) {
      if (sp.title.length !== 1) err(`scenario ${sc.id}: needs exactly 1 title (the stage title for 2+ requirements), has ${sp.title.length}`);
      sp.title.forEach((t) => title(`scenario ${sc.id} title`, t));
      if (sp.starterTitle?.length !== 1) err(`scenario ${sc.id}: needs one Starter title`);
      for (const t of sp.starterTitle ?? []) starterTitle(`scenario ${sc.id} title`, t);
      if (!sp.intro.starter || sp.intro.starter.length !== sp.intro.easy.length) err(`scenario ${sc.id}: needs matching Starter intro rows`);
      for (const line of sp.intro.starter ?? []) completeSentence(`scenario ${sc.id} intro [starter]`, 'starter', line);
    }
    for (const f of sc.facets) {
      const success = cat.successPhrases?.[f.id];
      if (!success) err(`facet ${f.id}: no success phrases`);
      else {
        // Validate the baseline bank even when a facet has a level-specific override.
        successRows(`facet ${f.id} success baseline`, success.quality);
        for (const key of Object.keys(success.qualityByLevel ?? {})) {
          if (!f.levels.includes(Number(key))) err(`facet ${f.id}: success phrases for unknown level ${key}`);
        }
        for (const level of f.levels) {
          const at = `facet ${f.id} level ${level} success`;
          const quality = success.qualityByLevel?.[level];
          if (quality) successRows(`${at} quality`, quality);
          for (const fix of catalogFixes(cat, f, level)) {
            successRows(`${at} named (${fix.join(', ')})`, success.named, (line, reading) => namedReason(cat, fix, line, reading));
          }
        }
      }
      const ph = ix.facetPhrases.get(f.id);
      if (!ph) continue;
      if (!ph.title || ph.title.length !== f.levels.length) {
        err(`facet ${f.id}: needs one title per level (${f.levels.length}), has ${ph.title?.length ?? 0}`);
      }
      (ph.title ?? []).forEach((t, i) => title(`facet ${f.id} level ${f.levels[i] ?? i + 1} title`, t));
      if (ph.starterTitle?.length !== f.levels.length) err(`facet ${f.id}: needs one Starter title per level`);
      for (const t of ph.starterTitle ?? []) starterTitle(`facet ${f.id} title`, t);
      for (const line of ph.hint.starter ?? []) completeSentence(`facet ${f.id} hint [starter]`, 'starter', line);
      ph.requirement.forEach((row, i) => facetRow(cat, f, i, row, err, seenLines, hard));
    }
  }
  for (const a of cat.aspects) {
    const t = STARTER_PRACTICE_TITLES[cat.id][a.id];
    if (t) starterTitle(`practice title ${a.id}`, t);
    else err(`practice ${a.id}: needs a Starter title`);
  }
  stories(cat, err, hard);
  for (const r of READING_LEVELS) {
    const where = `clever win [${r}]`;
    const phrases = cat.cleverWinPhrases?.[r] ?? [];
    if (new Set(phrases).size < 2) err(`${where}: needs at least 2 distinct sentences`);
    for (const phrase of phrases) completeSentence(where, r, phrase);
  }
}

function facetRow(cat: WorkshopCatalog, f: FacetDef, i: number, row: Readonly<Record<ReadingLevel, readonly string[]>>,
  err: (m: string) => void, seen: Map<string, string>, hard: (where: string, text: string) => void): void {
  const lv = f.levels[Math.min(i, f.levels.length - 1)];
  const where = `facet ${f.id} level ${lv}`;
  const n = row.easy?.length ?? 0;
  if (READING_LEVELS.some((r) => (row[r]?.length ?? 0) !== n)) err(`${where}: all reading levels need the same number of rows`);
  const checks = f.check(lv);
  for (let k = 0; k < n; k++) {
    const counts = LATER_LEVELS.map((r) => (row[r]?.[k] !== undefined ? wordCount(row[r][k]) : 0));
    if (outOfOrder(counts)) {
      err(`${where} row ${k + 1}: words must go Easy <= Medium <= Hard (${counts.join(' / ')})`);
    }
  }
  for (const r of READING_LEVELS) (row[r] ?? []).forEach((line, k) => {
    const at = `${where} [${r}] row ${k + 1}`;
    if (r === 'starter') {
      starterSentence(cat, at, line, err);
      const sentences = line.match(/[^.!?]+/g) ?? [];
      if (sentences.some((sentence) => wordCount(sentence) > STARTER_GUIDELINE_WORD_LIMIT)) {
        err(`${at}: guideline sentence exceeds ${STARTER_GUIDELINE_WORD_LIMIT} words: "${line}"`);
      }
    } else hard(at, line);
    if (!/^[A-Z0-9].*[.!?]$/.test(line)) err(`${at}: start with a capital and end with . ! or ?: "${line}"`);
    for (const p of lineProblems(cat, checks, line)) err(`${at}: ${p}: "${line}"`);
    if (!lineFixes(cat, checks, line).length) err(at + ': names no complete build: ' + line);
    // The same short Starter instruction can fit several problems with the same fix.
    if (r === 'starter') {
      if (row[r].indexOf(line) !== k) err(`${at}: duplicate Starter line: "${line}"`);
      return;
    }
    const prev = seen.get(line.toLowerCase());
    if (prev) err(`${at}: duplicate line (also ${prev}): "${line}"`);
    else seen.set(line.toLowerCase(), at);
  });
}

/**
 * Story lines (the card text) and failure templates. Stories: complete sentences within STORY_WORD_LIMIT, Easy <=
 * Medium <= Hard in each row, no duplicates. Failure lines are checked after every listed fix of every level is
 * filled in: within FAIL_WORD_LIMIT and naming a part of that fix. Practice stories and failure lines likewise, for
 * every part of every station.
 */
function stories(cat: WorkshopCatalog, err: (m: string) => void, hard: (where: string, text: string) => void): void {
  const seen = new Map<string, string>();
  const sentence = (where: string, line: string, limit: number): void => {
    if (where.endsWith('[starter]')) starterSentence(cat, where, line, err);
    else hard(where, line);
    if (!/^[A-Z0-9].*[.!?]$/.test(line)) err(`${where}: needs a complete sentence: "${line}"`);
    if (wordCount(line) > limit) err(`${where}: exceeds ${limit} words: "${line}"`);
  };
  const unique = (where: string, line: string): void => {
    const prev = seen.get(line.toLowerCase());
    if (prev) err(`${where}: duplicate line (also ${prev}): "${line}"`);
    else seen.set(line.toLowerCase(), where);
  };
  const ordered = (where: string, bank: LeveledPhrases, count = wordCount): void => {
    const n = bank.easy?.length ?? 0;
    if (READING_LEVELS.some((r) => (bank[r]?.length ?? 0) !== n)) err(`${where}: all reading levels need the same number of rows`);
    for (let k = 0; k < n; k++) {
      const c = LATER_LEVELS.map((r) => (bank[r]?.[k] !== undefined ? count(bank[r][k]) : 0));
      if (outOfOrder(c)) err(`${where} row ${k + 1}: words must go Easy <= Medium <= Hard (${c.join(' / ')})`);
    }
  };
  const templates = (where: string, bank: LeveledPhrases | undefined, token: string): boolean => {
    if (!bank || READING_LEVELS.some((r) => !bank[r]?.length)) { err(`${where}: needs a line per reading level`); return false; }
    ordered(where, bank, (t) => wordCount(t.replace(token, '')));
    for (const r of READING_LEVELS) for (const t of bank[r]) {
      if (t.split(token).length !== 2) err(`${where} [${r}]: needs exactly one ${token}: "${t}"`);
      if (r === 'starter') starterSentence(cat, `${where} [${r}]`, t, err);
      else unique(`${where} [${r}]`, t);
    }
    return true;
  };
  const namesOne = (where: string, line: string, parts: readonly string[]): void => {
    if (![...namedVariants(cat, line)].some((id) => parts.includes(id))) err(`${where}: names no part of the fix: "${line}"`);
  };

  for (const sc of cat.scenarios) for (const f of sc.facets) {
    const st = cat.stories?.[f.id];
    if (!st) { err(`facet ${f.id}: no story`); continue; }
    if (st.story.length !== f.levels.length) err(`facet ${f.id}: needs one story row per level (${f.levels.length}), has ${st.story.length}`);
    st.story.forEach((row, i) => {
      const at = `facet ${f.id} level ${f.levels[i] ?? i + 1} story`;
      ordered(at, row);
      if (!row.starter?.length) err(`${at}: needs a Starter story line`);
      for (const r of READING_LEVELS) for (const line of row[r] ?? []) {
        sentence(`${at} [${r}]`, line, STORY_WORD_LIMIT[r]);
        if (r !== 'starter') unique(`${at} [${r}]`, line);
      }
    });
    if (!templates(`facet ${f.id} fail`, st.fail, '{parts}')) continue;
    for (const level of f.levels) for (const fix of catalogFixes(cat, f, level)) for (const r of READING_LEVELS) {
      for (const t of st.fail[r]) {
        const at = `facet ${f.id} level ${level} fail (${fix.join(', ')}) [${r}]`;
        const line = fillParts(cat, t, fix, r);
        sentence(at, line, FAIL_WORD_LIMIT[r]);
        namesOne(at, line, fix);
      }
    }
  }

  const practiceFail = templates('practice fail', cat.practiceFail, '{parts}');
  const practiceSentences = new Map<string, string>();
  for (const v of cat.variants) {
    const where = `practice story ${v.id}`;
    const bank = cat.practiceStories?.[v.id];
    if (bank) ordered(where, bank);
    for (const r of READING_LEVELS) {
      if (!bank?.[r]?.[0]) err(`${where} [${r}]: needs a line`);
      const line = practiceStory(cat, v.id, r);
      const at = `${where} [${r}]`;
      sentence(at, line, STORY_WORD_LIMIT[r]);
      if (r === 'starter') {
        if (bank?.starter?.[0]?.split('{part}').length !== 2) err(`${at}: needs exactly one {part}`);
        namesOne(at, line, [v.id]);
      } else {
        const previous = practiceSentences.get(line);
        if (previous && previous !== v.id) err(`${at}: same situation as ${previous}: "${line}"`);
        practiceSentences.set(line, v.id);
      }
    }
    if (practiceFail) for (const r of READING_LEVELS) for (const t of cat.practiceFail![r]) {
      const at = `practice fail ${v.id} [${r}]`;
      const line = fillParts(cat, t, [v.id], r);
      sentence(at, line, FAIL_WORD_LIMIT[r]);
      namesOne(at, line, [v.id]);
    }
  }
}
