import type { Challenge, ReadingLevel, RunResult, VariantId, WorkshopCatalog } from '../core/types';
import { Rng } from '../core/rng';
import { index } from './catalogIndex';
import { PHRASE_WORD_LIMIT, wordCount } from './wording';

/** Use full station names when they fit. Long recipes can use the catalog's short names. */
export function namedReason(cat: WorkshopCatalog, parts: readonly VariantId[], ending: string, reading: ReadingLevel): string {
  const variants = index(cat).variantById;
  const full = parts.map((id) => variants.get(id)?.name ?? id);
  const short = parts.map((id, i) => cat.successPartNames?.[id] ?? full[i]);
  const withAnd = (names: string[]) => names.length <= 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  const lines = [withAnd(full), full.join(', '), withAnd(short), short.join(', ')]
    .map((names) => `${names} ${ending}`);
  return lines.find((line) => wordCount(line) <= PHRASE_WORD_LIMIT[reading]) ?? lines[lines.length - 1];
}

/** Pick up to two reasons for a win. Prefer higher difficulty, breaking ties in challenge order. */
export function successReasons(cat: WorkshopCatalog, challenge: Challenge, result: RunResult, reading: ReadingLevel): string[] {
  if (!result.passed) return [];
  const rng = new Rng(challenge.seed ^ 0x673cb9a1);
  const byId = new Map(result.requirements.map((req) => [req.id, req]));
  const reasons = challenge.stages.flatMap((stage) => stage.requirements.flatMap((req) => {
    const passed = byId.get(req.id);
    const phrases = cat.successPhrases?.[req.facet];
    if (!passed?.passed || !passed.reached || !phrases) return [];
    const parts = passed.route === 'named' ? passed.parts : undefined;
    const bank = parts?.length ? phrases.named : phrases.qualityByLevel?.[req.level] ?? phrases.quality;
    const choices = bank[reading];
    if (!choices?.length) return [];
    const phrase = rng.pick(choices);
    const text = parts?.length ? namedReason(cat, parts, phrase, reading) : phrase;
    return [{ level: req.level, text }];
  }));
  const selected = new Set([...reasons].sort((a, b) => b.level - a.level).slice(0, 2));
  return reasons.filter((reason) => selected.has(reason)).map((reason) => reason.text);
}
