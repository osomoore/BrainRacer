import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });

async function center(page: Page, btn: string) {
  const b = await page.locator(`.bt-b[data-btn="${btn}"]`).boundingBox();
  if (!b) throw new Error(`button ${btn} not visible`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('touch race: hold right to steer, auto gas, pause button', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.goto('/racer.html?race=1&input=touch&seed=3&questions=off');
  await page.waitForFunction(() => (window as any).__race && (window as any).__game.scene.isActive('Race'), null, { timeout: 30_000 });
  // The overlay shows once the touch device exists; wait for the race layout (round countdown first).
  await page.waitForSelector('.bt-b[data-btn="right"].show', { timeout: 30_000 });
  // Auto gas: with no input at all the car gets up to speed.
  await page.waitForFunction(() => Math.abs((window as any).__race.players[0].forwardSpeed) > 100, null, { timeout: 10_000 });
  // Steering: a short hold on ▶ turns the car (short, so it doesn't drive into the roadside).
  const a0 = await page.evaluate(() => (window as any).__race.players[0].angle);
  const p = await center(page, 'right');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
  await page.waitForTimeout(500);
  const a1 = await page.evaluate(() => (window as any).__race.players[0].angle);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(Math.abs(a1 - a0)).toBeGreaterThan(0.05);

  const pz = await center(page, 'pause');
  await page.touchscreen.tap(pz.x, pz.y);
  await page.waitForFunction(() => (window as any).__race.paused === true, null, { timeout: 5_000 });
});

test('portrait phone shows the rotate overlay', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/racer.html');
  await expect(page.locator('#bt-rotate')).toBeVisible();
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.locator('#bt-rotate')).toBeHidden();
});

test('launcher tiles respond to taps', async ({ page }) => {
  await page.goto('/');
  await page.touchscreen.tap(...(await page.locator('.tile[data-game="workshop"]').boundingBox().then((b) => [b!.x + b!.width / 2, b!.y + b!.height / 2] as [number, number])));
  await page.waitForURL(/workshop\.html/);
});
