import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

/** Short git hash of the build (falls back to 'dev' outside a git checkout). Shown on the title screen. */
function gitHash(): string {
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== '';
    return dirty ? `${hash}+` : hash;
  } catch {
    return 'dev';
  }
}

/** Build time as "2026-11-20 21:45 UTC". */
function buildTime(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

export default defineConfig({
  base: './',
  cacheDir: '.vite-cache',
  server: { port: 5173, watch: { ignored: ['**/.worktrees/**'] } },
  build: { chunkSizeWarningLimit: 4000 },
  define: {
    __BUILD_ID__: JSON.stringify(gitHash()),
    __BUILD_TIME__: JSON.stringify(buildTime()),
  },
  test: {
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts', 'apps/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
