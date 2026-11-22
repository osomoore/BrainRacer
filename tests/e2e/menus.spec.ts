import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { Challenge, QuestionTypes, Settings } from '../../src/core/types';
import { installGamepadMock, setPad, tapPad } from './gamepadMock';
import { seedProfiles } from './profiles';

// Setup needs profiles: every test starts with Robin, Sam, Kim and Lee except the first-run (fresh device) ones.
test.beforeEach(async ({ page }, info) => {
  if (info.title.includes('fresh device')) return;
  await seedProfiles(page, { settings: { p3: HARD_TABLES, p4: HARD_TABLES } });
});
const HARD_TABLES = { difficulty: 'hard', questionTypes: { math: true, reading: true, jbq: false }, roundSec: 180 };

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
  await page.goto('/racer.html');
  await waitScene(page, 'Title');
  await page.waitForTimeout(500);

  await tapPad(page, 0, BTN_A);   // Title -> Join: pad 0 claims panel 1
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await tapPad(page, 1, BTN_A);   // pad 1 claims panel 2
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/menus-setup.png' });

  await tapPad(page, 0, PAD_RIGHT); // P1 starts as Robin; right goes to Kim (hard, multiplication + spelling).
  for (const player of [0, 1]) {
    await tapPad(page, player, PAD_DOWN); // Car.
    await tapPad(page, player, PAD_DOWN); // Guide.
  }

  const previews = await page.evaluate(() => {
    type Column = { racerRow: Phaser.GameObjects.Container; carRow: Phaser.GameObjects.Container; hint: Phaser.GameObjects.Text };
    const setup = window.__game.scene.getScene('Setup') as unknown as { panels: Column[] };
    return setup.panels.slice(0, 2).map(({ racerRow: racer, carRow: car, hint }) => ({
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

  await tapPad(page, 0, BTN_A); // P1 ready (locks the panel)
  await tapPad(page, 1, BTN_A); // P2 ready
  await page.waitForTimeout(700);
  await tapPad(page, 1, BTN_A); // P2 cannot continue
  expect(await page.evaluate(() => window.__game.scene.isActive('Setup'))).toBe(true);
  await tapPad(page, 0, BTN_A); // P1 Next
  await waitScene(page, 'TrackSelect');
  await page.waitForTimeout(500);
  await tapPad(page, 1, BTN_A); // P2 cannot start
  expect(await page.evaluate(() => window.__game.scene.isActive('TrackSelect'))).toBe(true);
  await tapPad(page, 0, BTN_A); // P1 Start
  await waitScene(page, 'Race');

  const s = await settingsOf(page);
  expect(s.players).toHaveLength(2);
  expect(s.players[0].device).toEqual({ type: 'gamepad', index: 0 });
  expect(s.players[1].device).toEqual({ type: 'gamepad', index: 1 });
  expect(s.players[0].car).not.toEqual(s.players[1].car);
  const questionTypes: QuestionTypes[] = [
    { math: true, reading: true, jbq: false },
    { math: true, reading: true, jbq: false },
  ];
  expect(s.players.map((p) => p.questionTypes)).toEqual(questionTypes);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('brainracer.settings.v1')!) as Settings);
  expect(saved.players.map((p) => p.questionTypes)).toEqual(questionTypes);
  expect(s.challengeMode).toBe('words');
  expect(s.questionStyle).toBe('pause');
  await page.waitForFunction(() => [0, 1].every((p) => (window as any).__challenge?.current(p)));
  const kinds = await page.evaluate(() => [0, 1].map((p) => ((window as any).__challenge.current(p) as Challenge).kind));
  expect(kinds[0]).not.toBe('math');            // Kim: multiplication + spelling
  expect(kinds[1]).not.toBe('multiplication');  // Sam: addition + spelling
  expect(errors).toEqual([]);
});

test('keyboard only: a launch override skips questions without changing Setup preferences', async ({ page }) => {
  const errors = watchErrors(page);
  await installGamepadMock(page, 0);
  await page.goto('/?questions=off');
  await waitScene(page, 'Title');
  await page.waitForTimeout(500);

  await page.keyboard.press('Space');   // Title -> Join (WASD layout is P1)
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');   // ready
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');   // Next
  await waitScene(page, 'TrackSelect');
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');   // Start
  await waitScene(page, 'Race');

  const s = await settingsOf(page);
  expect(s.players).toHaveLength(1);
  expect(s.players[0].device).toEqual({ type: 'keyboard', layout: 'left' });
  expect(s.challengeMode).toBe('words');
  expect(s.players[0].questionTypes).toEqual({ math: true, reading: true, jbq: false });
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

test('single gamepad: A, A, A, A reaches the race', async ({ page }) => {
  const errors = watchErrors(page);
  await installGamepadMock(page, 1);
  await page.goto('/racer.html');
  await waitScene(page, 'Title');
  await page.waitForTimeout(500);
  await tapPad(page, 0, BTN_A);   // Join screen
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await tapPad(page, 0, BTN_A);   // ready
  await page.waitForTimeout(700);
  await tapPad(page, 0, BTN_A);   // Track select
  await waitScene(page, 'TrackSelect');
  await page.waitForTimeout(500);
  await tapPad(page, 0, BTN_A);   // Race
  await waitScene(page, 'Race');
  expect((await settingsOf(page)).players).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('Setup wraps and the hidden hotkeys open Advanced for changing answer mode', async ({ page }) => {
  const errors = watchErrors(page);
  await installGamepadMock(page, 1);
  await page.addInitScript(() => localStorage.setItem('brainracer.racers.v1', JSON.stringify(Object.fromEntries(['p1', 'p2', 'p3', 'p4'].map(id => [id, { worlds: ['industrial'], items: [], overrides: {} }])))));
  await page.goto('/racer.html');
  await waitScene(page, 'Title');
  await page.keyboard.press('Space');   // Title -> Join
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  expect((await settingsOf(page)).questionStyle).toBe('pause');

  const tap = async (key: string) => {
    await page.keyboard.press(key, { delay: 55 });
    await page.waitForTimeout(55);
  };
  await tap('KeyW'); // Racer wraps to Buddy.
  await tap('KeyS'); // And back to Racer.
  await tap('F9');
  await page.waitForFunction(() => window.__game.scene.isPaused('Setup'));

  await tap('KeyW'); // Answer mode wraps to Close.
  await tap('KeyS'); // Close wraps to Answer mode.
  await tap('KeyD'); // Stop & Answer → While Driving.
  expect((await settingsOf(page)).questionStyle).toBe('drive');
  await tap('Space'); // Accepting from Answer mode closes the menu.
  await waitScene(page, 'Setup');

  await page.waitForTimeout(500);
  await tapPad(page, 0, 9); // Start alone does nothing on the Join screen.
  expect(await page.evaluate(() => window.__game.scene.isActive('Setup'))).toBe(true);
  await setPad(page, 0, { buttons: { 6: 1, 7: 1 } });
  await tapPad(page, 0, 9);
  await page.waitForFunction(() => window.__game.scene.isPaused('Setup'));
  await setPad(page, 0, { buttons: { 6: 0, 7: 0 } });
  await tapPad(page, 0, BTN_A);
  await waitScene(page, 'Setup');

  await tap('Space');   // ready
  await page.waitForTimeout(700);
  await tap('Space');   // Next
  await waitScene(page, 'TrackSelect');
  await page.waitForTimeout(500);
  await tap('KeyD');    // City → Factory.
  await tap('Space');
  await waitScene(page, 'Race');
  expect(await page.evaluate(() => {
    const { map, questionStyle } = window.__race.settings;
    return { map, questionStyle };
  })).toEqual({ map: 'industrial', questionStyle: 'drive' });
  expect(errors).toEqual([]);
});

test('Setup: P2 cannot select P1\'s racer and loadouts follow each racer\'s unlocks', async ({ page }) => {
  const errors = watchErrors(page);
  await installGamepadMock(page, 2);
  await page.addInitScript(() => {
    if (localStorage.getItem('brainracer.racers.v1')) return;
    const none = { worlds: [], items: [], overrides: {} };
    localStorage.setItem('brainracer.racers.v1', JSON.stringify({ p2: none, p1: { ...none, worlds: ['industrial'] }, p3: none, p4: none }));
  });
  await page.goto('/racer.html');
  await waitScene(page, 'Title');
  await page.waitForTimeout(500);
  await tapPad(page, 0, BTN_A);
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await tapPad(page, 1, BTN_A);
  await page.waitForTimeout(300);

  const racers = () => page.evaluate(() => (window.__game.scene.getScene('Setup') as any).cfg.players.map((p: any) => p.profile) as string[]);
  expect(await racers()).toEqual(['p1', 'p2']);
  await tapPad(page, 1, PAD_RIGHT);   // Sam -> (Robin is taken) -> Kim
  expect(await racers()).toEqual(['p1', 'p3']);
  await tapPad(page, 1, PAD_RIGHT);   // Kim -> Lee
  expect(await racers()).toEqual(['p1', 'p4']);
  await tapPad(page, 1, PAD_RIGHT);   // Lee -> New Profile
  await tapPad(page, 1, PAD_RIGHT);   // New Profile -> Sam
  expect(await racers()).toEqual(['p1', 'p2']);
  await tapPad(page, 0, PAD_RIGHT);   // Robin -> Kim
  await tapPad(page, 0, PAD_RIGHT);   // Kim -> Lee
  await tapPad(page, 0, PAD_RIGHT);   // Lee -> New Profile
  await tapPad(page, 0, PAD_RIGHT);   // New Profile -> (Sam is taken) -> Robin
  expect(await racers()).toEqual(['p1', 'p2']);
  expect(new Set(await racers()).size).toBe(2);
  // A ready panel is locked: P2 readies, then cannot change racer.
  await tapPad(page, 1, BTN_A);
  await tapPad(page, 1, PAD_RIGHT);
  expect(await racers()).toEqual(['p1', 'p2']);
  await tapPad(page, 0, BTN_A);
  await page.waitForTimeout(700);
  await tapPad(page, 0, BTN_A);
  await waitScene(page, 'TrackSelect');
  const maps = await page.evaluate(() => [...(window.__game.scene.getScene('TrackSelect') as any).maps] as string[]);
  expect(maps).toEqual(['city', 'industrial']);
  expect(errors).toEqual([]);
});

test('Setup on a fresh device: the first player makes their racer (name, age, settings), then races as them', async ({ page }) => {
  const errors = watchErrors(page);
  await installGamepadMock(page, 1);
  await page.goto('/racer.html');
  await waitScene(page, 'Title');
  await page.waitForTimeout(500);
  await tapPad(page, 0, BTN_A);   // Join screen
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  const PAD_UP = 12;
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hub.profiles')!))).toEqual([]); // fresh device: no profiles
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window.__game.scene.getScene('Setup') as any).panels[0].hint.text)).toBe('Make your racer!');
  await page.screenshot({ path: 'test-results/menus-setup-new.png' });
  await tapPad(page, 0, BTN_A);     // ready on New Profile -> creation overlay
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/menus-newracer-name.png' });
  await page.keyboard.type('Zed', { delay: 0 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/menus-newracer-age.png' });
  await tapPad(page, 0, BTN_A);     // YES
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/menus-newracer-options.png' });
  await tapPad(page, 0, PAD_UP);    // wraps to GO
  await tapPad(page, 0, BTN_A);     // creates the racer and readies the panel
  await page.waitForTimeout(700);
  await tapPad(page, 0, BTN_A);     // Next
  await waitScene(page, 'TrackSelect');
  await page.waitForTimeout(500);
  await tapPad(page, 0, BTN_A);     // Start
  await waitScene(page, 'Race');

  const s = await settingsOf(page);
  const id = s.players[0].profile!;
  expect(id).toMatch(/^p\d+$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hub.profiles')!).map((p: { id: string; name: string }) => [p.id, p.name]))).toEqual([[id, 'ZED']]);
  expect(s.racerProfiles?.[id]).toMatchObject({ roundSec: 300, difficulty: 'easy', questionTypes: { math: true, reading: true, jbq: false } });
  expect(await page.evaluate(() => window.__race.settings.players[0].profile)).toBe(id);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('brainracer.settings.v1')!) as Settings);
  expect(saved.players[0].profile).toBe(id);
  expect(errors).toEqual([]);
});
