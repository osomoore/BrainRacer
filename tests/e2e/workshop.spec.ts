import { expect, test, type Page } from '@playwright/test';
import { STAGE, WS_ADMIN } from '../../apps/workshop/config';
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

async function titleTextBounds(page: Page) {
  return page.evaluate(() => {
    const game = (window as any).__ws.game;
    const scale = game.canvas.getBoundingClientRect().width / game.scale.gameSize.width;
    const visibleText = (objects: any[]): any[] => objects
      .filter((object) => object.visible)
      .flatMap((object) => object.type === 'Container' ? visibleText(object.list)
        : object.type === 'Text' && object.text ? [object] : []);
    return visibleText(game.scene.getScene('title').children.list).map((object) => {
      const { left, right, top, bottom } = object.getBounds();
      return { text: object.text as string, left, right, top, bottom,
        cssFontSize: parseFloat(object.style.fontSize) * scale };
    });
  });
}

async function expectTitleTextClear(page: Page, expected: string[]) {
  const bounds = await titleTextBounds(page);
  expect(bounds.map(({ text }) => text)).toEqual(expect.arrayContaining(expected));
  for (const [i, a] of bounds.entries()) {
    for (const b of bounds.slice(i + 1)) {
      const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      expect(overlaps, `"${a.text}" overlaps "${b.text}"`).toBe(false);
    }
  }
  return bounds;
}

