import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { seedProfiles } from './profiles';

const screens = (page: Page) => expect.poll(() => page.evaluate(() =>
  (window as any).__ws.screens().join(',')), { timeout: 15_000 });

async function boot(page: Page): Promise<void> {
  await page.goto('/workshop.html?mobile=1');
  await page.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });
  await page.waitForTimeout(300);
}

/** Tap a visible interactive Phaser object by its own or a child's label. */
async function tapLabel(page: Page, sceneKey: string, label: string): Promise<void> {
  const ready = await page.waitForFunction(({ sceneKey, label }) => {
    const game = (window as any).__ws?.game;
    if (!game?.scene.isActive(sceneKey)) return;
    const scene = game.scene.getScene(sceneKey);
    const hasLabel = (obj: any): boolean => obj.text === label || obj.list?.some(hasLabel);
    const target = scene.input._list.find((obj: any) => obj.input?.enabled && obj.visible && hasLabel(obj));
    if (!target) return;
    const rect = game.canvas.getBoundingClientRect();
    return { x: rect.left + target.x * rect.width / game.scale.gameSize.width,
      y: rect.top + target.y * rect.height / game.scale.gameSize.height };
  }, { sceneKey, label });
  const point = await ready.jsonValue() as { x: number; y: number };
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForTimeout(250);
}

async function touchSetup(page: Page, viewport: { width: number; height: number }, testInfo: TestInfo): Promise<void> {
  await page.setViewportSize(viewport);
  await seedProfiles(page, { names: ['Robin'] });
  await boot(page);
  await page.screenshot({ path: testInfo.outputPath(`title-${viewport.width}x${viewport.height}.png`) });
  await tapLabel(page, 'title', 'Back');
  await expect(page).toHaveURL(/\/$/);

  // Boot a fresh game and seed a real pane through the public test hook.
  await boot(page);
  await tapLabel(page, 'title', 'Tap to play');
  await screens(page).toBe('profile');
  await page.evaluate(() => {
    const w = (window as any).__ws;
    const ctx = w.contexts()[0];
    const save = w.engine.newPlayerSave('medium');
    save.workshops.race = w.engine.progressOf(save, 'race');
    w.store.setPlayer('p1', save);
    ctx.setProfile('p1');
    ctx.setWorkshop('race');
    ctx.go('room');
  });
  await screens(page).toBe('room');
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath(`room-${viewport.width}x${viewport.height}.png`) });
}

