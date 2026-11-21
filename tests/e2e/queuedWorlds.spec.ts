import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import { QUEUED_MAPS } from '../../src/config/queuedMaps';
import { CAT, DINO, QUEUED_FEATURES } from '../../src/config/gameConfig';
import { TEX } from '../../src/core/assetKeys';
import { WORLD_VEHICLES } from '../../src/config/collectibles';
import type { RaceContext } from '../../src/core/race';
import { installGamepadMock, setPad } from './gamepadMock';

type TestWindow = Window & { __race: RaceContext };
const WAIT = { timeout: 30_000 };
const bossNames = ['puff-golem', 'spore-queen', 'yeti', 'lava-monster', 'killer-cone', 'wooden-horse', 'giant-helicopter', 'house-cat'];

for (const [i, map] of QUEUED_MAPS.entries()) {
  test(`${map} starts with themed traffic, a moving feature and its boss`, async ({ page }, info) => {
    const flagship = map === 'brickworks' || map === 'mushroom';
    if (flagship) await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/?race=${flagship ? 2 : 1}&map=${map}&seed=3&questions=off&dino=now`);
    await page.waitForFunction(({ map, boss, ready, traffic }) => {
      const race = (window as TestWindow).__race;
      return race?.settings.map === map && race.elapsedSec >= ready
        && race.goal && race.dino.active && race.scene.children.getByName(boss)
        && race.scene.children.getByName('queued-mover-0')
        && race.scene.children.getByName(`queued-weather-${map}`)
        && traffic.every(key => race.scene.textures.exists(key))
        && [...race.npcs].some(npc => traffic.includes(npc.appearanceKey));
    }, { map, boss: bossNames[i], ready: DINO.devSpawnDelaySec + DINO.dropSec, traffic: WORLD_VEHICLES[map].map(id => TEX.unlockVehicles[id]) }, WAIT);
    if (map in QUEUED_FEATURES.rail) {
      const train = await page.evaluate(() => {
        const { scene } = (window as TestWindow).__race;
        return scene.matter.world.getAllBodies().filter(body => body.label.startsWith('queued-mover-')).map(body => {
          const sprite = scene.children.getByName(body.label) as Phaser.GameObjects.Image;
          return {
            owner: body.plugin?.owner?.kind,
            static: body.isStatic,
            sensor: body.isSensor,
            mask: body.collisionFilter.mask,
            aligned: Math.hypot(sprite.x - body.position.x, sprite.y - body.position.y) < 0.01,
          };
        });
      });
      expect(train).toHaveLength(QUEUED_FEATURES.rail[map as keyof typeof QUEUED_FEATURES.rail].count);
      for (const car of train) expect(car).toEqual({
        owner: 'train', static: true, sensor: false, mask: CAT.player | CAT.traffic | CAT.police, aligned: true,
      });
    }
    if (flagship) await page.screenshot({ path: info.outputPath(`${map}.png`) });
  });
}

test('Brickworks wagons collide and derail under turbo', async ({ page }) => {
  await page.goto('/?race=1&map=brickworks&seed=3&questions=off');
  await page.waitForFunction(() => (window as TestWindow).__race?.elapsedSec > 0.5, undefined, WAIT);
  const hitWagon = (turbo: boolean) => {
    const { scene, players } = (window as TestWindow).__race;
    const { world, body } = scene.matter;
    const wagon = world.getAllBodies().find(candidate => candidate.label === 'queued-mover-1')!;
    const car = players[0];
    const nx = -Math.sin(wagon.angle), ny = Math.cos(wagon.angle);
    car.setTurbo(turbo);
    body.setPosition(car.body, { x: wagon.position.x + nx * 52, y: wagon.position.y + ny * 52 });
    body.setAngle(car.body, Math.atan2(-ny, -nx));
    body.setVelocity(car.body, { x: -nx * 3.8, y: -ny * 3.8 });
    return new Promise<boolean>(resolve => {
      const hit = ({ pairs }: { pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] }) => {
        if (pairs.some(({ bodyA, bodyB }) => (bodyA === wagon && bodyB === car.body) || (bodyB === wagon && bodyA === car.body))) finish(true);
      };
      const finish = (collided: boolean) => {
        world.off('collisionstart', hit);
        clearTimeout(timeout);
        resolve(collided);
      };
      const timeout = setTimeout(() => finish(false), 4000);
      world.on('collisionstart', hit);
    });
  };
  expect(await page.evaluate(hitWagon, false)).toBe(true);
  expect(await page.evaluate(() => {
    const { scene, players } = (window as TestWindow).__race;
    const wagon = scene.matter.world.getAllBodies().find(body => body.label === 'queued-mover-1')!;
    scene.matter.body.setPosition(players[0].body, { x: wagon.position.x, y: wagon.position.y - 180 });
    return wagon.collisionFilter.mask;
  })).toBe(CAT.player | CAT.traffic | CAT.police);
  // Step once off the body so the turbo approach creates a fresh collision pair.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(hitWagon, true)).toBe(true);
  await page.waitForFunction(() => {
    const { scene } = (window as TestWindow).__race;
    const bodies = scene.matter.world.getAllBodies();
    return bodies.some(body => body.label === 'queued-mover-0' && body.collisionFilter.mask)
      && bodies.filter(body => /^queued-mover-[12]-debris$/.test(body.label) && !body.isStatic).length === 2;
  }, undefined, WAIT);
});

test('the volcano warning closes an empty shortcut and the eruption subsides', async ({ page }) => {
  await page.goto('/?race=1&map=volcano&seed=3&questions=off&feature=now');
  const gateMatches = (closed: boolean) => {
    const scene = (window as TestWindow).__race?.scene;
    const eruption = scene?.children.getByName('queued-volcano-eruption') as Phaser.GameObjects.Image | undefined;
    const blocked = scene?.matter.world.getAllBodies().some(body => body.label === 'queued-gate-volcano');
    return eruption?.visible === closed && blocked === closed;
  };
  await page.waitForFunction(gateMatches, true, WAIT);
  await page.waitForFunction(gateMatches, false, WAIT);
});

test('Mushroom Island raises both bridge leaves and lowers them again', async ({ page }) => {
  await page.goto('/?race=1&map=mushroom&seed=3&questions=off&feature=now');
  const bridgeMatches = (raised: boolean) => {
    const race = (window as TestWindow).__race;
    if (!race || race.elapsedSec < 0.5) return false;
    const leaves = race.scene.children.getAll('name', 'queued-bridge-leaf') as Phaser.GameObjects.Image[];
    const blocked = race.scene.matter.world.getAllBodies().some(body => body.label === 'queued-gate-mushroom');
    if (leaves.length !== 2 || blocked !== raised) return false;
    const fullWidth = race.world.tileSize / 2;
    return leaves.every(leaf => raised ? leaf.displayWidth < fullWidth * .5 : leaf.displayWidth === fullWidth);
  };
  await page.waitForFunction(bridgeMatches, false, WAIT);
  await page.waitForFunction(bridgeMatches, true, WAIT);
  await page.waitForFunction(bridgeMatches, false, WAIT);
});

test('two drivers leave tracks in the snow as a Tundra front travels', async ({ page }, info) => {
  await installGamepadMock(page, 2);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?race=2&map=tundra&seed=3&questions=off');
  await page.waitForFunction(() => (window as TestWindow).__race?.elapsedSec > 0.5, undefined, WAIT);
  const start = await page.evaluate(() => {
    const { scene, players, npcs } = (window as TestWindow).__race;
    for (const npc of npcs) npc.destroy();
    return {
      frontX: (scene.children.getByName('queued-weather-tundra') as Phaser.GameObjects.Image).x,
      lanes: players.map(car => car.y),
    };
  });
  await setPad(page, 0, { buttons: { 7: 1 } });
  await setPad(page, 1, { buttons: { 7: 1 } });
  await page.waitForFunction(({ frontX, lanes }) => {
    const { scene } = (window as TestWindow).__race;
    const front = scene.children.getByName('queued-weather-tundra') as Phaser.GameObjects.Image;
    const tracks = scene.children.getAll('name', 'tundra-snow-track') as Phaser.GameObjects.Image[];
    return Math.abs(front.x - frontX) > 60
      && lanes.every(y => tracks.filter(mark => mark.visible && Math.abs(mark.y - y) < 32).length >= 4);
  }, start, WAIT);
  await setPad(page, 0, { buttons: { 7: 0 } });
  await setPad(page, 1, { buttons: { 7: 0 } });
  await page.screenshot({ path: info.outputPath('snow-tracks.png') });
});
