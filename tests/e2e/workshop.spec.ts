import { expect, test, type Page } from '@playwright/test';
import { seedProfiles } from './profiles';

/** Adventure Workshop shell: join, panes, profile creation, mobile taps, admin. Hooks: window.__ws. */

const ws = (page: Page) => page.evaluate(() => (window as any).__ws.state() as { scene: string; count: number; screens: string[]; adminOpen: boolean; adminMode: boolean });
const key = async (page: Page, k: string) => { await page.keyboard.press(k); await page.waitForTimeout(120); };
const screens = (page: Page) => expect.poll(async () => (await ws(page)).screens.join(','), { timeout: 10_000 });

async function boot(page: Page, url = '/workshop.html'): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });
  await page.waitForTimeout(300);
}

test('keyboard 1P: join, new profile, reading level, workshop, room placeholder, save persists', async ({ page }) => {
  await boot(page);
  await key(page, 'Space'); // KB1 joins
  await key(page, 'Space'); // Player 1 starts
  await screens(page).toBe('profile');

  await key(page, 'Space'); // only card: New
  await screens(page).toBe('newProfile');
  await page.keyboard.type('Zoe', { delay: 80 });
  await key(page, 'Enter'); // done -> reading level
  await page.waitForTimeout(200);
  await key(page, 'Space'); // Medium is preselected
  await screens(page).toBe('pickWorkshop');

  const stored = await page.evaluate(() => ({
    profiles: JSON.parse(localStorage.getItem('hub.profiles') ?? '[]'),
    players: JSON.parse(localStorage.getItem('workshop.players.v1') ?? '{}'),
  }));
  expect(stored.profiles.map((p: { name: string }) => p.name)).toEqual(['Zoe']);
  expect(stored.players[stored.profiles[0].id].reading).toBe('medium');

  await key(page, 'Space'); // Race Shop
  await screens(page).toBe('room');
  await key(page, 'Escape'); // placeholder Back
  await screens(page).toBe('pickWorkshop');

  // The save survives a reload: the profile now goes straight to the workshop picker.
  await boot(page);
  await key(page, 'Space'); await key(page, 'Space');
  await screens(page).toBe('profile');
  await key(page, 'Space');
  await screens(page).toBe('pickWorkshop');
});

test('duplicate names are refused (any case)', async ({ page }) => {
  await seedProfiles(page, { names: ['Robin'] });
  await boot(page);
  await key(page, 'Space'); await key(page, 'Space');
  await key(page, 'ArrowRight'); // New is the second card
  await key(page, 'Enter');
  await screens(page).toBe('newProfile');
  await page.keyboard.type('ROBIN', { delay: 60 });
  await key(page, 'Enter');
  await page.waitForTimeout(200);
  await screens(page).toBe('newProfile');
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('hub.profiles')!))).length).toBe(1);
});

test('keyboard 2P: both layouts join, panes split and work independently', async ({ page }) => {
  await seedProfiles(page);
  await boot(page);
  await key(page, 'Space'); // KB1 joins
  await key(page, 'Enter'); // KB2 joins
  await key(page, 'Space'); // Player 1 starts
  await screens(page).toBe('profile,profile');
  const geo = await page.evaluate(() => {
    const w = (window as any).__ws;
    return { sizes: w.contexts().map((c: any) => c.size.w), x: w.panes.map((p: any) => p.cameras.main.x), layouts: w.contexts().map((c: any) => c.layout) };
  });
  expect(geo.sizes).toEqual([960, 960]);
  expect(geo.x).toEqual([0, 960]);
  expect(geo.layouts).toEqual(['tall', 'tall']);

  await key(page, 'Space'); // Player 1 picks Robin (no workshop save yet) -> reading
  await screens(page).toBe('reading,profile');
  await key(page, 'ArrowRight'); // Player 2 moves to Sam
  await key(page, 'Enter');
  await screens(page).toBe('reading,reading');
  // Player 1 is locked out of nothing but the other pane's profile stays unavailable on the profile screen.
  await key(page, 'Escape');
  await screens(page).toBe('profile,reading');
  const locked = await page.evaluate(() => (window as any).__ws.contexts()[0].otherProfileId());
  expect(locked).toBe('p2');
});

test('mobile: tap to play gives one pane; gear opens the grown-up gate', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  await boot(page, '/workshop.html?mobile=1');
  await page.mouse.click(800, 450); // anywhere: tap to play
  await screens(page).toBe('profile');
  expect((await ws(page)).count).toBe(1);
  const pane = await page.evaluate(() => { const c = (window as any).__ws.contexts()[0]; return { touch: c.input.touch, prompts: c.input.prompts, w: c.size.w }; });
  expect(pane).toEqual({ touch: true, prompts: 'none', w: 1920 });
  await page.mouse.click(330 * (1600 / 1920), 330 * (900 / 1080)); // "+ New"
  await screens(page).toBe('newProfile');
  await page.mouse.click(150 * (1600 / 1920), 210 * (900 / 1080)); // Back
  await screens(page).toBe('profile');
  await page.mouse.click((1920 - 75) * (1600 / 1920), 75 * (900 / 1080)); // faint gear
  await expect.poll(async () => (await ws(page)).adminOpen).toBe(true);
  await ctx.close();
});

test('F9 opens the admin from any screen; Admin Mode persists in workshop.device.v1', async ({ page }) => {
  await seedProfiles(page);
  await boot(page);
  await key(page, 'Space'); await key(page, 'Space');
  await screens(page).toBe('profile');
  await key(page, 'F9');
  await expect.poll(async () => (await ws(page)).adminOpen).toBe(true);
  await key(page, 'Space'); // edit Admin Mode
  await key(page, 'KeyD'); // -> On
  await key(page, 'Space'); // finish
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('workshop.device.v1') ?? '{}').adminMode)).toBe(true);
  await key(page, 'F9');
  await expect.poll(async () => (await ws(page)).adminOpen).toBe(false);
  expect((await ws(page)).adminMode).toBe(true);
  await screens(page).toBe('profile');
  // survives a reload
  await boot(page);
  expect((await ws(page)).adminMode).toBe(true);
});
