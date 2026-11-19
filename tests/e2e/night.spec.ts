import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { RaceContext } from '../../src/core/race';

declare global {
  interface Window {
    __game: Phaser.Game;
    __race: RaceContext;
  }
}

const WAIT = { timeout: 20_000 };

async function waitForScene(page: Page, name: string) {
  await page.waitForFunction((key) => window.__game?.scene.isActive(key), name, WAIT);
}

async function cityLighting(page: Page) {
  await waitForScene(page, 'Race');
  return page.evaluate(() => {
    const { scene } = window.__race;
    const ground = scene.children.list.find((item) => item.type === 'TilemapLayer') as Phaser.Tilemaps.TilemapLayer;
    const headlights = scene.children.list.filter((item) => item.name.startsWith('city-headlight-')).length;
    return { tileset: ground.tileset[0].image?.key, headlights };
  });
}

test('City is always day (no night option); Industrial is always night', async ({ page }) => {
  await page.goto('/?race=1&map=city&seed=3&questions=off&night=1');
  expect(await cityLighting(page)).toMatchObject({ tileset: 'world_tileset', headlights: 0 });
});
