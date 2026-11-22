import { expect, test } from '@playwright/test';
import { installGamepadMock } from './gamepadMock';

test('boots to title without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await installGamepadMock(page);
  await page.goto('/racer.html');
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    return g && g.scene.isActive('Title');
  }, null, { timeout: 30_000 });
  await page.screenshot({ path: 'test-results/title.png' });
  expect(errors).toEqual([]);
});

test('loads Police Station question art when the standalone PNG is unavailable', async ({ page }) => {
  await page.route('**/scenes/scene_185.png', (route) => route.abort());
  await page.goto('/racer.html');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Title'), null, { timeout: 30_000 });

  const usesImage = await page.evaluate(() => {
    const textures = (window as any).__game.textures;
    return textures.exists('scene_185') && textures.get('scene_185').getSourceImage() instanceof HTMLImageElement;
  });
  expect(usesImage).toBe(true);
});
