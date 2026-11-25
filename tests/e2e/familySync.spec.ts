import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { FakeFamilyServer } from '../../shared/sync/fake';
import type { ProfileRecord } from '../../shared/sync/record';
import { installGamepadMock, tapPad } from './gamepadMock';

const API_PATH = '/__family-sync';
const SHOTS = process.env.FAMILY_SYNC_SHOTS;
const key = async (page: Page, value: string) => { await page.keyboard.press(value); await page.waitForTimeout(150); };
const screens = (page: Page) => page.evaluate(() => (window as any).__ws.screens() as string[]);
const expectScreen = (page: Page, screen: string) => expect.poll(async () => (await screens(page)).join(','), { timeout: 20_000 }).toBe(screen);

async function attachFake(context: BrowserContext, server: FakeFamilyServer): Promise<void> {
  await context.addInitScript((path) => { (window as any).__familySyncFakeUrl = `${location.origin}${path}`; }, API_PATH);
  await context.route(`**${API_PATH}/**`, async (route: Route) => {
    const request = route.request();
    const response = await server.fetch(request.url().replace(API_PATH, ''), {
      method: request.method(), headers: await request.allHeaders(),
      body: ['GET', 'HEAD'].includes(request.method()) ? undefined : request.postData() ?? undefined,
    });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers.entries()), body: await response.text() });
  });
}

async function canvasClickText(page: Page, sceneKey: string, label: string): Promise<void> {
  const point = await page.evaluate(({ sceneKey, label }) => {
    const game = (window as any).__game;
    const scene = game?.scene.getScene(sceneKey);
    if (!scene) throw new Error(`Missing Phaser scene ${sceneKey}`);
    const visit = (items: any[]): any => {
      for (const item of items) {
        if (item.text === label) return item;
        const nested = item.list && visit(item.list);
        if (nested) return nested;
      }
      return undefined;
    };
    const item = visit(scene.children.list);
    if (!item) throw new Error(`Cannot find ${label} in ${sceneKey}`);
    const bounds = item.getBounds();
    const canvas = game.canvas.getBoundingClientRect();
    const scaleX = canvas.width / game.scale.gameSize.width;
    const scaleY = canvas.height / game.scale.gameSize.height;
    return { x: canvas.left + (bounds.centerX ?? (bounds.left + bounds.right) / 2) * scaleX,
      y: canvas.top + (bounds.centerY ?? (bounds.top + bounds.bottom) / 2) * scaleY };
  }, { sceneKey, label });
  await page.mouse.click(point.x, point.y);
}

async function makeWorkshopProfile(page: Page, name: string): Promise<string> {
  await key(page, 'Space'); await key(page, 'Space'); await expectScreen(page, 'profile');
  await key(page, 'Space'); await expectScreen(page, 'newProfile');
  await page.keyboard.type(name, { delay: 45 });
  await key(page, 'Enter');
  await key(page, 'ArrowLeft'); // Easy
  await key(page, 'Space'); await expectScreen(page, 'pickWorkshop');
  await key(page, 'Space'); await expectScreen(page, 'room');
  return page.evaluate(() => JSON.parse(localStorage.getItem('hub.profiles') ?? '[]').at(-1).id as string);
}

async function serverProfiles(server: FakeFamilyServer, code: string): Promise<{ id: string; data?: ProfileRecord }[]> {
  const response = await server.fetch('http://family.test/v1/family', { headers: { Authorization: `Family ${code}` } });
  return (await response.json()).profiles;
}

