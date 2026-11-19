// Windows: a lower-case drive letter in cwd (e.g. VS Code's "c:\...") makes vitest load two module
// instances ("Cannot read properties of undefined (reading 'config')"). Normalize and re-run.
import { spawnSync } from 'node:child_process';
const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const r = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)], { cwd, stdio: 'inherit' });
process.exit(r.status ?? 1);
