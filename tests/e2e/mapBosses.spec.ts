import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import { DINO, DINO_LASER, DINO_RIDE } from '../../src/config/gameConfig';
import type { RaceContext } from '../../src/core/race';
import type { PoliceCar } from '../../src/entities/PoliceCar';

type BossWindow = Window & { __race: RaceContext; __dinoDefeat?: () => void; swarmPolice?: PoliceCar[] };
const WAIT = { timeout: 25_000 };

for (const [map, bossName, beamKey] of [
  ['harbor', 'octopus', 'octopus_beam'],
  ['industrial', 'factory-robot', 'factory_robot_beam'],
  ['farm', 'giant-chicken', 'giant_chicken_beam'],
  ['sky', 'thundercloud', 'thundercloud_beam'],
  ['forest', 'walking-tree', 'walking_tree_beam'],
  ['underwater', 'landshark', 'landshark_beam'],
] as const) {
  test(`${bossName} fires twin lasers and can be ridden for 20 seconds`, async ({ page }) => {
    await page.goto(`/?race=1&map=${map}&seed=3&questions=off&dino=now&laser=now`);
    await page.waitForFunction(({ name, ready }) => {
      const race = (window as BossWindow).__race;
      return race?.dino.active && race.elapsedSec >= ready && !!race.scene.children.getByName(name);
    }, { name: bossName, ready: DINO.devSpawnDelaySec + DINO.dropSec }, WAIT);
    await page.evaluate(() => {
      const { world, scene, players, dino } = (window as BossWindow).__race;
      const lane = world.laneGraph.nodes.find((node) => {
        const distance = Math.hypot(node.x - dino.x, node.y - dino.y);
        return distance > 570 && distance < 750;
      })!;
      scene.matter.body.setPosition(players[0].body, lane);
      scene.matter.body.setVelocity(players[0].body, { x: 0, y: 0 });
    });
    await page.waitForFunction(({ key, minHeight }) => {
      const { scene } = (window as BossWindow).__race;
      return scene.children.list.filter((child) => {
        const beam = child as Phaser.GameObjects.Image;
        return beam.texture?.key === key && beam.visible && beam.displayHeight > minHeight;
      }).length === 2;
    }, { key: beamKey, minHeight: DINO_LASER.drawWidth * 0.8 }, WAIT);
    await page.evaluate(() => {
      const game = window as BossWindow;
      const { scene, players, dino } = game.__race;
      game.__dinoDefeat!();
      scene.matter.body.setPosition(players[0].body, { x: dino.x - 210, y: dino.y });
      scene.matter.body.setVelocity(players[0].body, { x: 0, y: 0 });
    });
    await page.keyboard.press('KeyB', { delay: 55 });
    await page.waitForFunction(() => (window as BossWindow).__race.dino.rider === 0, undefined, WAIT);
    expect(await page.evaluate(() => (window as BossWindow).__race.dino.rideTotalSec)).toBe(DINO_RIDE.durationSec);
  });
}

test('the boss ride calls in police who drive away when the ride ends', async ({ page }) => {
  await page.goto('/?race=1&seed=3&questions=off&dino=now&dinoride=1');
  await page.waitForFunction((ready) => {
    const race = (window as BossWindow).__race;
    return race?.dino.active && race.elapsedSec >= ready;
  }, DINO.devSpawnDelaySec + DINO.dropSec, WAIT);
  await page.evaluate(() => {
    const game = window as BossWindow;
    const { scene, players, dino } = game.__race;
    game.__dinoDefeat!();
    scene.matter.body.setPosition(players[0].body, { x: dino.x - 210, y: dino.y });
    scene.matter.body.setVelocity(players[0].body, { x: 0, y: 0 });
  });
  await page.keyboard.press('KeyB', { delay: 55 });
  await page.waitForFunction(() => {
    const game = window as BossWindow;
    if (game.__race.dino.rider !== 0) return false;
    game.swarmPolice = [...game.__race.npcs].filter((car): car is PoliceCar =>
      car.npcKind === 'police' && (car as PoliceCar).mode === 'chase');
    return game.swarmPolice.length >= 3;
  }, undefined, WAIT);
  await expect.poll(() => page.evaluate(() => {
    const { swarmPolice, __race } = window as BossWindow;
    return {
      rider: __race.dino.rider ?? null,
      droveAway: swarmPolice!.some((car) => car.mode === 'leave'),
      cars: swarmPolice!.map((car) => ({ mode: car.mode, destroyed: car.destroyed })),
    };
  }), WAIT).toMatchObject({ rider: null, droveAway: true });
  await page.waitForFunction(() => (window as BossWindow).swarmPolice!.every((car) => car.destroyed), undefined, WAIT);
});
