/** Pure logic for the on-screen name letter grid (no Phaser). The Phaser view is LetterGridView.ts. */
import { PROFILE_NAME } from '../../../shared/profiles';

export type LetterKeyKind = 'letter' | 'space' | 'delete' | 'done';
export interface LetterKeyDef { kind: LetterKeyKind; label: string; row: number; col: number; span: number }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Letter rows of `cols` keys, then a last row: Space, Delete, Done (the columns split in thirds). */
export function buildLetterKeys(cols: number): LetterKeyDef[] {
  const keys: LetterKeyDef[] = [];
  let row = 0;
  for (let i = 0; i < LETTERS.length; i += cols, row++) {
    [...LETTERS.slice(i, i + cols)].forEach((ch, c) => keys.push({ kind: 'letter', label: ch, row, col: c, span: 1 }));
  }
  const third = Math.max(1, Math.floor(cols / 3));
  keys.push({ kind: 'space', label: 'SPACE', row, col: 0, span: third });
  keys.push({ kind: 'delete', label: 'DELETE', row, col: third, span: third });
  keys.push({ kind: 'done', label: 'DONE', row, col: third * 2, span: cols - third * 2 });
  return keys;
}

/** Adds a character: no leading / double spaces, only letters or space, capped at `maxLen`. */
export function appendName(value: string, ch: string, maxLen: number = PROFILE_NAME.maxLen): string {
  if (value.length >= maxLen) return value;
  if (ch === ' ') return value.length === 0 || value.endsWith(' ') ? value : value + ' ';
  if (!/^\p{L}$/u.test(ch)) return value;
  return value + ch;
}

export function deleteName(value: string): string { return value.slice(0, -1); }

/** "zoe" / "ZOE" / "mary ann" -> "Zoe" / "Zoe" / "Mary Ann" (kids read capitalised names best). */
export function titleCaseName(value: string): string {
  return value.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_m, sp: string, ch: string) => sp + ch.toUpperCase());
}

export type NameCheck = { ok: true; name: string } | { ok: false; reason: 'empty' | 'taken' };

/** Validates a finished name against the existing profiles (case-insensitive duplicates are refused). */
export function checkName(value: string, existing: readonly string[]): NameCheck {
  const name = titleCaseName(value.replace(/\s+/g, ' ').trim());
  if (!name || !PROFILE_NAME.chars.test(name)) return { ok: false, reason: 'empty' };
  const lower = name.toLowerCase();
  if (existing.some((e) => e.trim().toLowerCase() === lower)) return { ok: false, reason: 'taken' };
  return { ok: true, name };
}

export const NAME_MESSAGES = { empty: 'Type your name first!', taken: 'Someone already has that name.' } as const;
