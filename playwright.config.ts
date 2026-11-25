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
    env: { VITE_ALLOW_QUESTIONS_OFF: '1', VITE_QA_QUICK_MAPS: '1', VITE_SYNC_TEST_FAKE: '1' },
    timeout: 180_000,
  },
});
