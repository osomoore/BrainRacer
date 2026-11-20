import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { RaceContext } from '../../src/core/race';
import { INDUSTRIAL_LIGHTING } from '../../src/config/gameConfig';

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

test('Factory headlight beam origins line up with the chassis bumper and lamp spacing', async ({ page }) => {
  await page.goto('/?race=1&map=industrial&seed=3&questions=off');
  await waitForScene(page, 'Race');
  const light = await page.evaluate(({ bumperOffset, referenceWidth }) => {
    const { scene, players } = window.__race;
    const chassis = players[0].chassis;
    const beam = scene.children.getByName('industrial-headlight-0') as Phaser.GameObjects.Image;
    const halo = scene.children.getByName('industrial-car-halo-0') as Phaser.GameObjects.Image;
    const center = chassis.getWorldTransformMatrix().transformPoint(0, 0);
    const bumper = chassis.getWorldTransformMatrix().transformPoint(chassis.width * bumperOffset, 0);
    const { width, height, data } = (beam.texture as Phaser.Textures.CanvasTexture).context.getImageData(0, 0, 1, beam.height);
    const alpha = (y: number) => data[(y * width) * 4 + 3];
    let peak = 0;
    for (let y = 1; y < height / 2; y++) if (alpha(y) > alpha(peak)) peak = y;
    return { bumperError: Math.hypot(beam.x - bumper.x, beam.y - bumper.y), haloError: Math.hypot(halo.x - center.x, halo.y - center.y), offset: (height / 2 - peak) / referenceWidth };
  }, INDUSTRIAL_LIGHTING);
  expect(light.bumperError).toBeLessThan(1);
  expect(light.haloError).toBeLessThan(1);
  expect(light.offset).toBeCloseTo(1 / 3, 1);
});
