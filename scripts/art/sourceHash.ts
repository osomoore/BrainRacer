/** Hash of the files that draw the shape textures (so a painted PNG can be flagged when its shape code changed). */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['apps/workshop/art/bake.ts', 'apps/workshop/art/geom.ts'];
const DIRS = ['apps/workshop/art/race', 'apps/workshop/art/dino'];

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'rig.ts') out.push(p);
  }
}
const posixRel = (f: string): string => relative(root, f).split('\\').join('/');
const normalize = (s: string): string => s.split('\r\n').join('\n');

export function artSourceHash(): string {
  const files = FILES.map((f) => join(root, f));
  for (const d of DIRS) walk(join(root, d), files);
  files.sort((a, b) => (posixRel(a) < posixRel(b) ? -1 : 1));
  const h = createHash('sha256');
  for (const f of files) h.update(posixRel(f) + '|').update(normalize(readFileSync(f).toString('utf8'))).update('|');
  return h.digest('hex').slice(0, 16);
}