test('a family profile and Workshop progress sync between two devices', async ({ browser }, testInfo) => {
  const server = new FakeFamilyServer();
  const baseURL = String(testInfo.project.use.baseURL ?? 'http://localhost:5227');
  const contextA = await browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 } });
  const contextB = await browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 }, hasTouch: true });
  await attachFake(contextA, server); await attachFake(contextB, server);
  try {
    const racerA = await contextA.newPage();
    await installGamepadMock(racerA, 1);
    await racerA.goto('/racer.html?syncfake=1');
    await racerA.waitForFunction(() => !!(window as any).__game?.scene.getScene('Config')?.sys.isActive(), null, { timeout: 30_000 });
    await racerA.keyboard.press('F9');
    await canvasClickText(racerA, 'Config', 'Family sync');
    await racerA.getByRole('button', { name: 'Make a family' }).click();
    await expect(racerA.getByText('Family created. Show the code before sharing it.')).toBeVisible();
    if (SHOTS) await racerA.screenshot({ path: `${SHOTS}/family-sync-panel.png` });
    await tapPad(racerA, 0, 0);
    const code = await racerA.getByRole('dialog').locator('p').evaluateAll((nodes) => nodes.map(n => n.textContent).find(t => /^[A-Z]{3,8}(?:-[A-Z]{3,8}){3}$/.test(t ?? '')));
    expect(code).toMatch(/^[A-Z]{3,8}(?:-[A-Z]{3,8}){3}$/);
    const qr = racerA.getByLabel('QR code to join this family');
    await expect(qr).toBeVisible();
    await expect(qr).toBeInViewport({ ratio: 1 });
    const qrSize = await qr.evaluate((canvas: HTMLCanvasElement) => {
      const bounds = canvas.getBoundingClientRect();
      return { width: canvas.width, height: canvas.height, displayWidth: bounds.width, displayHeight: bounds.height };
    });
    expect(qrSize.width).toBeGreaterThanOrEqual(360);
    expect(qrSize.width).toBeLessThanOrEqual(420);
    expect(qrSize.height).toBe(qrSize.width);
    expect(qrSize.displayWidth).toBe(qrSize.width);
    expect(qrSize.displayHeight).toBe(qrSize.height);
    const moduleScale = [29, 33, 37, 41, 45, 49].map(totalModules => qrSize.width / totalModules)
      .find(scale => Number.isInteger(scale));
    expect(moduleScale).toBeDefined();
    if (SHOTS) await racerA.screenshot({ path: `${SHOTS}/family-sync-qr.png` });
    await racerA.getByRole('button', { name: 'Close' }).click();

    const workshopB = await contextB.newPage();
    await workshopB.goto(`/workshop.html?mobile=0&syncfake=1&join=${encodeURIComponent(code!)}`);
    await expect(workshopB.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
    await expect(workshopB.getByRole('textbox', { name: 'Family code' })).toHaveValue(code!);
    await workshopB.getByRole('button', { name: 'Join a family' }).tap();
    await expect(workshopB.getByText('Joined. Profiles and progress are syncing.')).toBeVisible({ timeout: 20_000 });
    await workshopB.getByRole('button', { name: 'Close' }).click();

    const profileA = racerA;
    await profileA.goto('/workshop.html?mobile=0&syncfake=1');
    await profileA.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });
    const profileId = await makeWorkshopProfile(profileA, 'Milo');
    await expect.poll(async () => (await serverProfiles(server, code!)).some(row => row.id === profileId), { timeout: 15_000 }).toBe(true);

    // Returning to the Workshop causes the second device to pull the newly shared profile.
    await workshopB.reload();
    await workshopB.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 20_000 });
    await expect.poll(() => workshopB.evaluate(() => JSON.parse(localStorage.getItem('hub.profiles') ?? '[]').map((p: any) => p.name)), { timeout: 20_000 }).toContain('Milo');

    await key(workshopB, 'Space'); await key(workshopB, 'Space'); await expectScreen(workshopB, 'profile');
    await key(workshopB, 'Space'); await expectScreen(workshopB, 'pickWorkshop');
    await key(workshopB, 'Space'); await expectScreen(workshopB, 'room');
    await workshopB.evaluate(() => (window as any).__ws.contexts()[0].go('station', { aspect: 'wheels' }));
    await expectScreen(workshopB, 'station');
    await key(workshopB, 'KeyD'); await key(workshopB, 'Space'); await key(workshopB, 'Space');
    await expectScreen(workshopB, 'room');
    await expect.poll(async () => {
      const rows = await serverProfiles(server, code!);
      const saved = rows.find(row => row.id === profileId)?.data?.workshop?.workshops?.race;
      return { bought: saved?.bought, wallet: saved?.wallet };
    }, { timeout: 20_000 }).toEqual({ bought: ['wheels.mud'], wallet: 2 });

    const attemptId = await workshopB.evaluate(() => {
      const context = (window as any).__ws.contexts()[0];
      const save = context.save();
      const progress = save.workshops.race;
      const id = Object.keys(progress.challenges).find((key) =>
        !progress.challenges[key].stages.some((stage: any) => stage.scenario === 'practice'));
      if (!id) throw new Error('No learning challenge found for sync record');
      const at = Date.now() - 2_000;
      const build = { ...progress.model };
      progress.completed[id] = { build, wonAt: at + 1_000, payout: 0 };
      progress.active = progress.active.filter((key: string) => key !== id);
      progress.learning = { ...progress.learning, [id]: { tries: 2, firstTryAt: at, wonAt: at + 1_000, hintShown: true, failedChecks: ['A', ''] } };
      progress.recentTries = [...(progress.recentTries ?? []),
        { at, challengeId: id, pass: false, failedChecks: 'A', build },
        { at: at + 1_000, challengeId: id, pass: true, failedChecks: '', build }];
      context.commit({ ...save, workshops: { ...save.workshops, race: progress } });
      return id;
    });
    await expect.poll(async () => {
      const saved = (await serverProfiles(server, code!)).find(row => row.id === profileId)?.data?.workshop?.workshops?.race as any;
      return { tries: saved?.learning?.[attemptId]?.tries, hintShown: saved?.learning?.[attemptId]?.hintShown,
        failedChecks: saved?.learning?.[attemptId]?.failedChecks, lastTries: saved?.recentTries?.slice(-2).map((item: any) => [item.challengeId, item.pass, item.failedChecks]) };
    }, { timeout: 20_000 }).toEqual({ tries: 2, hintShown: true, failedChecks: ['A', ''], lastTries: [[attemptId, false, 'A'], [attemptId, true, '']] });

    await profileA.reload();
    await expect.poll(() => profileA.evaluate((id) => {
      const save = JSON.parse(localStorage.getItem('workshop.players.v1') ?? '{}')[id]?.workshops?.race;
      return { bought: save?.bought, wallet: save?.wallet };
    }, profileId), { timeout: 25_000 }).toEqual({ bought: ['wheels.mud'], wallet: 2 });
    await expect.poll(() => profileA.evaluate(({ id, attemptId }) => {
      const progress = JSON.parse(localStorage.getItem('workshop.players.v1') ?? '{}')[id]?.workshops?.race;
      return { tries: progress?.learning?.[attemptId]?.tries, hintShown: progress?.learning?.[attemptId]?.hintShown,
        lastTries: progress?.recentTries?.slice(-2).map((item: any) => [item.challengeId, item.pass, item.failedChecks]) };
    }, { id: profileId, attemptId }), { timeout: 25_000 }).toEqual({ tries: 2, hintShown: true, lastTries: [[attemptId, false, 'A'], [attemptId, true, '']] });
  } finally { await contextA.close(); await contextB.close(); }
});
