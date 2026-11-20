import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import { DINO, DINO_RIDE } from '../../src/config/gameConfig';
import { TEX } from '../../src/core/assetKeys';

const WAIT = { timeout: 35_000 };

test('Underground runs a split-screen race with lava bridges and moving mine carts', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?race=2&map=underground&seed=3&questions=off');
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.2, undefined, WAIT);
  const track = await page.evaluate(() => {
    const { scene, settings, camera, world } = window.__race;
    const cart = scene.children.getByName('underground-mine-cart') as Phaser.GameObjects.Image | null;
    return { map: settings.map, mode: camera.layout().mode, goals: world.places.length,
      engines: scene.children.list.filter(child => child.name === 'underground-mine-engine').length,
      couplers: scene.children.list.filter(child => child.name === 'underground-mine-coupler').length,
      wagons: scene.children.list.filter(child => child.name === 'underground-mine-cart').length,
      bridge: !!scene.children.getByName('underground-lava-bridge'), cart: cart && { x: cart.x, y: cart.y } };
  });
  expect(track).toMatchObject({ map: 'underground', mode: 'split', bridge: true });
  expect(track.engines).toBeGreaterThan(1);
  expect(track.wagons).toBe(track.engines * 2);
  expect(track.couplers).toBe(track.wagons);
  expect(track.goals).toBeGreaterThan(2);
  expect(track.cart).toBeTruthy();
  await page.waitForFunction(start => {
    const cart = window.__race.scene.children.getByName('underground-mine-cart') as Phaser.GameObjects.Image;
    return Math.hypot(cart.x - start.x, cart.y - start.y) > 40;
  }, track.cart!, { timeout: 20_000 });
  const screenshot = info.outputPath('underground.png');
  await page.screenshot({ path: screenshot });
  await info.attach('Underground split view', { path: screenshot, contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('Underground replaces the dino with a rideable rock monster', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?race=1&map=underground&seed=3&questions=off&dino=now');
  await page.waitForFunction(time => {
    const race = window.__race;
    return race?.elapsedSec > time && race.dino.active && !!race.scene.children.getByName('rock-monster');
  }, DINO.devSpawnDelaySec + DINO.dropSec + 0.25, WAIT);
  await page.evaluate(() => {
    const { scene, players, dino, world } = window.__race;
    const distance = (p: { x: number; y: number }) => Math.hypot(p.x - dino.x, p.y - dino.y);
    const near = world.laneGraph.nodes.filter(p => distance(p) > 135);
    const lane = near.reduce((best, p) => distance(p) < distance(best) ? p : best);
    const body = scene.matter.body;
    body.setPosition(players[0].body, { x: lane.x, y: lane.y });
    body.setAngle(players[0].body, Math.atan2(dino.y - lane.y, dino.x - lane.x));
    body.setVelocity(players[0].body, { x: 0, y: 0 });
    (window as Window & { __dinoDefeat?: () => void }).__dinoDefeat!();
  });
  await page.waitForFunction(() => window.__race.dino.tamed, undefined, WAIT);
  const screenshot = info.outputPath('rock-monster.png');
  await page.screenshot({ path: screenshot });
  await info.attach('Rock monster encounter', { path: screenshot, contentType: 'image/png' });
  await page.keyboard.press('KeyB', { delay: 60 });
  await page.waitForFunction(() => window.__race.dino.rider === 0, undefined, WAIT);
  expect(await page.evaluate(() => window.__race.players[0].spec.maxSpeed)).toBe(DINO_RIDE.spec.maxSpeed);
  expect(errors).toEqual([]);
});

test('five cave vehicles spawn and a boarded crusher breaks an ore crate', async ({ page }) => {
  await page.goto('/?race=1&map=underground&seed=3&questions=off');
  const { caveBuggy, crystalRunner, surveyRover, oreHauler, rockCrusher } = TEX.underground;
  await page.waitForFunction(keys => {
    if (!(window.__race?.elapsedSec > 0.4)) return false;
    const active = new Set([...window.__race.npcs].filter(npc => !npc.destroyed).map(npc => npc.appearanceKey));
    return keys.every(key => active.has(key));
  }, [caveBuggy, crystalRunner, surveyRover, oreHauler, rockCrusher], WAIT);
  const expected = await page.evaluate(key => {
    const { scene, players, npcs, world } = window.__race;
    const crusher = [...npcs].find(npc => !npc.destroyed && npc.appearanceKey === key)!;
    for (const npc of npcs) if (npc !== crusher) npc.destroy();
    const body = scene.matter.body, size = world.tileSize;
    body.setPosition(players[0].body, { x: 10 * size, y: 9.65 * size });
    body.setPosition(crusher.body, { x: 10 * size + 120, y: 9.65 * size });
    body.setVelocity(players[0].body, { x: 0, y: 0 });
    body.setAngle(crusher.body, 0);
    body.setVelocity(crusher.body, { x: 0, y: 0 });
    return { spec: crusher.spec, starterSpeed: players[0].spec.maxSpeed, starterLength: players[0].spec.length };
  }, rockCrusher);
  expect(expected.spec.maxSpeed).toBeLessThan(expected.starterSpeed);
  expect(expected.spec.length).toBeGreaterThan(expected.starterLength);
  await page.keyboard.press('KeyB', { delay: 60 });
  await page.waitForTimeout(80);
  await page.keyboard.press('KeyB', { delay: 60 });
  await page.waitForFunction(key => window.__race.players[0].chassis.texture.key === key, rockCrusher, WAIT);
  expect(await page.evaluate(() => window.__race.players[0].spec)).toEqual(expected.spec);
  const crateId = await page.evaluate(() => {
    const { scene, players, world } = window.__race;
    const crate = scene.matter.world.getAllBodies().find(b => b.label === 'underground-ore-crate')!;
    const body = scene.matter.body, car = players[0], size = world.tileSize;
    const x = 15.5 * size, y = 9.66 * size;
    body.setPosition(crate, { x, y });
    body.setVelocity(crate, { x: 0, y: 0 });
    body.setPosition(car.body, { x: x - car.spec.length / 2 - 35, y });
    body.setAngle(car.body, 0);
    body.setVelocity(car.body, { x: 2.2, y: 0 });
    return crate.id;
  });
  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction(id => !window.__race.scene.matter.world.getAllBodies().some(body => body.id === id), crateId, WAIT);
  } finally { await page.keyboard.up('KeyW'); }
});

