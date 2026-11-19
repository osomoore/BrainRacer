import { expect, test } from '@playwright/test';

test('quick race runs: countdown, driving, challenges, no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?race=2&seed=3');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Race'), null, { timeout: 30_000 });
  // countdown (3 s) then race starts
  await page.waitForFunction(() => ((window as any).__race?.elapsedSec ?? 0) > 0.5, null, { timeout: 15_000 });
  const start = await page.evaluate(() => { const p = (window as any).__race.players[0]; return { x: p.x, y: p.y }; });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyW');
  const moved = await page.evaluate(([sx, sy]) => { const p = (window as any).__race.players[0]; return Math.hypot(p.x - sx, p.y - sy); }, [start.x, start.y]);
  expect(moved).toBeGreaterThan(100);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'test-results/race.png' });
  expect(errors).toEqual([]);
});

test('short round ends and reaches the results screen', async ({ page }) => {
  const errors: string[] = [];
  const warns: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning' && m.text().includes('[race teardown]')) warns.push(m.text());
  });
  await page.goto('/?race=2&seed=5&round=12');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Results'), null, { timeout: 60_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/results.png' });
  expect(errors).toEqual([]);
  expect(warns).toEqual([]);
});
