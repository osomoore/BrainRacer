import { expect, test, type Page } from '@playwright/test';
import type { Settings } from '../../src/core/types';
import { installGamepadMock, tapPad } from './gamepadMock';
import { seedProfiles } from './profiles';

test.beforeEach(({ page }) => seedProfiles(page)); // Setup needs profiles (Robin, Sam, Kim, Lee)

async function waitScene(page: Page, key: string) {
  await page.waitForFunction((k) => (window as any).__game?.scene.isActive(k), key, { timeout: 30_000 });
}
const tap = async (page: Page, key: string) => { await page.keyboard.press(key, { delay: 65 }); await page.waitForTimeout(65); };

test('four player cards keep their signup choices while two players edit questions', async ({ page }) => {
  await installGamepadMock(page, 2);
  await page.goto('/racer.html');
  await waitScene(page, 'Title');
  await tap(page, 'Space');
  await waitScene(page, 'Setup');
  await tap(page, 'Enter');
  await tapPad(page, 0, 0);
  await tapPad(page, 1, 0);
  const state = () => page.evaluate(() => {
    const { cfg, panels } = window.__game.scene.getScene('Setup') as any;
    return {
      loadouts: cfg.players.map(({ profile, car, guide }: Settings['players'][number]) => ({ profile, car, guide })),
      questions: cfg.players.map(({ questionTypes }: Settings['players'][number]) => questionTypes),
      open: panels.map((p: any) => p.questionsGroup.visible),
    };
  });
  const before = await state();
  expect(before.loadouts).toHaveLength(4);
  expect(before.open).toEqual([false, false, false, false]);
  await tapPad(page, 0, 12); // P3 focuses Questions
  await tapPad(page, 0, 0);
  await tapPad(page, 1, 12); // P4 focuses Questions
  await tapPad(page, 1, 0);
  expect((await state()).open).toEqual([false, false, true, true]);
  await tapPad(page, 0, 0); // P3 disables Math
  await tapPad(page, 0, 1); // P3 goes back
  await tapPad(page, 1, 1); // P4 goes back
  expect(await state()).toEqual({
    ...before,
    questions: before.questions.map((types: NonNullable<Settings['players'][number]['questionTypes']>, i: number) =>
      i === 2 ? { ...types, math: false } : types),
  });
});

test('two keyboard players join, ready up, and P1 starts the race', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await installGamepadMock(page, 0);
  await page.goto('/?questions=off');
  await waitScene(page, 'Title');
  await tap(page, 'Space');            // Title -> Join: WASD claims panel 1
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await tap(page, 'Enter');            // arrows keyboard claims panel 2
  await page.waitForTimeout(300);
  const joined = () => page.evaluate(() => (window.__game.scene.getScene('Setup') as any).slots.map((s: any) => ({ d: s.device, ready: s.ready })));
  expect(await joined()).toEqual([
    { d: { type: 'keyboard', layout: 'left' }, ready: false },
    { d: { type: 'keyboard', layout: 'right' }, ready: false },
  ]);
  await tap(page, 'ArrowUp');          // P2 focuses Questions
  await tap(page, 'Enter');            // P2 opens Questions
  const editing = () => page.evaluate(() => (window.__game.scene.getScene('Setup') as any).panels.slice(0, 2).map((p: any) => p.questionsGroup.visible));
  expect(await editing()).toEqual([false, true]);
  await tap(page, 'Backspace');        // close P2's submenu without removing P1
  expect(await editing()).toEqual([false, false]);
  expect(await joined()).toHaveLength(2);
  await tap(page, 'ArrowUp');          // P2 focuses Buddy again, where Enter means Ready
  await tap(page, 'Space');            // P1 ready: P1 alone cannot continue
  await page.waitForTimeout(700);
  await tap(page, 'Space');
  expect(await page.evaluate(() => window.__game.scene.isActive('Setup'))).toBe(true);
  await tap(page, 'Enter');            // P2 ready
  await tap(page, 'Enter');            // P2 cannot continue
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__game.scene.isActive('Setup'))).toBe(true);
  await tap(page, 'Space');            // P1 Next
  await waitScene(page, 'TrackSelect');
  await page.waitForTimeout(500);
  await tap(page, 'Enter');            // P2 cannot start
  expect(await page.evaluate(() => window.__game.scene.isActive('TrackSelect'))).toBe(true);
  await tap(page, 'Space');            // P1 Start
  await waitScene(page, 'Race');
  const s = await page.evaluate(() => window.__game.registry.get('settings') as Settings);
  expect(s.players).toHaveLength(2);
  expect(s.players.map((p) => p.device)).toEqual([{ type: 'keyboard', layout: 'left' }, { type: 'keyboard', layout: 'right' }]);
  expect(new Set(s.players.map((p) => p.profile)).size).toBe(2);
  expect(errors).toEqual([]);
});
