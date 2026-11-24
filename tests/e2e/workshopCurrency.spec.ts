import { expect, test, type Page } from '@playwright/test';
import { CATALOGS } from '../../apps/workshop/content';
import { solveAffordable } from '../../apps/workshop/logic/affordability';
import { installGamepadMock, tapPad } from './gamepadMock';
import { seedProfiles } from './profiles';

type Ws = 'race' | 'dino';
const screens = (page: Page) => page.evaluate(() => (window as any).__ws.screens() as string[]);
const expectScreen = (page: Page, want: string) => expect.poll(async () => (await screens(page)).join(','), { timeout: 15_000 }).toBe(want);
const key = async (page: Page, k: string) => { await page.keyboard.press(k); await page.waitForTimeout(180); };

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedProfiles(page);
  await page.goto('/workshop.html?mobile=0');
  await page.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });
}

/** Enter with a fresh workshop save, reusing the same profile/store setup as workshopScreens. */
async function enter(page: Page, ws: Ws = 'race', screen = 'room'): Promise<void> {
  await key(page, 'Space');
  await key(page, 'Space');
  await expectScreen(page, 'profile');
  await page.evaluate(({ ws, screen }) => {
    const w = (window as any).__ws;
    let save = w.engine.newPlayerSave('easy');
    save = { ...save, workshops: { race: w.engine.progressOf(save, 'race'), dino: w.engine.progressOf(save, 'dino') } };
    w.store.setPlayer('p1', save);
    const c = w.contexts()[0];
    c.setProfile('p1'); c.setWorkshop(ws); c.go(screen, screen === 'station' ? { aspect: 'wheels' } : {});
  }, { ws, screen });
  await expectScreen(page, screen);
  await page.waitForTimeout(350);
}

const saved = (page: Page, ws: Ws = 'race') => page.evaluate((ws) =>
  JSON.parse(localStorage.getItem('workshop.players.v1') ?? '{}').p1?.workshops?.[ws] as any, ws);
const visibleText = (page: Page) => page.evaluate(() => {
  const out: string[] = [];
  const walk = (o: any) => { if (o.visible === false) return; if (o.type === 'Text') out.push(String(o.text).replace(/\s+/g, ' ').trim()); o.list?.forEach(walk); };
  (window as any).__ws.panes[0].children.list.forEach(walk);
  return out;
});

test('fresh board has three challenges solvable with affordable purchases', async ({ page }) => {
  await boot(page); await enter(page, 'race', 'board');
  const progress = await saved(page);
  const checks = await page.evaluate(() => {
    const w = (window as any).__ws; const p = w.engine.progressOf(w.contexts()[0].save(), 'race');
    return p.active.map((id: string) => p.challenges[id].stages.flatMap((s: any) => s.requirements.flatMap((r: any) => r.checks)));
  });
  expect(checks).toHaveLength(3);
  for (const c of checks) expect(solveAffordable(CATALOGS.race, c, progress)?.cost).toBe(2);
});

test('buy and install Mud Tires, then win Deep Mud for its payout', async ({ page }) => {
  await boot(page); await enter(page, 'race', 'station');
  const fresh = await saved(page);
  const id = fresh.active.find((cid: string) => fresh.challenges[cid].stages[0].scenario === 'mud');
  expect(id).toBeTruthy();
  await key(page, 'KeyD');
  expect(await visibleText(page)).toContain('Buy for 2');
  await key(page, 'Space');
  expect(await visibleText(page)).toContain('Pay 2 Coins?');
  expect((await saved(page)).bought).toEqual([]);
  await key(page, 'Escape'); // No: nothing changes
  expect(await visibleText(page)).not.toContain('Pay 2 Coins?');
  expect((await saved(page)).wallet).toBe(4);
  await key(page, 'Space');
  await key(page, 'Space'); // Yes
  let progress = await saved(page);
  expect(progress.wallet).toBe(2);
  expect(progress.bought).toEqual(['wheels.mud']);
  expect(progress.model.wheels).toBe('wheels.mud'); // buying also equips
  await expectScreen(page, 'room');

  await page.evaluate((id) => (window as any).__ws.contexts()[0].go('run', { challengeId: id }), id);
  await expectScreen(page, 'run');
  await page.waitForTimeout(550); await key(page, 'Escape');
  await expectScreen(page, 'results');
  const paid = await saved(page);
  expect(paid.completed[id].payout).toBe(2);
  expect(paid.wallet).toBe(4);
  expect(paid.active).not.toContain(id);
  expect(await visibleText(page)).toContain('+2');
  expect(await visibleText(page)).toContain('New Tests');
  expect(await visibleText(page)).not.toContain('Run again');
});

