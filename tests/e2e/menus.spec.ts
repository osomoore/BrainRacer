import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { Challenge, QuestionTypes, Settings } from '../../src/core/types';
import { installGamepadMock, setPad, tapPad } from './gamepadMock';

const BTN_A = 0;
const PAD_DOWN = 13, PAD_RIGHT = 15;

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

async function waitScene(page: Page, key: string) {
  await page.waitForFunction((k) => (window as any).__game?.scene.isActive(k), key, { timeout: 30_000 });
}

const settingsOf = (page: Page) => page.evaluate(() => window.__game.registry.get('settings') as Settings);

test('gamepads: two players customize and receive different questions', async ({ page }) => {
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

  await tapPad(page, 0, PAD_RIGHT); // P1 starts as Gideon; right goes to Helen (hard, multiplication + spelling).
  for (const player of [0, 1]) {
    await tapPad(page, player, PAD_DOWN); // Car.
    await tapPad(page, player, PAD_DOWN); // Guide.
  }

  const previews = await page.evaluate(() => {
    type Column = { racer: Phaser.GameObjects.Container; car: Phaser.GameObjects.Container; hint: Phaser.GameObjects.Text };
    const setup = window.__game.scene.getScene('Setup') as unknown as { cols: Column[] };
    return setup.cols.map(({ racer, car, hint }) => ({
      text: hint.text,
      fits: racer.getBounds().bottom < hint.getBounds().top && hint.getBounds().bottom < car.getBounds().top,
    }));
  });
  expect(previews[0].text).toContain('Tables up to 12');
  expect(previews[0].text).not.toContain('Sums like');
  expect(previews[0].text).toContain('Spelling');
  expect(previews[1].text).toContain('Sums like');
  expect(previews[1].text).not.toContain('Tables up to');
  expect(previews.every((preview) => preview.fits)).toBe(true);

  await tapPad(page, 0, BTN_A); // Confirm from the Guide row starts the race.
  await waitScene(page, 'Race');

  const s = await settingsOf(page);
  expect(s.players).toHaveLength(2);
  expect(s.players[0].device).toEqual({ type: 'gamepad', index: 0 });
  expect(s.players[1].device).toEqual({ type: 'gamepad', index: 1 });
  expect(s.players[0].car).not.toEqual(s.players[1].car);
  const questionTypes: QuestionTypes[] = [
    { addition: false, multiplication: true, spelling: true },
    { addition: true, multiplication: false, spelling: true },
  ];
  expect(s.players.map((p) => p.questionTypes)).toEqual(questionTypes);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('brainracer.settings.v1')!) as Settings);
  expect(saved.players.map((p) => p.questionTypes)).toEqual(questionTypes);
  expect(s.challengeMode).toBe('words');
  expect(s.questionStyle).toBe('pause');
  await page.waitForFunction(() => [0, 1].every((p) => (window as any).__challenge?.current(p)));
  const kinds = await page.evaluate(() => [0, 1].map((p) => ((window as any).__challenge.current(p) as Challenge).kind));
  expect(kinds[0]).not.toBe('math');            // Helen: multiplication + spelling
  expect(kinds[1]).not.toBe('multiplication');  // Abe: addition + spelling
  expect(errors).toEqual([]);
});

test('keyboard only: a launch override skips questions without changing Setup preferences', async ({ page }) => {
  const errors = watchErrors(page);
  await installGamepadMock(page, 0);
  await page.goto('/?questions=off');
  await waitScene(page, 'Title');
  await page.waitForTimeout(500);

  await page.keyboard.press('Space');   // join (WASD layout)
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');   // continue
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyW', { delay: 55 });   // Start
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await waitScene(page, 'Race');

  const s = await settingsOf(page);
  expect(s.players).toHaveLength(1);
  expect(s.players[0].device).toEqual({ type: 'keyboard', layout: 'left' });
  expect(s.challengeMode).toBe('words');
  expect(s.players[0].questionTypes).toEqual({ addition: true, multiplication: false, spelling: true });
  expect(await page.evaluate(() => window.__race.settings.challengeMode)).toBe('off');
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

test('Setup wraps and the hidden hotkeys open Advanced for changing answer mode', async ({ page }) => {
  const errors = watchErrors(page);
  await installGamepadMock(page, 1);
  await page.addInitScript(() => localStorage.setItem('brainracer.content.v1', JSON.stringify({ worlds: ['industrial'] })));
  await page.goto('/');
  await waitScene(page, 'Title');
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');
  await waitScene(page, 'Setup');
  expect((await settingsOf(page)).questionStyle).toBe('pause');

  const tap = async (key: string) => {
    await page.keyboard.press(key, { delay: 55 });
    await page.waitForTimeout(55);
  };
  await tap('KeyW'); // Racer wraps to Start.
  await tap('KeyW'); // Map.
  await tap('KeyD'); // City → Factory.
  await tap('F9');
  await page.waitForFunction(() => window.__game.scene.isPaused('Setup'));

  await tap('KeyW'); // Answer mode wraps to Close.
  await tap('KeyS'); // Close wraps to Answer mode.
  await tap('KeyD'); // Stop & Answer → While Driving.
  expect((await settingsOf(page)).questionStyle).toBe('drive');
  await tap('Space'); // Accepting from Answer mode closes the menu.
  await waitScene(page, 'Setup');

  await page.waitForTimeout(500);
  await tapPad(page, 0, 9); // Start alone leaves Setup active.
  expect(await page.evaluate(() => window.__game.scene.isActive('Setup'))).toBe(true);
  await setPad(page, 0, { buttons: { 6: 1, 7: 1 } });
  await tapPad(page, 0, 9);
  await page.waitForFunction(() => window.__game.scene.isPaused('Setup'));
  await setPad(page, 0, { buttons: { 6: 0, 7: 0 } });
  await tapPad(page, 0, BTN_A);
  await waitScene(page, 'Setup');

  await tap('Space');
  await waitScene(page, 'Race');
  expect(await page.evaluate(() => {
    const { map, questionStyle } = window.__race.settings;
    return { map, questionStyle };
  })).toEqual({ map: 'industrial', questionStyle: 'drive' });
  expect(errors).toEqual([]);
});