test('the bomb stays upright and its fuse follows the art in both rotated views', async ({ page }) => {
  await page.goto('/?race=2&seed=3&questions=off&bomb=now');
  await page.waitForFunction(() => !!window.__race?.scene.children.getByName('homing-bomb-view-2'), undefined, { timeout: 35_000 });
  await page.evaluate(() => {
    const { scene, players } = window.__race;
    scene.matter.body.setAngle(players[1].body, players[1].angle + Math.PI / 2);
  });
  await page.waitForFunction(() => {
    const { scene, camera } = window.__race;
    if (Math.abs(camera.viewRotation(0) - camera.viewRotation(1)) < 0.45) return false;
    const filters: number[] = [];
    for (const player of [0, 1] as const) {
      const suffix = player === 0 ? '' : '-view-2';
      const sprite = scene.children.getByName(`homing-bomb${suffix}`) as Phaser.GameObjects.Image | null;
      const glow = scene.children.getByName(`homing-bomb-fuse${suffix}`) as Phaser.GameObjects.Image | null;
      if (!sprite || !glow || Math.cos(sprite.rotation + camera.viewRotation(player)) < 0.99995) return false;
      const center = camera.worldToScreen(player, sprite.x, sprite.y);
      const fuse = camera.worldToScreen(player, glow.x, glow.y);
      if (fuse.x <= center.x || fuse.y >= center.y || sprite.cameraFilter !== glow.cameraFilter) return false;
      filters.push(sprite.cameraFilter);
    }
    return filters[0] !== filters[1] && filters.every(Boolean);
  }, undefined, { timeout: 15_000 });
});
