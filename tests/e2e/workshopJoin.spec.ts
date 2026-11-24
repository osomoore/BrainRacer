import { expect, test, type Page } from '@playwright/test';
import { installGamepadMock, tapPad } from './gamepadMock';
import { seedProfiles } from './profiles';

/** Adventure Workshop join + name entry: Done must not lock the page; grid navigation edges. */

const ws = (page: Page) => page.evaluate(() => (window as any).__ws.state() as { scene: string; count: number; screens: string[] });
const key = async (page: Page, k: string) => { await page.keyboard.press(k); await page.waitForTimeout(120); };
const screens = (page: Page) => expect.poll(async () => (await ws(page)).screens.join(','), { timeout: 10_000 });
const focusedLabel = (page: Page) => page.evaluate(() => {
  const ctx = (window as any).__ws.contexts()[0];
  const scene = ctx.scene as Phaser.Scene;
  const b = scene.children.list.find((o: any) => o.isFocused) as any;
  const t = b?.list?.find((o: any) => o.type === 'Text');
  return (t?.text as string) ?? null;
});

async function boot(page: Page): Promise<void> {
  await page.goto('/workshop.html?mobile=0');
  await page.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });
  await page.waitForTimeout(300);
}

test('keyboard: letter grid reaches DONE with arrows, Space on DONE goes on and the page stays alive', async ({ page }) => {
  await boot(page);
  await key(page, 'Space'); await key(page, 'Space');
  await screens(page).toBe('profile');
  await key(page, 'Space');
  await screens(page).toBe('newProfile');
  await key(page, 'Space'); // A
  await key(page, 'ArrowRight'); await key(page, 'Space'); // B
  await key(page, 'ArrowDown'); await key(page, 'ArrowDown'); // SPACE key row
  await key(page, 'ArrowRight');
  expect(await focusedLabel(page)).toBe('DELETE');
  await key(page, 'ArrowRight');
  expect(await focusedLabel(page)).toBe('DONE');
  await key(page, 'Space');
  await page.waitForTimeout(300);
  await key(page, 'Space'); // reading level (preselected)
  await screens(page).toBe('pickWorkshop');
  await key(page, 'Space');
  await screens(page).toBe('room');
});

test('grid edges: Right on DELETE goes to DONE, never up to the letters', async ({ page }) => {
  await boot(page);
  await key(page, 'Space'); await key(page, 'Space'); await key(page, 'Space');
  await screens(page).toBe('newProfile');
  await key(page, 'ArrowDown'); await key(page, 'ArrowDown');
  expect(await focusedLabel(page)).toBe('SPACE');
  await key(page, 'ArrowRight'); await key(page, 'ArrowRight');
  expect(await focusedLabel(page)).toBe('DONE');
  await key(page, 'ArrowRight'); // wraps within the bottom row
  expect(await focusedLabel(page)).toBe('SPACE');
  await key(page, 'ArrowLeft');
  expect(await focusedLabel(page)).toBe('DONE');
});

test('gamepad: create a profile with the letter grid and reach the workshop picker', async ({ page }) => {
  await installGamepadMock(page, 1);
  await boot(page);
  await tapPad(page, 0, 0); // join
  await tapPad(page, 0, 0); // start
  await screens(page).toBe('profile');
  await tapPad(page, 0, 0); // New
  await screens(page).toBe('newProfile');
  await tapPad(page, 0, 0); // A
  await tapPad(page, 0, 13); await tapPad(page, 0, 13); // down, down
  await tapPad(page, 0, 15); await tapPad(page, 0, 15); // right, right -> DONE
  expect(await focusedLabel(page)).toBe('DONE');
  await tapPad(page, 0, 0);
  await page.waitForTimeout(300);
  await tapPad(page, 0, 0); // reading level
  await screens(page).toBe('pickWorkshop');
  await tapPad(page, 0, 0);
  await screens(page).toBe('room');
});

const titleTexts = (page: Page) => page.evaluate(() => {
  const walk = (list: any[]): string[] => list.filter((o) => o.visible).flatMap((o) => o.type === 'Container' ? walk(o.list) : o.type === 'Text' && o.text ? [o.text as string] : []);
  return walk((window as any).__ws.game.scene.getScene('title').children.list);
});
const profileTexts = (page: Page) => page.evaluate(() => {
  const walk = (list: any[]): string[] => list.flatMap((o) => o.type === 'Container' ? walk(o.list) : o.type === 'Text' && o.text ? [o.text as string] : []);
  return walk((window as any).__ws.contexts()[0].scene.children.list);
});

test('join, 1 player on the keyboard: any key joins, prompts name the keys, Space goes alone', async ({ page }) => {
  await boot(page);
  expect(await titleTexts(page)).toContain('Press any button\nor key to join');
  await key(page, 'KeyD'); // any key of the WASD layout joins as Player 1
  let texts = await titleTexts(page);
  expect(texts).toEqual(expect.arrayContaining(['Player 1 ✓', 'Keyboard: W A S D', 'Press Space to go', 'Press a button to join (optional)']));
  await key(page, 'ArrowLeft'); // a stray move key of the other layout does not add Player 2
  expect((await titleTexts(page))).not.toContain('Player 2 ✓');
  await key(page, 'Space');
  await screens(page).toBe('profile');
  expect((await ws(page)).count).toBe(1);
});

test('join, 2 players: pad then keyboard, each in its own pane; Player 1 goes', async ({ page }) => {
  await installGamepadMock(page, 1);
  await boot(page);
  await tapPad(page, 0, 13); // pad d-pad: any button joins Player 1
  expect(await titleTexts(page)).toEqual(expect.arrayContaining(['Player 1 ✓', 'Controller 1', 'Press A to go']));
  await key(page, 'Enter'); // second device joins
  expect(await titleTexts(page)).toEqual(expect.arrayContaining(['Player 1 ✓', 'Player 2 ✓']));
  await tapPad(page, 0, 0); // Player 1 (A) starts
  await screens(page).toBe('profile,profile');
  expect((await ws(page)).count).toBe(2);
});

test('join, touch: one tap, one player, no key prompts', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  try {
    const page = await ctx.newPage();
    await page.goto('/workshop.html?mobile=1');
    await page.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });
    expect(await titleTexts(page)).toContain('Tap to play');
    expect(await titleTexts(page)).not.toContain('Press any button\nor key to join');
    await page.waitForTimeout(500);
    await page.touchscreen.tap(422, 195);
    await screens(page).toBe('profile');
    expect((await ws(page)).count).toBe(1);
  } finally { await ctx.close(); }
});

test('profile chooser lists profiles from the shared store, and a Brain Racer profile can be picked', async ({ page }) => {
  await seedProfiles(page, { names: ['Robin', 'Sam'] });
  await boot(page);
  await key(page, 'Space'); await key(page, 'Space');
  await screens(page).toBe('profile');
  const texts = await profileTexts(page);
  expect(texts).toEqual(expect.arrayContaining(['Robin', 'Sam', '+ New']));
  await key(page, 'Space'); // Robin: never played the workshop -> reading level once
  await screens(page).toBe('reading');
  await key(page, 'Space'); // preselected level
  await screens(page).toBe('pickWorkshop');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.profiles')!).map((p: { id: string; name: string }) => `${p.id}:${p.name}`));
  expect(stored).toEqual(['p1:Robin', 'p2:Sam']);
});
