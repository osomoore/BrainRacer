import { expect, test } from '@playwright/test';
import { installGamepadMock, setPad, tapPad } from './gamepadMock';
import { seedProfiles } from './profiles';

test.beforeEach(({ page }) => seedProfiles(page)); // Setup needs profiles (Robin, Sam, Kim, Lee)

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

test('a held D-pad button needs a fresh press and stick movement cannot answer', async ({ page }) => {
  await installGamepadMock(page, 1);
  await page.goto('/racer.html');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Title'));
  await tapPad(page, 0, 0);   // Title -> Join (pad 0 is Player 1)
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Setup'));
  await page.waitForTimeout(400);
  await tapPad(page, 0, 0);   // ready
  await page.waitForTimeout(700);
  await tapPad(page, 0, 0);   // Next
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('TrackSelect'));
  await page.waitForTimeout(500);
  await tapPad(page, 0, 0);   // Start

  await page.waitForFunction(() => ((window as any).__race?.elapsedSec ?? 0) > 0.5);
  await setPad(page, 0, { buttons: { 12: 1 } });
  await page.waitForFunction(() => (window as any).__challenge?.phase() === 'asking' && !!(window as any).__challenge.current(0));
  const question = await page.evaluate(() => (window as any).__challenge.current(0));

  await page.waitForTimeout(700);
  await setPad(page, 0, { buttons: { 12: 0 }, axes: { 0: 1, 1: 0 } });
  await page.waitForTimeout(700);
  await setPad(page, 0, { axes: { 0: 0, 1: -1 } });
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => ({
    id: (window as any).__challenge.current(0)?.id,
    state: (window as any).__challenge.state(0),
  }))).toEqual({ id: question.id, state: 'asking' });

  await tapPad(page, 0, [14, 12, 15, 13][question.correct]);
  await page.waitForFunction(() => (window as any).__challenge.phase() === 'resuming');
});
