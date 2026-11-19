import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import { DEPTH, DINO, FREIGHT_TRUCK_SPEC } from '../../src/config/gameConfig';
import { TEX } from '../../src/core/assetKeys';
import type { RaceContext } from '../../src/core/race';

const WAIT = { timeout: 20_000 };

test('Industrial freight rigs can be thrown clear of the dino in a comic toss', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?race=1&map=industrial&seed=3&questions=off&dino=now');
  await page.waitForFunction(({ ready, truckKey }) => {
    const { __race: race } = window as Window & { __race: RaceContext };
    return race?.dino.active && race.elapsedSec > ready && [...race.npcs].some((npc) => npc.appearanceKey === truckKey);
  }, { ready: DINO.devSpawnDelaySec + DINO.dropSec + DINO.graceSec + 0.25, truckKey: TEX.freightTruck }, WAIT);

  const rig = await page.evaluate((truckKey) => {
    const { scene, dino, npcs } = (window as Window & { __race: RaceContext }).__race;
    const truck = [...npcs].find((npc) => npc.appearanceKey === truckKey)!;
    const x = dino.x - Math.sin(dino.angle) * 55;
    const y = dino.y + Math.cos(dino.angle) * 55;
    const body = scene.matter.body;
    body.setPosition(truck.body, { x, y });
    body.setVelocity(truck.body, { x: 0, y: 0 });
    return { id: truck.body.id, length: truck.spec.length, width: truck.spec.width, x, y };
  }, TEX.freightTruck);
  expect(rig.length).toBe(FREIGHT_TRUCK_SPEC.length);
  expect(rig.width).toBe(FREIGHT_TRUCK_SPEC.width);

  await page.waitForFunction(({ rig, truckKey, fxDepth }) => {
    const { scene, npcs } = (window as Window & { __race: RaceContext }).__race;
    const flying = scene.children.list.find((child): child is Phaser.GameObjects.Image => {
      const image = child as Phaser.GameObjects.Image;
      return image.texture?.key === truckKey && image.depth === fxDepth;
    });
    return ![...npcs].some((npc) => npc.body.id === rig.id) && flying?.visible
      && flying.displayWidth > rig.length && Math.hypot(rig.x - flying.x, rig.y - flying.y) > 60;
  }, { rig, truckKey: TEX.freightTruck, fxDepth: DEPTH.fx }, WAIT);
  await page.waitForFunction(({ truckKey, fxDepth }) => {
    const { scene } = (window as Window & { __race: RaceContext }).__race;
    return !scene.children.list.some((child) => {
      const image = child as Phaser.GameObjects.Image;
      return image.texture?.key === truckKey && image.depth === fxDepth;
    });
  }, { truckKey: TEX.freightTruck, fxDepth: DEPTH.fx }, WAIT);
  expect(errors).toEqual([]);
});

test('the dino throws a close slow player into a jump that lands', async ({ page }) => {
  await page.goto('/?race=1&seed=3&questions=off&dino=now');
  await page.waitForFunction((ready) => {
    const { __race: race } = window as Window & { __race: RaceContext };
    return race?.dino.active && race.elapsedSec > ready;
  }, DINO.devSpawnDelaySec + DINO.dropSec + DINO.graceSec + 0.25, WAIT);

  const origin = await page.evaluate(() => {
    const { scene, players, dino } = (window as Window & { __race: RaceContext }).__race;
    const car = players[0];
    const x = dino.x - Math.sin(dino.angle) * 65;
    const y = dino.y + Math.cos(dino.angle) * 65;
    scene.matter.body.setPosition(car.body, { x, y });
    scene.matter.body.setVelocity(car.body, { x: 0, y: 0 });
    return { x, y };
  });
  await page.waitForFunction(({ x, y }) => {
    const car = (window as Window & { __race: RaceContext }).__race.players[0];
    return car.airborne && Math.hypot(car.x - x, car.y - y) > 70;
  }, origin, WAIT);
  await page.waitForFunction(() => !(window as Window & { __race: RaceContext }).__race.players[0].airborne, undefined, WAIT);
});
