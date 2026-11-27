import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const page = (f: string) => fileURLToPath(new URL(f, import.meta.url));

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

export default defineConfig(async ({ command }) => ({
  base: './',
  plugins: command === 'build' ? [
    (await import('vite-plugin-pwa')).VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false,
      workbox: {
        cacheId: 'brainracer', // Also used by sw-navigation.js to find the scoped precache.
        globPatterns: ['**/*'],
        globIgnores: ['**/*.map'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: null,
        importScripts: ['./sw-navigation.js'],
        inlineWorkboxRuntime: true,
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ] : [],
  cacheDir: '.vite-cache',
  // Ignore only this checkout's nested .worktrees: a glob would also match the root of a server started inside a worktree.
  server: {
    port: 5173,
    watch: { ignored: [page('./.worktrees/').replace(/\\/g, '/') + '**'] },
    headers: { 'Cache-Control': 'no-store' },
  },
  build: {
    chunkSizeWarningLimit: 4000,
    // Multi-page site: launcher + one page per game (all at the root, relative paths).
    rolldownOptions: { input: { index: page('index.html'), racer: page('racer.html'), workshop: page('workshop.html'), world: page('world.html') } },
  },
  define: {
    __BUILD_ID__: JSON.stringify(process.env.BRAINRACER_BUILD_ID || gitHash()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts', 'apps/**/*.test.ts', 'scripts/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
  },
}));
