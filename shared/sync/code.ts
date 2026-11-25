/** The family code is the bearer credential. Keep normalization consistent across entry paths. */
export function normalizeFamilyCode(input: string): string | null {
  const match = /^([A-Z]+)[\s-]+([A-Z]+)[\s-]+([A-Z]+)[\s-]*(\d{2})$/.exec(input.trim().toUpperCase());
  return match ? match.slice(1).join('-') : null;
}
