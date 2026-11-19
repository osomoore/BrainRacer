import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { RaceContext } from '../../src/core/race';
import { installGamepadMock } from './gamepadMock';

declare global {
  interface Window {
    __game: Phaser.Game;
    __race: RaceContext;
  }
}

test.use({ viewport: { width: 1920, height: 1080 } });

const WAIT = { timeout: 20_000 };
const THROTTLE = ['KeyW', 'ArrowUp'] as const;

async function waitScene(page: Page, key: string) {
  await page.waitForFunction((scene) => window.__game?.scene.isActive(scene), key, WAIT);
}

async function waitForGo(page: Page) {
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.25, undefined, WAIT);
}

/** What the farm renderer put in the scene (fence bodies, golden grade, blades). */
async function farmState(page: Page) {
  return page.evaluate(() => {
    const { scene, settings, world } = window.__race;
    const bodies = scene.matter.world.getAllBodies();
    const fenceBodies = bodies.filter((b) => (b as { plugin?: { owner?: { kind: string } } }).plugin?.owner?.kind === 'fence').length;
    const textures = new Set(scene.children.list.map((o) => (o as Phaser.GameObjects.Image).texture?.key));
    return {
      map: settings.map,
      farm: !!world.farm,
      fences: world.farm?.fences.length ?? 0,
      fenceBodies,
      grade: !!scene.children.getByName('farm-golden-hour'),
      barn: textures.has('farm_lot_barn'),
      blades: textures.has('farm_turbine_blade') && textures.has('farm_windmill_blade'),
      farmTileset: scene.textures.exists('world_tileset_farm'),
    };
  });
}

for (const count of [1, 2] as const) {
  const layout = count === 1 ? 'solo' : 'split';
  test(`seeded Farm ${layout} reaches GO, renders the farm and both cars drive`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/?race=${count}&map=farm&seed=3&questions=off`);
    await waitForGo(page);
    const state = await farmState(page);
    expect(state.map).toBe('farm');
    expect(state.farm).toBe(true);
    expect(state.fences).toBeGreaterThan(0);
    expect(state.fenceBodies).toBe(state.fences);
    expect(state).toMatchObject({ grade: true, barn: true, blades: true, farmTileset: true });
    expect(await page.evaluate(() => window.__race.camera.layout().mode)).toBe(count === 1 ? 'single' : 'split');

    await page.waitForFunction(() => window.__race.elapsedSec > 1.2, undefined, WAIT);
    const screenshot = testInfo.outputPath(`farm-${layout}.png`);
    await page.screenshot({ path: screenshot });
    await testInfo.attach(`farm-${layout}`, { path: screenshot, contentType: 'image/png' });

    const start = await page.evaluate(() => window.__race.players.map((c) => ({ x: c.x, y: c.y })));
    const keys = THROTTLE.slice(0, count);
    for (const key of keys) await page.keyboard.down(key);
    try {
      await page.waitForFunction((s) => window.__race.players.every((c, i) => Math.hypot(c.x - s[i].x, c.y - s[i].y) > 150),
        start, WAIT);
    } finally {
      for (const key of keys) await page.keyboard.up(key);
    }
    expect(errors).toEqual([]);
  });
}

test('Setup can select Farm', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installGamepadMock(page, 0);
  await page.addInitScript(() => {
    localStorage.setItem('brainracer.settings.v1', JSON.stringify({ challengeMode: 'off', map: 'city' }));
  });
  await page.goto('/');
  await waitScene(page, 'Title');
  await page.keyboard.press('Space');
  await page.waitForTimeout(800); // Title allows time for a second player to join.
  await page.keyboard.press('Space');
  await waitScene(page, 'Setup');
  // Player one's cursor opens on Difficulty. Map is four rows below it; City -> Industrial -> Farm.
  for (let row = 0; row < 4; row++) {
    await page.keyboard.press('KeyS', { delay: 55 });
    await page.waitForTimeout(55);
  }
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(80);
  await page.keyboard.press('KeyD');
  await page.keyboard.press('Space');
  await waitScene(page, 'Race');
  await waitForGo(page);
  const state = await farmState(page);
  expect(state.map).toBe('farm');
  expect(state.farm).toBe(true);
  expect(state.grade).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('brainracer.settings.v1')!).map)).toBe('farm');
  expect(errors).toEqual([]);
});