test('wide title keeps both join slots clear before and after joining', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot(page, '/workshop.html?mobile=0');
  await expectTitleTextClear(page, ['Press any button\nor key to join', 'Back to games']);
  await page.screenshot({ path: testInfo.outputPath('title-1920x1080.png') });
  await key(page, 'Space');
  await expectTitleTextClear(page, ['PLAYER 1', 'Keyboard: W A S D', 'PLAYER 2', 'to join', 'Press Space to go', 'Back to games']);
  await key(page, 'Enter');
  await expectTitleTextClear(page, ['PLAYER 1', 'PLAYER 2', 'Keyboard: arrows', 'Press Space to go', 'Back to games']);
  await page.screenshot({ path: testInfo.outputPath('title-2p-1920x1080.png') });
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`phone title has a readable beta notice at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    // Use the mobile title on a fine pointer so the shared portrait rotation prompt leaves it visible.
    await boot(page, '/workshop.html?mobile=1');
    const notice = ['Under construction —\nprogress may be lost.', 'Thanks for testing! Tell us what you think.'];
    const bounds = await expectTitleTextClear(page, ['Adventure Workshop', 'Tap to play', ...notice]);
    for (const text of bounds.filter(({ text }) => notice.includes(text))) {
      expect(text.cssFontSize, text.text).toBeGreaterThanOrEqual(15);
    }
    await page.screenshot({ path: testInfo.outputPath(`title-${viewport.width}x${viewport.height}.png`) });
  });
}

test('keyboard 1P: join, new profile, reading level, workshop, room placeholder, save persists', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot(page);
  await key(page, 'Space'); // KB1 joins
  await key(page, 'Space'); // Player 1 starts
  await screens(page).toBe('profile');

  await key(page, 'Space'); // only card: New
  await screens(page).toBe('newProfile');
  await page.keyboard.type('Zoe', { delay: 80 });
  await page.screenshot({ path: testInfo.outputPath('name-1920x1080.png') });
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
  await key(page, 'Escape'); // open leave confirmation
  await key(page, 'KeyA'); // KB1 left selects Yes from the default No
  await key(page, 'Space');
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

test('keyboard 2P: both layouts join, panes split and work independently', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
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
  await page.screenshot({ path: testInfo.outputPath('profiles-2p-1920x1080.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: testInfo.outputPath('profiles-2p-844x390.png') });
  await page.setViewportSize({ width: 1920, height: 1080 });

  await key(page, 'Space'); // Player 1 picks Robin (no workshop save yet) -> reading
  await screens(page).toBe('reading,profile');
  await key(page, 'Enter'); // Player 2 can't claim Robin after Player 1
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

test('desktop join gear opens grown-up settings through the multiplication gate', async ({ page }) => {
  await page.setViewportSize({ width: STAGE.w, height: STAGE.h });
  await boot(page, '/workshop.html?mobile=0');
  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw new Error('Workshop canvas missing');
  const click = (x: number, y: number) => page.mouse.click(
    canvas.x + x * canvas.width / STAGE.w, canvas.y + y * canvas.height / STAGE.h,
  );
  await click(STAGE.w - WS_ADMIN.gearHit / 2, WS_ADMIN.gearHit / 2);
  await expect.poll(async () => (await ws(page)).adminOpen).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const { gear, zone } = (window as any).__ws.game.scene.getScene('overlay');
    return gear.visible || zone.input.enabled;
  })).toBe(false);

  const question = await page.waitForFunction(() => {
    const admin = (window as any).__ws.game.scene.getScene('admin');
    for (const child of admin.children.list) {
      const factors = /^(\d+) x (\d+) = \?$/.exec(child.text ?? '');
      if (factors) return Number(factors[1]) * Number(factors[2]);
    }
  });
  const keypad = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'DEL', '0', 'OK'];
  for (const label of [...String(await question.jsonValue()), 'OK']) {
    const i = keypad.indexOf(label);
    await click(STAGE.w / 2 + (i % 3 - 1) * 134, 500 + Math.floor(i / 3) * 134);
  }
  await page.waitForFunction(() => (window as any).__ws.game.scene.getScene('admin').children.list
    .some((child: any) => child.text === 'Grown-up settings'));
});

test('mobile: tap to play gives one pane; gear opens the grown-up gate', async ({ browser }, testInfo) => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  try {
    const page = await ctx.newPage();
    await page.goto('/workshop.html?mobile=1');
    const tap = async (sceneKey: string, label?: string) => {
      // A scene can report its screen ID before Phaser adds its buttons to the hit-test list.
      const ready = await page.waitForFunction(({ sceneKey, label }) => {
        const game = (window as any).__ws?.game;
        if (!game?.scene.isActive(sceneKey)) return;
        const scene = game.scene.getScene(sceneKey);
        const target = scene.input._list.find((obj: any) => obj.input?.enabled && obj.visible
          && (label ? obj.list?.some((child: any) => child.text === label) : obj === scene.zone));
        if (!target) return;
        const rect = game.canvas.getBoundingClientRect();
        return { x: rect.left + target.x * rect.width / game.scale.gameSize.width, y: rect.top + target.y * rect.height / game.scale.gameSize.height };
      }, { sceneKey, label });
      const point = await ready.jsonValue();
      if (!point) throw new Error(`Tap target missing in ${sceneKey}`);
      await page.touchscreen.tap(point.x, point.y);
    };
    await tap('title', 'Tap to play');
    await screens(page).toBe('profile');
    expect((await ws(page)).count).toBe(1);
    await page.screenshot({ path: testInfo.outputPath('profiles-1p-844x390.png') });
    await tap('pane0', '+ New');
    const pane = await page.evaluate(() => { const c = (window as any).__ws.contexts()[0]; return { touch: c.input.touch, prompts: c.input.prompts, w: c.size.w }; });
    expect(pane).toEqual({ touch: true, prompts: 'none', w: 1920 });
    await screens(page).toBe('newProfile');
    await page.screenshot({ path: testInfo.outputPath('name-844x390.png') });
    await tap('pane0', 'BACK');
    await screens(page).toBe('profile');
    await tap('overlay');
    await expect.poll(async () => (await ws(page)).adminOpen).toBe(true);
    await page.waitForFunction(() => (window as any).__ws.game.scene.getScene('admin').children.list
      .some((child: any) => child.text === 'Grown-ups only!'));
  } finally {
    await ctx.close();
  }
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
