import { expect, test } from '@playwright/test';

const tile = (page: import('@playwright/test').Page, id: string) => page.locator(`.tile[data-game="${id}"]`);

test('launcher shows both games and opens them with the keyboard', async ({ page }) => {
  await page.goto('/');
  await expect(tile(page, 'racer')).toBeVisible();
  await expect(tile(page, 'workshop')).toBeVisible();
  await expect(tile(page, 'racer')).toHaveClass(/sel/);

  await page.keyboard.press('ArrowRight');
  await expect(tile(page, 'workshop')).toHaveClass(/sel/);
  await page.keyboard.press('Enter');
  await page.waitForURL(/workshop\.html/);
  await page.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });

  await page.keyboard.press('Escape');
  await page.waitForURL((u) => !/workshop\.html/.test(u.pathname));
  await expect(tile(page, 'workshop')).toHaveClass(/sel/);

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.waitForURL(/racer\.html/);
});

test('backspace on the racer title returns to the launcher', async ({ page }) => {
  await page.goto('/racer.html');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Title'), null, { timeout: 30_000 });
  await page.keyboard.press('Backspace');
  await expect(tile(page, 'racer')).toBeVisible({ timeout: 10_000 });
});

test('query strings on the root forward to Brain Racer', async ({ page }) => {
  await page.goto('/?race=1');
  await page.waitForURL(/racer\.html\?race=1/);
});