for (const viewport of [{ width: 844, height: 390 }, { width: 1024, height: 768 }]) {
  test(`touch Workshop flow and layout at ${viewport.width}x${viewport.height}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport, hasTouch: true });
    try {
      const page = await context.newPage();
      await touchSetup(page, viewport, testInfo);

      // The room's touch Back goes directly to the workshop picker.
      await tapLabel(page, 'pane0', 'Back');
      await screens(page).toBe('pickWorkshop');
      await tapLabel(page, 'pane0', 'Race Shop');
      await screens(page).toBe('room');

      // Board touch Back returns directly to the workshop picker; the footer's Room button remains available.
      await page.evaluate(() => (window as any).__ws.contexts()[0].go('board'));
      await screens(page).toBe('board');
      await page.waitForTimeout(400);
      await page.screenshot({ path: testInfo.outputPath(`board-${viewport.width}x${viewport.height}.png`) });
      await tapLabel(page, 'pane0', 'Back');
      await screens(page).toBe('pickWorkshop');
      await tapLabel(page, 'pane0', 'Race Shop');
      await screens(page).toBe('room');

      // Station: a tap selects/previews, a second selection changes the choice, and the repeated tap buys it.
      await page.evaluate(() => (window as any).__ws.contexts()[0].go('station', { aspect: 'wheels' }));
      await screens(page).toBe('station');
      await page.waitForTimeout(900);
      await page.screenshot({ path: testInfo.outputPath(`station-${viewport.width}x${viewport.height}.png`) });
      const swatchPoints = await page.evaluate(() => {
        const game = (window as any).__ws.game;
        const scene = (window as any).__ws.panes[0];
        const rect = game.canvas.getBoundingClientRect();
        const buttons = scene.input._list.filter((obj: any) => obj.input?.enabled && obj.visible && obj.w === 250 && Math.abs(obj.y - 935) < 2)
          .sort((a: any, b: any) => a.x - b.x);
        return buttons.slice(0, 3).map((obj: any) => ({
          x: rect.left + obj.x * rect.width / game.scale.gameSize.width,
          y: rect.top + obj.y * rect.height / game.scale.gameSize.height,
        }));
      });
      expect(swatchPoints).toHaveLength(3);
      const tapSwatch = async (index: number) => page.touchscreen.tap(swatchPoints[index].x, swatchPoints[index].y);
      const initial = await page.evaluate(() => {
        const p = (window as any).__ws.contexts()[0].save().workshops.race;
        return { wheels: p.model.wheels, wallet: p.wallet };
      });
      await tapSwatch(0); // the installed choice needs a deliberate tap before it can be confirmed
      await expect.poll(() => page.evaluate(() => (window as any).__ws.state().screens.join(','))).toBe('station');
      expect(await page.evaluate(() => {
        const p = (window as any).__ws.contexts()[0].save().workshops.race;
        return { wheels: p.model.wheels, wallet: p.wallet };
      })).toEqual(initial);
      await tapSwatch(1); // select and preview the first offer
      const paneText = () => page.evaluate(() => {
        const walk = (objects: any[]): string[] => objects.flatMap((obj) => obj.type === 'Container'
          ? walk(obj.list) : obj.type === 'Text' && obj.text ? [obj.text] : []);
        return walk((window as any).__ws.panes[0].children.list);
      });
      await expect.poll(paneText).toContain('Mud Tires');
      await tapSwatch(2); // changing selection previews the next variant
      await expect.poll(paneText).toContain('Snow Tires');
      expect(await page.evaluate(() => {
        const p = (window as any).__ws.contexts()[0].save().workshops.race;
        return { wheels: p.model.wheels, wallet: p.wallet };
      })).toEqual(initial);
      await tapSwatch(2); // second tap confirms purchase on touch
      await screens(page).toBe('room');
      expect(await page.evaluate(() => (window as any).__ws.contexts()[0].save().workshops.race.model.wheels)).toBe('wheels.snow');
      expect(await page.evaluate(() => (window as any).__ws.contexts()[0].save().workshops.race.wallet)).toBe(initial.wallet - 3);

      // The large on-screen confirm button also equips an owned choice directly on touch.
      await page.evaluate(() => (window as any).__ws.contexts()[0].go('station', { aspect: 'wheels' }));
      await screens(page).toBe('station');
      await page.waitForTimeout(900);
      const roadPoint = await page.evaluate(() => {
        const game = (window as any).__ws.game;
        const scene = (window as any).__ws.panes[0];
        const rect = game.canvas.getBoundingClientRect();
        const road = scene.input._list.find((obj: any) => obj.input?.enabled && obj.visible && obj.w === 250 && Math.abs(obj.y - 935) < 2);
        return { x: rect.left + road.x * rect.width / game.scale.gameSize.width,
          y: rect.top + road.y * rect.height / game.scale.gameSize.height };
      });
      await page.touchscreen.tap(roadPoint.x, roadPoint.y); // select Road Tires
      await tapLabel(page, 'pane0', 'OK');
      await screens(page).toBe('room');
      expect(await page.evaluate(() => (window as any).__ws.contexts()[0].save().workshops.race.model.wheels)).toBe('wheels.road');

      // Keyboard/controller routes remain covered by the existing Workshop and currency specs.
    } finally {
      await context.close();
    }
  });
}
