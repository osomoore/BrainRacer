import { expect, test, type Page } from '@playwright/test';
import type { Settings } from '../../src/core/types';
import { installGamepadMock } from './gamepadMock';

async function waitScene(page: Page, key: string) {
  await page.waitForFunction((k) => (window as any).__game?.scene.isActive(k), key, { timeout: 30_000 });
}
const tap = async (page: Page, key: string) => { await page.keyboard.press(key, { delay: 65 }); await page.waitForTimeout(65); };

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
