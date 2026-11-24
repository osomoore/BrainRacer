import type { BasicCheck, Check, Variant, VariantId, WorkshopCatalog } from '../core/types';
import { index } from './catalogIndex';
import { partTag } from './stats';

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

/** Expand a conjunction of checks into complete alternatives for the solver. */
export function checkOptions(checks: readonly Check[]): BasicCheck[][] {
  return checks.reduce<BasicCheck[][]>((options, check) =>
    check.kind === 'anyOf'
      ? options.flatMap((prefix) => check.options.map((option) => [...prefix, ...option]))
      : options.map((option) => [...option, check]), [[]]);
}

/**
 * Read the part choices in an authored guideline. "Or" separates complete builds, including
 * comma lists such as "Standing, Long Neck, or Big size". Without "or", named parts go together.
 * An option must address one full check branch and use at most one part per aspect.
 */
export function lineFixes(cat: WorkshopCatalog, checks: readonly Check[], line: string): VariantId[][] {
  // Parts after "not" are exclusions. "Swap X for Y" also names X only to take it off.
  const positive = line.replace(/\bswap\b[^.!?]*?\bfor\b/gi, '').split(/,?\s+not\s+(?!only\b)/i)[0];
  const choices = /\bor\b/i.test(positive) ? positive.split(/\s*,\s*(?:or\s+)?|\s+or\s+/i) : [positive];
  const branches = checkOptions(checks);
  const ix = index(cat);
  return choices.flatMap((choice) => {
    const variants = [...namedVariants(cat, choice)].flatMap((id) => {
      const part = ix.variantById.get(id);
      return part ? [part] : [];
    });
    return branches.flatMap((branch) => {
      const helps = (part: Variant, check: BasicCheck): boolean => {
        if (variantHelps(cat, part, check)) return true;
        // A named starter can be part of a fix even when changing to it has no effect from the default.
        if (!choice.includes(part.name)) return false;
        if (check.kind === 'statMin') return (part.stats[check.stat] ?? 0) > 0;
        if (check.kind === 'statMax') return (part.stats[check.stat] ?? 0) < 0;
        return false;
      };
      const parts = variants.filter((part) => branch.some((check) => helps(part, check))
        && (choice.includes(part.name) || !variants.some((other) =>
          other.aspect === part.aspect && other.id !== part.id && choice.includes(other.name))));
      if (!parts.length || new Set(parts.map((part) => part.aspect)).size !== parts.length) return [];
      if (branch.some((check) => check.kind === 'noTag'
        ? parts.some((part) => partTag(part.id) === check.tag || part.tags.includes(check.tag))
        : !parts.some((part) => helps(part, check)))) return [];
      return [parts.map((part) => part.id)];
    });
  });
}

/** Canonical options keep challenge keys stable across phrase order and duplicate wording. */
export function distinctFixes(fixes: readonly (readonly VariantId[])[]): VariantId[][] {
  const byKey = new Map(fixes.map((parts) => {
    const sorted = [...new Set(parts)].sort();
    return [JSON.stringify(sorted), sorted] as const;
  }));
  return [...byKey.keys()].sort().map((key) => byKey.get(key)!);
}

export function hybridChecks(checks: Check[], fixes: readonly (readonly VariantId[])[] = []): Check[] {
  if (!fixes.length) return checks;
  return [{ kind: 'anyOf', options: [
    ...checkOptions(checks),
    ...fixes.map((parts) => parts.map((id): BasicCheck => ({ kind: 'tag', tag: partTag(id) }))),
  ] }];
}
