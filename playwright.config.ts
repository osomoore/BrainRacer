import { defineConfig } from '@playwright/test';

const port = Number(process.env.BRAINRACER_E2E_PORT || 4173);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  use: { baseURL, viewport: { width: 1600, height: 900 }, channel: 'msedge' },
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    env: { VITE_ALLOW_QUESTIONS_OFF: '1' }, // tests use ?questions=off
    timeout: 180_000,
  },
});
