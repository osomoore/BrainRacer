import { expect, test } from '@playwright/test';
import { installGamepadMock } from './gamepadMock';

test('boots to title without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await installGamepadMock(page);
  await page.goto('/');
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    return g && g.scene.isActive('Title');
  }, null, { timeout: 30_000 });
  await page.screenshot({ path: 'test-results/title.png' });
  expect(errors).toEqual([]);
});
