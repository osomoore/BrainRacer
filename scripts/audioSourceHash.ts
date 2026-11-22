/** Hash of the files that define the sounds (so the shipped public/audio can be checked for staleness). */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'scripts/renderAudio.ts', 'src/audio/musicLoudness.ts',
  'src/audio/sfx.ts', 'src/audio/musicPlayer.ts', 'src/audio/engineSound.ts',
  'src/audio/bufferUtils.ts', 'src/audio/musicTheory.ts',
];
const DIRS = ['src/audio/music'];
const TEXT = /\.(ts|json|txt|md)$/i;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
}

const posixRel = (f: string): string => relative(root, f).replace(/\\/g, '/');

/** sha256 over (posix relative path, content) of every source; text files have CRLF normalised to LF. */
export function audioSourceHash(): string {
  const files = FILES.map((f) => join(root, f));
  for (const d of DIRS) walk(join(root, d), files);
  files.sort((a, b) => (posixRel(a) < posixRel(b) ? -1 : 1));
  const h = createHash('sha256');
  for (const f of files) {
    let data = readFileSync(f);
    if (TEXT.test(f)) data = Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    h.update(`${posixRel(f)}\0${data.length}\0`).update(data).update('\0');
  }
  return h.digest('hex').slice(0, 16);
}
