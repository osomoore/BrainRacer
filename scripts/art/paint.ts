/**
 * `npm run art:paint [-- --only <glob>] [--force] [--limit N] [--model <ckpt>] [--dry-run] [--prune]`:
 * 1. exports the code shapes that match `--only` to art-src/ (same as `npm run art:shapes`),
 * 2. runs scripts/art/paint.py against ComfyUI (http://127.0.0.1:8188, must be running), which writes
 *    public/art/workshop/<file>.png + manifest.json and skips jobs whose spec and shape did not change.
 * All other arguments go to paint.py (see `python scripts/art/paint.py --help`).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportShapes } from './exportShapes';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);

function value(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(): Promise<void> {
  await exportShapes(value('only'));
  const py = spawnSync(process.env.PYTHON ?? 'python', [join(root, 'scripts', 'art', 'paint.py'), ...args], { stdio: 'inherit', cwd: root });
  process.exit(py.status ?? 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
