import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1600, height: 900 }, channel: 'msedge' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    env: { VITE_ALLOW_QUESTIONS_OFF: '1' }, // tests use ?questions=off and the menu Off option
    timeout: 180_000,
  },
});
