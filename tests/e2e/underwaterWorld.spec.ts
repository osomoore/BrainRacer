import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import { WORLD_VEHICLES } from '../../src/config/collectibles';
import { TEX } from '../../src/core/assetKeys';
import { Tile } from '../../src/core/types';
import { UNDERWATER_CROSSING } from '../../src/config/gameConfig';

const WAIT = { timeout: 35_000 };

test('Marine life swims past as the road tunnel retracts for a submarine', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?race=1&map=underwater&seed=3&questions=off&underwater=now');
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.2, undefined, WAIT);
  expect(await page.evaluate(() => window.__race.settings.map)).toBe('underwater');

  const { left, right, top, bottom } = UNDERWATER_CROSSING;
  const crossing = { x: (left + right) / 2, y: (top + bottom) / 2 };
  const lane = await page.evaluate(({ x, y }) => {
    const { world } = window.__race;
    return world.tiles[y * world.widthTiles + x];
  }, crossing);
  expect(lane).toBe(Tile.Road);

  const trafficKeys = WORLD_VEHICLES.underwater.map(id => TEX.unlockVehicles[id]);
  await page.waitForFunction((keys: string[]) => [...window.__race.npcs]
    .some(npc => !npc.destroyed && keys.includes(npc.appearanceKey)), trafficKeys, WAIT);

  const swimmers = await page.evaluate(() => {
    const { scene } = window.__race;
    return ['underwater-whale', 'underwater-giant-fish', 'underwater-manta-ray', 'underwater-sea-turtle'].map(name => {
      const image = scene.children.getByName(name) as Phaser.GameObjects.Image;
      return { name, x: image.x };
    });
  });
  await page.waitForFunction(start => start.every(({ name, x }) => {
    const image = window.__race.scene.children.getByName(name) as Phaser.GameObjects.Image;
    return image.visible && Math.abs(image.x - x) > 25;
  }), swimmers, WAIT);

  await page.waitForFunction(({ x, y, tile }) => {
    const { scene, world } = window.__race;
    const west = scene.children.getByName('underwater-retractable-west') as Phaser.GameObjects.Image;
    const east = scene.children.getByName('underwater-retractable-east') as Phaser.GameObjects.Image;
    const sub = scene.children.getByName('underwater-lock-submarine') as Phaser.GameObjects.Image;
    return west.displayWidth < world.tileSize && east.displayWidth < world.tileSize && sub.visible && sub.alpha > 0.8 &&
      Math.abs(sub.y - y * world.tileSize) < world.tileSize &&
      world.tiles[y * world.widthTiles + x] === tile &&
      scene.matter.world.getAllBodies().some(body => body.label === 'underwater-open-tunnel');
  }, { ...crossing, tile: Tile.Water }, WAIT);
  await page.screenshot({ path: info.outputPath('underwater-tunnel.png') });

  await page.waitForFunction(({ x, y, tile }) => {
    const { scene, world } = window.__race;
    const west = scene.children.getByName('underwater-retractable-west') as Phaser.GameObjects.Image;
    const sub = scene.children.getByName('underwater-lock-submarine') as Phaser.GameObjects.Image;
    return !sub.visible && west.displayWidth > world.tileSize * 2 &&
      world.tiles[y * world.widthTiles + x] === tile &&
      !scene.matter.world.getAllBodies().some(body => body.label === 'underwater-open-tunnel');
  }, { ...crossing, tile: Tile.Road }, WAIT);
  expect(errors).toEqual([]);
});
