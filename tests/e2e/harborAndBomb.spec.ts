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
    const leaf = scene.children.getByName('harbor-drawbridge-left') as Phaser.GameObjects.Image;
    const barrier = scene.children.getByName('harbor-drawbridge-barrier') as Phaser.GameObjects.Image;
    return ship.y > 20 * world.tileSize && ship.y < 22 * world.tileSize && leaf.scaleX < 0.35 && barrier.visible;
  }, undefined, WAIT);
  expect(await page.evaluate(() => {
    const { npcs, world } = window.__race;
    const s = world.tileSize;
    return [...npcs].some(v => !v.destroyed && v.x > 21 * s && v.x < 27 * s && v.y > 20 * s && v.y < 22 * s);
  })).toBe(false);
  await page.evaluate(() => {
    const { players, world, scene } = window.__race;
    const s = world.tileSize;
    scene.matter.body.setPosition(players[0].body, { x: 19.8 * s, y: 21 * s });
    scene.matter.body.setAngle(players[0].body, 0);
  });
  await page.waitForFunction(() => {
    const { camera, world } = window.__race;
    const v = camera.worldView(0);
    return v.y < 21 * world.tileSize && v.y + v.h > 21 * world.tileSize;
  }, undefined, WAIT);
  const raised = info.outputPath('harbor-drawbridge.png');
  await page.screenshot({ path: raised });
  await info.attach('harbor-drawbridge', { path: raised, contentType: 'image/png' });
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
  const grade = () => page.evaluate(() => (window.__race.scene.children.getByName('harbor-sunset') as Phaser.GameObjects.Image).alpha);
  await page.evaluate(() => { window.__race.elapsedSec = 120; });
  await expect.poll(grade).toBeGreaterThan(0.2);
  expect(await grade()).toBeLessThan(0.48);
  await page.evaluate(() => { window.__race.elapsedSec = 180; });
  await expect.poll(grade).toBe(0.48);
  expect(errors).toEqual([]);
});

test('Beach & Harbor has varied beachgoers and flattened sandcastles reset off-screen', async ({ page }) => {
  await page.goto('/?race=2&map=harbor&seed=3&questions=off');
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.2, undefined, WAIT);
  const castlePosition = await page.evaluate(() => {
    const { players, scene, world } = window.__race;
    const s = world.tileSize;
    const castles = scene.children.list.filter(obj => obj.name === 'harbor-sandcastle') as Phaser.GameObjects.Image[];
    const castle = castles.find(obj => obj.x > 34 * s && obj.x < 39 * s && obj.y > 16 * s && obj.y < 20 * s)!;
    scene.matter.body.setPosition(players[0].body, { x: castle.x - 95, y: castle.y });
    scene.matter.body.setAngle(players[0].body, 0);
    scene.matter.body.setVelocity(players[0].body, { x: 0, y: 0 });
    players[0].applyImpulse(145, 0);
    scene.matter.body.setPosition(players[1].body, { x: castle.x, y: castle.y + 220 });
    return { x: castle.x, y: castle.y };
  });
  const flat = ({ x, y }: { x: number; y: number }) => (window.__race.scene.children.list as Phaser.GameObjects.Image[]).some(obj =>
    obj.name === 'harbor-sandcastle' && obj.x === x && obj.y === y && obj.texture.key === 'harbor_sandcastle-flat');
  await page.keyboard.down('KeyW');
  try { await page.waitForFunction(flat, castlePosition, WAIT); }
  finally { await page.keyboard.up('KeyW'); }
  const styles = await page.evaluate(() => [...new Set(window.__race.scene.children.list.filter(obj => obj.name === 'harbor-beachgoer')
    .map(obj => (obj as Phaser.GameObjects.Image).texture.key))]);
  expect(styles.some(style => style.startsWith('harbor_life_person'))).toBe(true);
  expect(styles.some(style => style.startsWith('harbor_life_swimmer'))).toBe(true);
  expect(styles.length).toBeGreaterThan(2);
  const leave = (player: number) => page.evaluate(i => {
    const { players, scene } = window.__race;
    scene.matter.body.setPosition(players[i].body, { x: 760 + i * 100, y: 820 });
    scene.matter.body.setVelocity(players[i].body, { x: 0, y: 0 });
  }, player);
  await leave(0);
  expect(await page.evaluate(flat, castlePosition)).toBe(true);
  await leave(1);
  await expect.poll(() => page.evaluate(flat, castlePosition)).toBe(false);
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