test.describe('split-pane shopping', () => {
  test.use({ hasTouch: true });

  test('gamepad and touch buy independently in two tall panes', async ({ page }) => {
    await installGamepadMock(page, 1);
    await boot(page);
    await tapPad(page, 0, 0);
    await key(page, 'Enter');
    await tapPad(page, 0, 0);
    await expectScreen(page, 'profile,profile');
    await page.evaluate(() => {
      const w = (window as any).__ws;
      w.contexts().forEach((c: any, i: number) => {
        const profile = `p${i + 1}`;
        const ws = i === 0 ? 'race' : 'dino';
        const save = w.engine.newPlayerSave('easy');
        w.store.setPlayer(profile, save);
        c.setProfile(profile);
        c.setWorkshop(ws);
        c.go('station', { aspect: i === 0 ? 'wheels' : 'head' });
      });
    });
    await expectScreen(page, 'station,station');
    const balances = () => page.evaluate(() => (window as any).__ws.panes.slice(0, 2).map((pane: any) => {
      const badge = pane.children.getByName('workshop-wallet');
      return { width: pane.ctx.size.w, amount: badge.list.find((o: any) => o.type === 'Text').text };
    }));
    expect(await balances()).toEqual([{ width: 960, amount: '4' }, { width: 960, amount: '4' }]);

    await tapPad(page, 0, 15);
    await tapPad(page, 0, 0);
    await tapPad(page, 0, 0); // Yes
    await expect.poll(balances).toEqual([{ width: 960, amount: '2' }, { width: 960, amount: '4' }]);
    expect((await saved(page)).bought).toEqual(['wheels.mud']);

    const tap = async (label: string) => {
      const point = await page.evaluate((label) => {
        const pane = (window as any).__ws.panes[1];
        const button = pane.children.list.find((o: any) => o.visible && o.list?.some((child: any) => child.text === label));
        return { x: pane.cameras.main.x + button.x, y: button.y };
      }, label);
      await page.touchscreen.tap(point.x, point.y);
    };
    await tap('2');
    await tap('Buy for 2');
    await tap('Yes');
    await expect.poll(balances).toEqual([{ width: 960, amount: '2' }, { width: 960, amount: '2' }]);
  });
});

test('the wallet badge sits at the same spot on every screen', async ({ page }) => {
  await boot(page); await enter(page);
  const pos = async () => page.evaluate(() => { const b = (window as any).__ws.panes[0].children.getByName('workshop-wallet'); return b && [b.x, b.y]; });
  const at: any[] = [];
  for (const [screen, data] of [['room', {}], ['station', { aspect: 'wheels' }], ['board', {}], ['results', {}]] as const) {
    await page.evaluate(({ screen, data }) => (window as any).__ws.contexts()[0].go(screen, data), { screen, data });
    await page.waitForTimeout(500);
    if (await pos()) at.push(await pos());
  }
  expect(at.length).toBeGreaterThanOrEqual(3);
  for (const p of at) expect(p).toEqual(at[0]);
});

test('an unaffordable Bio Juice offer cannot be bought or installed', async ({ page }) => {
  await boot(page); await enter(page, 'dino');
  const before = await page.evaluate(() => {
    const w = (window as any).__ws; const c = w.contexts()[0]; const save = c.save();
    const p = { ...w.engine.progressOf(save, 'dino'), wallet: 0 };
    c.commit({ ...save, workshops: { ...save.workshops, dino: p } });
    c.go('station', { aspect: 'head' });
    return p;
  });
  await expectScreen(page, 'station');
  await key(page, 'KeyD');
  await key(page, 'Space');
  expect(await visibleText(page)).toContain('You have 0 Bio Juice. You need 2.');
  await key(page, 'Space'); // OK closes the popup
  expect(await visibleText(page)).not.toContain('You have 0 Bio Juice. You need 2.');
  await expectScreen(page, 'station');
  expect(await saved(page, 'dino')).toEqual(before);
});

test('admin adds currency to one workshop and resets both for the selected player', async ({ page }) => {
  await boot(page); await enter(page);
  const before = await saved(page);
  const dino = await saved(page, 'dino');

  // Exercise the real admin controls using their keyboard navigation.
  await page.evaluate(() => (window as any).__ws.shell.openAdmin(false));
  await expect.poll(() => page.evaluate(() => (window as any).__ws.state().adminOpen)).toBe(true);
  await key(page, 'ArrowDown'); await key(page, 'Enter'); // select p1
  await key(page, 'ArrowDown'); await key(page, 'Enter'); // Race Shop
  const adminTexts = () => page.evaluate(() => {
    const scene = (window as any).__ws.game.scene.getScene('admin');
    return scene.children.list.filter((o: any) => o.type === 'Text').map((o: any) => String(o.text));
  });
  await expect.poll(async () => (await adminTexts()).join('|')).toContain('+10 coins');
  // The workshop view starts focused on its currency grant.
  await key(page, 'Enter');
  await expect.poll(async () => (await saved(page)).wallet).toBe(before.wallet + 10);
  expect(await saved(page, 'dino')).toEqual(dino);
  await key(page, 'Escape'); // back to the player settings
  await key(page, 'ArrowDown'); await key(page, 'ArrowDown'); await key(page, 'ArrowDown'); await key(page, 'Enter');
  await key(page, 'ArrowLeft'); await key(page, 'Enter'); // confirm fresh-start reset
  const reset = await page.evaluate(() => {
    const w = (window as any).__ws;
    const save = w.store.player('p1');
    return { save, race: w.engine.progressOf(save, 'race').wallet, dino: w.engine.progressOf(save, 'dino').wallet };
  });
  expect(reset).toMatchObject({ save: { reading: 'easy', workshops: {} }, race: 4, dino: 4 });
  expect(reset.save.workshops).toEqual({});
});
