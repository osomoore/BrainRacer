import { test } from '@playwright/test';
import type Phaser from 'phaser';
import { QUEUED_MAPS } from '../../src/config/queuedMaps';
import { DINO } from '../../src/config/gameConfig';
import { TEX } from '../../src/core/assetKeys';
import { WORLD_VEHICLES } from '../../src/config/collectibles';
import type { RaceContext } from '../../src/core/race';

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
        && [...race.npcs].some(npc => traffic.includes(npc.appearanceKey));
    }, { map, boss: bossNames[i], ready: DINO.devSpawnDelaySec + DINO.dropSec, traffic: WORLD_VEHICLES[map].map(id => TEX.unlockVehicles[id]) }, WAIT);
    if (flagship) await page.screenshot({ path: info.outputPath(`${map}.png`) });
  });
}

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
