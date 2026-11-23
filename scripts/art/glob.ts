/** Tiny glob for `--only`: `*` = anything, `?` = one char, comma separates alternatives. Matches the texture key. */
const SPECIAL = '.+^$(){}|[]' + String.fromCharCode(92);

export function globMatcher(spec: string | undefined): (key: string) => boolean {
  if (!spec) return () => true;
  const res = spec.split(',').map((p) => {
    let re = '';
    for (const ch of p.trim()) re += ch === '*' ? '.*' : ch === '?' ? '.' : SPECIAL.includes(ch) ? String.fromCharCode(92) + ch : ch;
    return new RegExp(`^${re}$`);
  });
  return (key) => res.some((r) => r.test(key));
}
