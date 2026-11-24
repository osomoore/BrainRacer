/**
 * `npm run art:shapes [-- --only <glob>] [--limit N]`: bakes every shape texture from the CODE drawing in headless Edge
 * (apps/workshop/dev/ArtExport.ts) and writes art-src/<file>.png plus art-src/jobs.json (all jobs, shape hashes,
 * source hash) for scripts/art/paint.py. art-src/ is gitignored. Needs Microsoft Edge (Playwright channel 'msedge').
 */
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import type { ArtExportApi } from '../../apps/workshop/dev/ArtExport';
import { globMatcher } from './glob';
import { artSourceHash } from './sourceHash';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'art-src');
const PORT = Number(process.env.ART_PORT ?? 5195);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface PatternExport { key: string; file: string; patternSeed: number }

export async function exportShapes(only?: string, limit?: number, patterns?: PatternExport[]): Promise<number> {
  const t0 = Date.now();
  const match = globMatcher(only);
  mkdirSync(outDir, { recursive: true });
  const vite = await createServer({ root, logLevel: 'silent', server: { port: PORT, strictPort: true, watch: null, hmr: false } });
  await vite.listen();
  try {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[page error]', e.message));
      await page.goto(`http://localhost:${PORT}/workshop.html?dev=ArtExport&art=shapes`);
      await page.waitForFunction(() => '__artExport' in window, null, { timeout: 90000 });
      const png = async (key: string) => Buffer.from(await page.evaluate(
        (k) => (window as unknown as { __artExport: ArtExportApi }).__artExport.png(k), key,
      ), 'base64');
      if (patterns) {
        for (const { key, file, patternSeed } of patterns) {
          writeFileSync(join(outDir, `${file}.${patternSeed}.png`), await png(`${key}:pattern=${patternSeed}`));
        }
        console.log(`art:shapes: ${patterns.length} candidate pattern PNGs in art-src/`);
        return patterns.length;
      }
      const jobs = await page.evaluate(() => (window as unknown as { __artExport: ArtExportApi }).__artExport.jobs());
      const hashes: Record<string, string> = {};
      let n = 0;
      for (const j of jobs) {
        if (j.kind !== 'shape' || !match(j.key)) continue;
        if (limit && n >= limit) break;
        const buf = await png(j.key);
        writeFileSync(join(outDir, `${j.file}.png`), buf);
        hashes[j.key] = createHash('sha1').update(buf).digest('hex').slice(0, 16);
        n++;
      }
      writeFileSync(join(outDir, 'jobs.json'), JSON.stringify({ srcHash: artSourceHash(), shapeHashes: hashes, jobs }, null, 1) + '\n');
      console.log(`art:shapes: ${n} shape PNGs + jobs.json (${jobs.length} jobs) in art-src/, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      return n;
    } finally {
      await browser.close();
    }
  } finally {
    await vite.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = arg('pattern-plan');
  exportShapes(arg('only'), arg('limit') ? Number(arg('limit')) : undefined,
    plan ? JSON.parse(readFileSync(plan, 'utf8')) : undefined).catch((e) => { console.error(e); process.exit(1); });
}
