import { expect, test } from '@playwright/test';
import { WORLD_VEHICLES } from '../../src/config/collectibles';
import { TEX } from '../../src/core/assetKeys';
import { Tile } from '../../src/core/types';

test('Dark Forest runs themed traffic and two spaced logging trains with flashing crossings', async ({ page }, info) => {
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
      engines: railway.filter(body => body.label.startsWith('forest-logging-engine'))
        .map(body => ({ label: body.label, position: body.position })),
    };
  });
  expect(forest.map).toBe('forest');
  const firstTrain = ['forest-logging-engine', ...[1, 2, 3].map(i => `forest-logging-wagon-${i}`)];
  expect(forest.train.sort()).toEqual([...firstTrain, ...firstTrain.map(label => `${label}-2`)].sort());
  expect(forest.hasTrainCollision).toBe(true);
  expect(forest.hasHeadlight).toBe(true);
  expect(forest.crossings).toBeGreaterThan(0);
  expect(forest.traffic.length).toBeGreaterThan(1);
  expect(WORLD_VEHICLES.forest.map(id => TEX.unlockVehicles[id])).toEqual(expect.arrayContaining(forest.traffic));

  await page.waitForFunction(starts => {
    const bodies = window.__race.scene.matter.world.getAllBodies();
    const engines = starts.map(start => bodies.find(body => body.label === start.label)!);
    return engines.every(({ position }, i) =>
      Math.hypot(position.x - starts[i].position.x, position.y - starts[i].position.y) > 50);
  }, forest.engines, { timeout: 10_000 });
  const spacing = await page.evaluate(starts => {
    const bodies = window.__race.scene.matter.world.getAllBodies();
    const [a, b] = starts.map(start => bodies.find(body => body.label === start.label)!.position);
    // Half-lap offsets on this symmetric circuit keep the midpoint fixed as both engines travel.
    return {
      midpointShift: Math.hypot(a.x + b.x - starts[0].position.x - starts[1].position.x,
        a.y + b.y - starts[0].position.y - starts[1].position.y) / 2,
      separation: Math.hypot(a.x - b.x, a.y - b.y),
    };
  }, forest.engines);
  expect(spacing.midpointShift).toBeLessThan(1);
  expect(spacing.separation).toBeGreaterThan(3000);
  await page.waitForFunction(() => window.__race.scene.children.list.some(child =>
    child.name === 'forest-logging-crossing' && (child as Phaser.GameObjects.Image).texture.key === 'forest-rail-crossing-lit',
  ), undefined, { timeout: 20_000 });
  await page.screenshot({ path: info.outputPath('dark-forest.png') });
  expect(errors).toEqual([]);
});

test('a Dark Forest shrub scatters on contact and resets after both players leave', async ({ page }) => {
  await page.goto('/?race=2&map=forest&seed=3&questions=off');
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.25, undefined, { timeout: 35_000 });
  const shrub = await page.evaluate(({ road, sidewalk }) => {
    const { players, scene, world } = window.__race;
    const shrubs = scene.children.list.filter(o => o.name === 'forest-bramble') as Phaser.GameObjects.Image[];
    const { tiles, tileSize, widthTiles } = world;
    const tileAt = (x: number, y: number) => tiles[y * widthTiles + x];
    for (const [index, { x, y, rotation, displayWidth }] of shrubs.entries()) {
      if (x < 2300 || y < 2300) continue;
      const tx = Math.floor(x / tileSize), ty = Math.floor(y / tileSize);
      if (tileAt(tx, ty) !== sidewalk) continue;
      const approach = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => tileAt(tx + dx, ty + dy) === road);
      if (!approach) continue;
      const [dx, dy] = approach;
      const { body } = scene.matter;
      body.setPosition(players[0].body, { x: x + dx * 85, y: y + dy * 85 });
      body.setAngle(players[0].body, Math.atan2(-dy, -dx));
      body.setVelocity(players[0].body, { x: 0, y: 0 });
      body.setPosition(players[1].body, { x: x + dx * 180, y: y + dy * 180 });
      return { index, x, y, rotation, displayWidth };
    }
    throw new Error('Seed 3 has no eligible roadside shrub');
  }, { road: Tile.Road, sidewalk: Tile.Sidewalk });
  expect(shrub.displayWidth).toBeGreaterThan(115);

  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction(({ index, x, y }) => {
      const image = window.__race.scene.children.list.filter(o => o.name === 'forest-bramble')[index] as Phaser.GameObjects.Image;
      return Math.hypot(image.x - x, image.y - y) > 25;
    }, shrub, { timeout: 10_000 });
  } finally {
    await page.keyboard.up('KeyW');
  }

  const leave = (i: number) => page.evaluate(player => {
    const { players, scene } = window.__race;
    scene.matter.body.setPosition(players[player].body, { x: 590 + player * 100, y: 590 });
    scene.matter.body.setVelocity(players[player].body, { x: 0, y: 0 });
  }, i);
  await leave(0);
  await page.waitForTimeout(750);
  expect(await page.evaluate(({ index, rotation }) => {
    const image = window.__race.scene.children.list.filter(o => o.name === 'forest-bramble')[index] as Phaser.GameObjects.Image;
    return image.rotation !== rotation;
  }, shrub)).toBe(true);
  await leave(1);
  await page.waitForFunction(({ index, x, y, rotation }) => {
    const image = window.__race.scene.children.list.filter(o => o.name === 'forest-bramble')[index] as Phaser.GameObjects.Image;
    return image.x === x && image.y === y && image.rotation === rotation;
  }, shrub, { timeout: 10_000 });
});
