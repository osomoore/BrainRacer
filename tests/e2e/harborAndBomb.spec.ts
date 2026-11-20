import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import { TEX } from '../../src/core/assetKeys';

const WAIT = { timeout: 35_000 };

test('Beach & Harbor runs the tide, opens the drawbridge for the ship, and closes it again', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?race=2&map=harbor&seed=3&questions=off&harbor=now');
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.2, undefined, WAIT);
  expect(await page.evaluate(() => window.__race.settings.map)).toBe('harbor');
  await page.waitForFunction((keys: string[]) => [...window.__race.npcs].some((npc) => keys.includes(npc.appearanceKey)), [...TEX.convertible], WAIT);
  await page.waitForFunction(() => (window.__race.scene.children.getByName('harbor-tide') as Phaser.GameObjects.Image)?.visible, undefined, WAIT);
  await page.waitForFunction(() => window.__race.scene.matter.world.getAllBodies().some(b => b.label === 'harbor-raised-drawbridge'), undefined, WAIT);
  await page.waitForFunction(() => {
    const { scene, world } = window.__race;
    const ship = scene.children.getByName('harbor-ship') as Phaser.GameObjects.Image;
    return ship.y > 20 * world.tileSize && ship.y < 22 * world.tileSize;
  }, undefined, WAIT);
  await page.evaluate(() => {
    const { players, world, scene } = window.__race;
    const s = world.tileSize;
    scene.matter.body.setPosition(players[0].body, { x: 34 * s, y: 12 * s });
    scene.matter.body.setAngle(players[0].body, 0);
  });
  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction((key) => window.__race.scene.children.list.some(o => (o as Phaser.GameObjects.Image).texture?.key === key), TEX.skid, WAIT);
  } finally { await page.keyboard.up('KeyW'); }
  const screenshot = info.outputPath('harbor-split.png');
  await page.screenshot({ path: screenshot });
  await info.attach('harbor-split', { path: screenshot, contentType: 'image/png' });
  await page.waitForFunction(() => !window.__race.scene.matter.world.getAllBodies().some(b => b.label === 'harbor-raised-drawbridge'), undefined, WAIT);
  expect(errors).toEqual([]);
});

test('a lit homing bomb approaches the player and spins the car on contact', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?race=1&map=industrial&seed=3&questions=off&bomb=now');
  const first = await page.waitForFunction(() => {
    const bomb = window.__race?.scene.children.getByName('homing-bomb') as Phaser.GameObjects.Image | undefined;
    return bomb && { x: bomb.x, y: bomb.y };
  }, undefined, WAIT).then(async handle => (await handle.jsonValue())!);
  await page.waitForFunction((start) => {
    const bomb = window.__race.scene.children.getByName('homing-bomb') as Phaser.GameObjects.Image | undefined;
    return bomb && Math.hypot(bomb.x - start.x, bomb.y - start.y) > 30;
  }, first, WAIT);
  const screenshot = info.outputPath('homing-bomb.png');
  await page.screenshot({ path: screenshot });
  await info.attach('homing-bomb', { path: screenshot, contentType: 'image/png' });
  await page.evaluate(() => {
    const { scene, players } = window.__race;
    const bomb = scene.children.getByName('homing-bomb') as Phaser.GameObjects.Image;
    scene.matter.body.setPosition(players[0].body, { x: bomb.x + 8, y: bomb.y });
    scene.matter.body.setVelocity(players[0].body, { x: 0, y: 0 });
  });
  await page.waitForFunction(() => {
    const { scene, players } = window.__race;
    return !scene.children.getByName('homing-bomb') && Math.abs(players[0].body.angularVelocity) > 0.015;
  }, undefined, WAIT);
  expect(errors).toEqual([]);
});
