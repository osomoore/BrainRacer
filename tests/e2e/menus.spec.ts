import { expect, test, type Page } from '@playwright/test';
import { installGamepadMock, tapPad } from './gamepadMock';

const BTN_A = 0;

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

async function waitScene(page: Page, key: string) {
  await page.waitForFunction((k) => (window as any).__game?.scene.isActive(k), key, { timeout: 30_000 });
}

const settingsOf = (page: Page) => page.evaluate(() => (window as any).__game.registry.get('settings'));

test('gamepads: join P1+P2, setup, start race', async ({ page }) => {
  const errors = watchErrors(page);
  await installGamepadMock(page, 2);
  await page.goto('/');
  await waitScene(page, 'Title');
  await page.waitForTimeout(500);

  await tapPad(page, 0, BTN_A);   // P1 joins
  await tapPad(page, 1, BTN_A);   // P2 joins
  await page.screenshot({ path: 'test-results/menus-title-2p.png' });
  await page.waitForTimeout(800);   // join grace: P2 could join before P1's second A counts
  await tapPad(page, 0, BTN_A);   // continue
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/menus-setup.png' });

  await tapPad(page, 0, BTN_A);   // A from the very first row starts the race
  await waitScene(page, 'Race');

  const s = await settingsOf(page);
  expect(s.players).toHaveLength(2);
  expect(s.players[0].device).toEqual({ type: 'gamepad', index: 0 });
  expect(s.players[1].device).toEqual({ type: 'gamepad', index: 1 });
  expect(s.players[0].car).not.toEqual(s.players[1].car);
  expect(s.challengeMode).toBe('words');
  expect(s.questionStyle).toBe('pause');
  expect(errors).toEqual([]);
});

test('keyboard only: join, select Questions Off, and start the race', async ({ page }) => {
  const errors = watchErrors(page);
  await installGamepadMock(page, 0);
  await page.goto('/');
  await waitScene(page, 'Title');
  await page.waitForTimeout(500);

  await page.keyboard.press('Space');   // join (WASD layout)
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');   // continue
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyS');   // Car
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyS');   // Questions
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyA');   // Words wraps left to Off
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');   // start immediately
  await waitScene(page, 'Race');

  const s = await settingsOf(page);
  expect(s.players).toHaveLength(1);
  expect(s.players[0].device).toEqual({ type: 'keyboard', layout: 'left' });
  expect(s.challengeMode).toBe('off');
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('brainracer.settings.v1')!))).challengeMode).toBe('off');
  await waitPastFirstQuestion(page);
  expect(errors).toEqual([]);
});

async function waitPastFirstQuestion(page: Page) {
  await page.waitForFunction(() => (window as any).__race?.elapsedSec > 6, null, { timeout: 20_000 });
  const state = await page.evaluate(() => ({
    questionBreak: (window as any).__race.questionBreak,
    question: (window as any).__challenge.current(0),
  }));
  expect(state).toEqual({ questionBreak: false, question: null });
}

test('questions URL override disables the driving questions for this race only', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem('brainracer.settings.v1', JSON.stringify({ challengeMode: 'math', questionStyle: 'drive' }));
  });
  await page.goto('/?race=1&seed=3&questions=off');
  await waitScene(page, 'Race');
  expect((await settingsOf(page)).challengeMode).toBe('math');
  expect(await page.evaluate(() => (window as any).__race.settings.challengeMode)).toBe('off');
  await waitPastFirstQuestion(page);
  expect(errors).toEqual([]);
});

test('single gamepad: A, A, A reaches the race', async ({ page }) => {
  const errors = watchErrors(page);
  await installGamepadMock(page, 1);
  await page.goto('/');
  await waitScene(page, 'Title');
  await page.waitForTimeout(500);
  await tapPad(page, 0, BTN_A);   // join
  await page.waitForTimeout(800);
  await tapPad(page, 0, BTN_A);   // Setup
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await tapPad(page, 0, BTN_A);   // Race
  await waitScene(page, 'Race');
  expect((await settingsOf(page)).players).toHaveLength(1);
  expect(errors).toEqual([]);
});
