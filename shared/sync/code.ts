import { FAMILY_WORDS } from './words';

const dictionary = new Set(FAMILY_WORDS);

/** The family code is the bearer credential. Keep normalization consistent across entry paths. */
export function normalizeFamilyCode(input: string): string | null {
  const code = input.trim();
  if (!/^[A-Za-z]{3,8}(?:[\s-]+[A-Za-z]{3,8}){3}$/.test(code)) return null;
  const words = code.toUpperCase().split(/[\s-]+/);
  return words.every(word => dictionary.has(word)) ? words.join('-') : null;
}
