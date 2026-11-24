import { PROFILE_NAME } from '../../../shared/profiles';
import { nameTaken } from '../../../shared/ui/menu/newRacerLogic';

/** "zoe" / "ZOE" / "mary ann" -> "Zoe" / "Zoe" / "Mary Ann" (kids read capitalised names best). */
export function titleCaseName(value: string): string {
  return value.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_m, sp: string, ch: string) => sp + ch.toUpperCase());
}

export type NameCheck = { ok: true; name: string } | { ok: false; reason: 'empty' | 'taken' };

/** Validates a finished name against the existing profiles (case-insensitive duplicates are refused). */
export function checkName(value: string, existing: readonly string[]): NameCheck {
  const name = titleCaseName(value.replace(/\s+/g, ' ').trim());
  if (!name || !PROFILE_NAME.chars.test(name)) return { ok: false, reason: 'empty' };
  if (nameTaken(name, existing)) return { ok: false, reason: 'taken' };
  return { ok: true, name };
}

export const NAME_MESSAGES = { empty: 'Type your name first!', taken: 'Someone already has that name.' } as const;
