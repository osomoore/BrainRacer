import { expect, test, type Page } from '@playwright/test';
import { installGamepadMock, tapPad } from './gamepadMock';

const BTN_A = 0;
const DPAD_DOWN = 13;

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
  await tapPad(page, 0, BTN_A);   // continue
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/menus-setup.png' });

  // P1 cursor: 0 diff -> 6 START
  for (let i = 0; i < 6; i++) await tapPad(page, 0, DPAD_DOWN);
  await tapPad(page, 0, BTN_A);
  await waitScene(page, 'Race');

  const s = await settingsOf(page);
  expect(s.players).toHaveLength(2);
  expect(s.players[0].device).toEqual({ type: 'gamepad', index: 0 });
  expect(s.players[1].device).toEqual({ type: 'gamepad', index: 1 });
  expect(s.players[0].car).not.toEqual(s.players[1].car);
  expect(errors).toEqual([]);
});

test('keyboard only: Space joins, WASD to START', async ({ page }) => {
  const errors = watchErrors(page);
  await installGamepadMock(page, 0);
  await page.goto('/');
  await waitScene(page, 'Title');
  await page.waitForTimeout(500);

  await page.keyboard.press('Space');   // join (WASD layout)
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');   // continue
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyS'); await page.waitForTimeout(100); }
  await page.keyboard.press('Space');
  await waitScene(page, 'Race');

  const s = await settingsOf(page);
  expect(s.players).toHaveLength(1);
  expect(s.players[0].device).toEqual({ type: 'keyboard', layout: 'left' });
  expect(errors).toEqual([]);
});
