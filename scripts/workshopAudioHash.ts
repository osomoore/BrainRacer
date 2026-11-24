/** Hash of the files that define the Adventure Workshop sounds (so the shipped public/audio/workshop can be checked for staleness). */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = ['apps/workshop/audio/manifest.ts', 'apps/workshop/dev/AudioRenderWorkshop.ts', 'scripts/renderWorkshopAudio.ts'];
const DIRS = ['apps/workshop/audio/synth'];

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (!/\.test\.ts$/.test(name)) out.push(p);
  }
}

const posixRel = (f: string): string => relative(root, f).replace(/\\/g, '/');

/** sha256 over (posix relative path, content) of every source; CRLF normalised to LF. */
export function workshopAudioSourceHash(): string {
  const files = FILES.map((f) => join(root, f));
  for (const d of DIRS) walk(join(root, d), files);
  files.sort((a, b) => (posixRel(a) < posixRel(b) ? -1 : 1));
  const h = createHash('sha256');
  for (const f of files) {
    const data = Buffer.from(readFileSync(f).toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    h.update(`${posixRel(f)}\0${data.length}\0`).update(data).update('\0');
  }
  return h.digest('hex').slice(0, 16);
}
