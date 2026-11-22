import { expect, test, type Page } from '@playwright/test';
import { installGamepadMock, tapPad } from './gamepadMock';
import { seedProfiles } from './profiles';

// Mobile = single player, decided at load. No `?mobile=1` here on purpose: the emulated phone must match
// (pointer: coarse) and (hover: none) by itself.
test.use({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });

const SHOT = process.env.SOLO_SHOTS; // optional folder for screenshots

async function waitScene(page: Page, key: string) {
  await page.waitForFunction((k) => (window as any).__game?.scene.isActive(k), key, { timeout: 30_000 });
}

/** Tap a point given in 1920x1080 logical game coordinates. */
async function tapLogical(page: Page, x: number, y: number) {
  const b = await page.locator('canvas').boundingBox();
  if (!b) throw new Error('no canvas');
  await page.touchscreen.tap(b.x + (x / 1920) * b.width, b.y + (y / 1080) * b.height);
  await page.waitForTimeout(150);
}

async function shot(page: Page, name: string) {
  if (SHOT) await page.screenshot({ path: `${SHOT}/solo-${name}.png` });
}

const keyXY = (row: number, col: number, span = 1) => ({ x: 960 - 440 + col * 128 + (span * 128 - 16) / 2, y: 70 + 260 + row * 128 + 56 });
const letter = (ch: string) => { const i = ch.charCodeAt(0) - 65; return keyXY(Math.floor(i / 7), i % 7); };

const overlayOn = (page: Page) => page.evaluate(() => document.querySelector('.bt-touch')?.classList.contains('on') ?? false);
const sceneTexts = (page: Page, key: string) => page.evaluate((k) => {
  const sc = (window as any).__game.scene.getScene(k);
  return sc.children.list.filter((o: any) => typeof o.text === 'string').map((o: any) => o.text as string);
}, key);

test('phone: touch controls from load, Tap to play, one card, tap through to a one-player race', async ({ page }) => {
  await page.goto('/racer.html');
  await waitScene(page, 'Title');
  // Touch device and overlay exist with no tap at all; Title only needs A/B.
  await page.waitForSelector('.bt-b[data-btn="a"].show', { timeout: 10_000 });
  expect(await page.locator('.bt-b[data-btn="left"].show').count()).toBe(0);
  expect(await overlayOn(page)).toBe(true);
  const texts = await sceneTexts(page, 'Title');
  expect(texts).toContain('Tap to play!');
  expect(texts.join('|')).not.toMatch(/1 to 4|Keyboard|Press/);
  await shot(page, 'title');

  await tapLogical(page, 960, 500); // anywhere starts as player 1
  await waitScene(page, 'Setup');
  await page.waitForTimeout(700);
  const setup = await page.evaluate(() => {
    const sc = (window as any).__game.scene.getScene('Setup');
    return { slots: sc.slots.length, panels: sc.panels.length };
  });
  expect(setup).toEqual({ slots: 1, panels: 1 });
  expect(await sceneTexts(page, 'Setup')).not.toContain('PLAYER 2');
  await shot(page, 'setup');

  // New Profile by tapping only.
  await tapLogical(page, 960, 332);
  await page.waitForTimeout(400);
  for (const ch of 'SAM') await tapLogical(page, letter(ch).x, letter(ch).y);
  await shot(page, 'name');
  const done = keyXY(4, 4, 3);
  await tapLogical(page, done.x, done.y);
  await page.waitForTimeout(400);
  await tapLogical(page, 960 - 330, 620); // YES
  await page.waitForTimeout(400);
  await tapLogical(page, 960, 800); // GO!
  await page.waitForTimeout(700);
  await shot(page, 'setup-after');

  await tapLogical(page, 960, 1015); // NEXT
  await waitScene(page, 'TrackSelect');
  await page.waitForTimeout(500);
  await tapLogical(page, 270, 285); // first world
  await shot(page, 'track');
  await tapLogical(page, 960, 985); // START RACE!
  await page.waitForFunction(() => (window as any).__race?.players?.length >= 1 && (window as any).__game.scene.isActive('Race'), null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__race.players.length)).toBe(1);
  await page.waitForSelector('.bt-b[data-btn="right"].show', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await shot(page, 'race');
});

test('phone: ?race=2 runs as one player', async ({ page }) => {
  await page.goto('/racer.html?race=2&seed=3&questions=off');
  await page.waitForFunction(() => (window as any).__race && (window as any).__game.scene.isActive('Race'), null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__race.players.length)).toBe(1);
});

test('phone with a controller: A on the pad starts the one player, overlay hides, no second player', async ({ page }) => {
  await installGamepadMock(page, 2);
  await seedProfiles(page);
  await page.goto('/racer.html');
  await waitScene(page, 'Title');
  expect(await overlayOn(page)).toBe(true);
  await tapPad(page, 0, 0); // A on pad 0
  await waitScene(page, 'Setup');
  await page.waitForTimeout(500);
  expect(await overlayOn(page)).toBe(false); // the pad was used last
  // The second pad's A (and the first pad's A = ready) never adds a player.
  await tapPad(page, 1, 0);
  await page.waitForTimeout(300);
  const slots = () => page.evaluate(() => ({ slots: (window as any).__game.scene.getScene('Setup').slots.length, panels: (window as any).__game.scene.getScene('Setup').panels.length }));
  expect(await slots()).toEqual({ slots: 1, panels: 1 });
  // Touching the screen brings the buttons back, and they still drive the same single player.
  await tapLogical(page, 1200, 100);
  await page.waitForTimeout(300);
  expect(await overlayOn(page)).toBe(true);
  await tapPad(page, 0, 0); // pad A = ready
  await page.waitForTimeout(800);
  await tapPad(page, 0, 0); // pad A = next
  await waitScene(page, 'TrackSelect');
  await tapPad(page, 0, 0);
  await page.waitForFunction(() => (window as any).__game.scene.isActive('Race'), null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__race.players.length)).toBe(1);
});
