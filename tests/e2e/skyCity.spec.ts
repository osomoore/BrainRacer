import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import { WORLD_VEHICLES } from '../../src/config/collectibles';
import { TEX } from '../../src/core/assetKeys';
import { Tile } from '../../src/core/types';
import { SKY_DRAWBRIDGE } from '../../src/config/gameConfig';

const WAIT = { timeout: 35_000 };

test('Sky-city has local traffic and closes its road while the dirigible crosses', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?race=1&map=sky&seed=3&sky=now&round=60&questions=off');
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.2, undefined, WAIT);
  const initial = await page.evaluate(() => {
    const { scene, settings } = window.__race;
    const objects = scene.children.list;
    return {
      map: settings.map,
      fixedBridges: objects.filter(o => o.name === 'sky-fixed-bridge').length,
      cloudBanks: objects.filter(o => o.name === 'sky-cloud-bank').length,
      dirigibles: objects.filter(o => o.name === 'sky-dirigible').length,
    };
  });
  expect(initial.map).toBe('sky');
  expect(initial.fixedBridges).toBeGreaterThan(0);
  expect(initial.cloudBanks).toBeGreaterThan(0);
  expect(initial.dirigibles).toBeGreaterThan(0);

  await page.waitForFunction(keys => [...window.__race.npcs].some(car => keys.includes(car.appearanceKey)),
    WORLD_VEHICLES.sky.map(id => TEX.unlockVehicles[id]), WAIT);

  const deck = { ...SKY_DRAWBRIDGE, road: Tile.Road, water: Tile.Water };
  await page.waitForFunction(({ left, right, row, height, water }) => {
    const { scene, world, npcs, players } = window.__race;
    const leaf = scene.children.getByName('sky-drawbridge-left') as Phaser.GameObjects.Image;
    const otherLeaf = scene.children.getByName('sky-drawbridge-right') as Phaser.GameObjects.Image;
    const ship = scene.children.getByName('sky-bridge-dirigible') as Phaser.GameObjects.Image;
    const gate = scene.children.getByName('sky-drawbridge-barrier') as Phaser.GameObjects.Image;
    const s = world.tileSize;
    return gate.visible && leaf.scaleX < 0.35 && otherLeaf.scaleX < 0.35 &&
      ship.visible && ship.y > row * s && ship.y < (row + height) * s &&
      world.tiles[row * world.widthTiles + left] === water &&
      scene.matter.world.getAllBodies().some(body => body.label === 'sky-raised-drawbridge') &&
      [...players, ...[...npcs].filter(car => !car.destroyed)].every(car =>
        car.x <= left * s || car.x >= right * s || car.y <= row * s || car.y >= (row + height) * s);
  }, deck, WAIT);
  await page.screenshot({ path: info.outputPath('sky-drawbridge.png') });

  await page.waitForFunction(({ left, row, road }) => {
    const { scene, world } = window.__race;
    const leaf = scene.children.getByName('sky-drawbridge-left') as Phaser.GameObjects.Image;
    const otherLeaf = scene.children.getByName('sky-drawbridge-right') as Phaser.GameObjects.Image;
    const gate = scene.children.getByName('sky-drawbridge-barrier') as Phaser.GameObjects.Image;
    const ship = scene.children.getByName('sky-bridge-dirigible') as Phaser.GameObjects.Image;
    return !gate.visible && !ship.visible && leaf.scaleX === 1 && otherLeaf.scaleX === 1 &&
      world.tiles[row * world.widthTiles + left] === road &&
      !scene.matter.world.getAllBodies().some(body => body.label === 'sky-raised-drawbridge');
  }, deck, WAIT);
  expect(errors).toEqual([]);
});
