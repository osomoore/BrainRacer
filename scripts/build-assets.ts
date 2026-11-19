/**
 * Builds runtime scene data from images/scenes/manifest.csv (the ONLY source of labels;
 * the per-image scene_###.txt files are intentionally ignored) and copies the PNGs to
 * public/scenes/ so Vite serves them.
 *
 * Output: src/data/scenes.json (committed) — SceneEntry[] (see src/core/types.ts).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseManifest } from './manifest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'images', 'scenes');
const outDir = join(root, 'public', 'scenes');
const csv = readFileSync(join(srcDir, 'manifest.csv'), 'utf8');
const entries = parseManifest(csv);

mkdirSync(outDir, { recursive: true });
for (const e of entries) {
  const from = join(srcDir, `${e.id}.png`);
  if (!existsSync(from)) throw new Error(`Missing image for ${e.id}`);
  copyFileSync(from, join(outDir, `${e.id}.png`));
}
writeFileSync(join(root, 'src', 'data', 'scenes.json'), JSON.stringify(entries, null, 1) + '\n');
console.log(`scenes: ${entries.length} entries, ${new Set(entries.map((e) => e.word)).size} unique words`);
