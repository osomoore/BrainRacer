import { expect, test } from '@playwright/test';
import { WORLD_VEHICLES } from '../../src/config/collectibles';
import { TEX } from '../../src/core/assetKeys';

test('Dark Forest runs themed traffic and a logging train with flashing crossings', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?race=1&map=forest&seed=3&questions=off');
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.25, undefined, { timeout: 35_000 });

  const forest = await page.evaluate(() => {
    const { scene, settings } = window.__race;
    const bodies = scene.matter.world.getAllBodies();
    const railway = bodies.filter(body => body.label.startsWith('forest-logging-'));
    const traffic = bodies.flatMap(body => {
      const owner = body.plugin?.owner;
      return owner?.kind === 'npc' && owner.npc.npcKind === 'traffic' ? [owner.npc.appearanceKey] : [];
    });
    return {
      map: settings.map,
      train: railway.map(body => body.label),
      hasTrainCollision: railway.every(body => body.isStatic && !body.isSensor && body.collisionFilter.mask !== 0),
      traffic: [...new Set(traffic)].sort(),
      hasHeadlight: !!scene.children.getByName('forest-headlight-0'),
      crossings: scene.children.list.filter(child => child.name === 'forest-logging-crossing').length,
      start: railway.find(body => body.label === 'forest-logging-engine')?.position,
    };
  });
  expect(forest.map).toBe('forest');
  expect(forest.train.sort()).toEqual(['forest-logging-engine', ...[1, 2, 3].map(i => `forest-logging-wagon-${i}`)]);
  expect(forest.hasTrainCollision).toBe(true);
  expect(forest.hasHeadlight).toBe(true);
  expect(forest.crossings).toBeGreaterThan(0);
  expect(forest.traffic.length).toBeGreaterThan(1);
  expect(WORLD_VEHICLES.forest.map(id => TEX.unlockVehicles[id])).toEqual(expect.arrayContaining(forest.traffic));

  await page.waitForFunction(start => {
    const engine = window.__race.scene.matter.world.getAllBodies().find(body => body.label === 'forest-logging-engine');
    return engine && Math.hypot(engine.position.x - start.x, engine.position.y - start.y) > 50;
  }, forest.start!, { timeout: 10_000 });
  await page.waitForFunction(() => window.__race.scene.children.list.some(child =>
    child.name === 'forest-logging-crossing' && (child as Phaser.GameObjects.Image).texture.key === 'forest-rail-crossing-lit',
  ), undefined, { timeout: 20_000 });
  await page.screenshot({ path: info.outputPath('dark-forest.png') });
  expect(errors).toEqual([]);
});
