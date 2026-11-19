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

const SETTINGS_KEY = 'brainracer.settings.v1';
const WAIT = { timeout: 20_000 };

async function waitForScene(page: Page, name: string) {
  await page.waitForFunction((key) => window.__game?.scene.isActive(key), name, WAIT);
}

async function cityLighting(page: Page) {
  await waitForScene(page, 'Race');
  return page.evaluate(() => {
    const { scene, settings } = window.__race;
    const ground = scene.children.list.find((item) => item.type === 'TilemapLayer') as Phaser.Tilemaps.TilemapLayer;
    const headlights = scene.children.list.filter((item) => item.name.startsWith('city-headlight-')).length;
    return { night: settings.nightDriving, tileset: ground.tileset[0].image?.key, headlights };
  });
}

test('City lighting is selectable in Setup and quick launch can override it for one race', async ({ page }) => {
  await installGamepadMock(page, 0);
  await page.goto('/?seed=3&questions=off');
  await waitForScene(page, 'Title');
  await page.keyboard.press('Space', { delay: 80 });
  await page.waitForTimeout(800);
  await page.keyboard.press('Space', { delay: 80 });
  await waitForScene(page, 'Setup');

  for (let row = 0; row < 9; row++) {
    await page.keyboard.press('KeyS', { delay: 55 });
    await page.waitForTimeout(55);
  }
  await page.keyboard.press('KeyD', { delay: 80 });
  await page.keyboard.press('Space', { delay: 80 });
  expect(await cityLighting(page)).toEqual({ night: true, tileset: 'world_tileset_night', headlights: 1 });
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).nightDriving, SETTINGS_KEY)).toBe(true);

  await page.goto('/?race=1&map=city&seed=3&questions=off&night=0');
  expect(await cityLighting(page)).toEqual({ night: false, tileset: 'world_tileset', headlights: 0 });
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).nightDriving, SETTINGS_KEY)).toBe(true);
});

test('City night headlights follow both cars and go dark when a car is disabled', async ({ page }) => {
  await page.goto('/?race=2&map=city&seed=3&questions=off&night=1');
  expect(await cityLighting(page)).toEqual({ night: true, tileset: 'world_tileset_night', headlights: 2 });
  await page.waitForFunction(() => window.__race.elapsedSec > 0.25, undefined, WAIT);

  await page.evaluate(() => {
    const { scene, players } = window.__race;
    scene.matter.body.setAngle(players[0].body, 0.65);
    scene.matter.body.setAngle(players[1].body, -0.8);
  });
  await page.waitForFunction(() => Math.abs(window.__race.players[0].view.rotation - 0.65) < 0.001, undefined, WAIT);
  const beams = await page.evaluate(() => {
    const { scene, players } = window.__race;
    return players.map(({ player, view, chassis }) => {
      const light = scene.children.getByName(`city-headlight-${player}`) as Phaser.GameObjects.Image;
      const rotation = view.rotation + chassis.rotation;
      const offset = chassis.displayWidth * view.scaleX * 0.44;
      return {
        alpha: light.alpha,
        positionError: Math.hypot(light.x - view.x - Math.cos(rotation) * offset, light.y - view.y - Math.sin(rotation) * offset),
        rotationError: Math.abs(Math.sin((light.rotation - rotation) / 2)),
        cameras: scene.cameras.cameras.map((camera) => light.willRender(camera)),
      };
    });
  });
  for (const beam of beams) {
    expect(beam.alpha).toBeGreaterThan(0);
    expect(beam.positionError).toBeLessThan(0.001);
    expect(beam.rotationError).toBeLessThan(0.001);
    expect(beam.cameras).toEqual([true, true]);
  }

  await page.evaluate(() => window.__race.players[0].setDisabled(true));
  await page.waitForFunction(() => {
    const { scene } = window.__race;
    const first = scene.children.getByName('city-headlight-0') as Phaser.GameObjects.Image;
    const second = scene.children.getByName('city-headlight-1') as Phaser.GameObjects.Image;
    return first.alpha === 0 && second.alpha > 0;
  }, undefined, WAIT);
});
