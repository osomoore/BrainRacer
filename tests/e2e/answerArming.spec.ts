import { expect, test } from '@playwright/test';

// Gas keys (W / Arrow Up) held through the start of a question break must not register as an answer.
test('holding gas into a question break does not answer', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?race=2&seed=3');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Race'), null, { timeout: 30_000 });
  await page.waitForFunction(() => ((window as any).__race?.elapsedSec ?? 0) > 0.5, null, { timeout: 15_000 });
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => (window as any).__race.questionBreak === true, null, { timeout: 20_000 });
  await page.waitForFunction(() => (window as any).__challenge.state(0) === 'asking' && (window as any).__challenge.state(1) === 'asking', null, { timeout: 5_000 });
  const ids = await page.evaluate(() => [0, 1].map((p) => (window as any).__challenge.current(p).id));
  // Keep holding well past the answer guard and the nav auto-repeat delay.
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => ({
    states: [0, 1].map((p) => (window as any).__challenge.state(p)),
    ids: [0, 1].map((p) => (window as any).__challenge.current(p)?.id),
    brk: (window as any).__race.questionBreak,
  }));
  expect(after.brk).toBe(true);
  expect(after.states).toEqual(['asking', 'asking']);
  expect(after.ids).toEqual(ids);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ArrowUp');
  // After releasing, a normal answer still works.
  await page.waitForTimeout(300);
  const c0 = await page.evaluate(() => (window as any).__challenge.current(0));
  await page.keyboard.press(['Digit1', 'Digit2', 'Digit3', 'Digit4'][c0.correct]);
  await page.waitForFunction(() => (window as any).__challenge.state(0) !== 'asking', null, { timeout: 3_000 });
  expect(errors).toEqual([]);
});
