import type Phaser from 'phaser';
import { expect, test } from '@playwright/test';
import { POLICE, TRAFFIC } from '../../src/config/gameConfig';
import { TEX } from '../../src/core/assetKeys';
import type { GameSystem } from '../../src/core/race';
import type { PlayerCar } from '../../src/entities/PlayerCar';
import type { TrafficCar } from '../../src/entities/TrafficCar';

test('player cruiser flashes and civilian traffic stops until it passes', async ({ page }) => {
  await page.goto('/?race=1&seed=3&questions=off');
  await page.waitForFunction(() => window.__race?.npcs.size);
  const result = await page.evaluate(({ frames, flashSec, yieldRadius, resumeRadius }) => {
    const race = window.__race;
    const player = race.players[0] as PlayerCar;
    const civilian = [...race.npcs].find((npc): npc is TrafficCar => 'follow' in npc)!;
    const lamps = civilian.view.getByName('traffic-brake-lights') as Phaser.GameObjects.Image;
    const initial = {
      spec: player.spec, position: { x: player.x, y: player.y },
      angle: player.angle, texture: player.chassis.texture.key,
    };
    // Place the cruiser behind the traffic car so ordinary following cannot trigger its brakes.
    const policePosition = (distance: number) => ({
      x: civilian.x - Math.cos(civilian.angle) * distance,
      y: civilian.y - Math.sin(civilian.angle) * distance,
    });
    for (const npc of [...race.npcs]) if (npc !== civilian) npc.destroy();
    const rng = race.rng.fork(1);
    civilian.update(0, race, rng);
    const before = civilian.forwardSpeed;
    const initialPosition = policePosition(yieldRadius - 10);
    player.replaceChassis({ ...initial, texture: frames[0], position: initialPosition });
    const first = player.chassis.texture.key;
    player.update({ throttle: 0, brake: 0, steer: 0 } as Parameters<PlayerCar['update']>[0], flashSec);
    const second = player.chassis.texture.key;
    for (let i = 0; i < 90; i++) civilian.update(1 / 60, race, rng);
    const stopped = civilian.forwardSpeed;
    const stoppedLamps = lamps.visible;
    race.scene.matter.body.setPosition(player.body, policePosition((yieldRadius + resumeRadius) / 2));
    civilian.update(1 / 60, race, rng);
    const heldLamps = lamps.visible;
    race.scene.matter.body.setPosition(player.body, policePosition(resumeRadius + 10));
    civilian.update(1 / 60, race, rng);
    const resumed = civilian.forwardSpeed;
    const resumedLamps = lamps.visible;
    player.replaceChassis(initial);
    const glow = player.view.getByName('player-police-light-glow') as Phaser.GameObjects.Image;
    return { first, second, before, stopped, stoppedLamps, heldLamps, resumed, resumedLamps, hasGlow: glow.visible };
  }, {
    frames: TEX.police, flashSec: POLICE.lightFlashSec,
    yieldRadius: TRAFFIC.policeYieldRadius, resumeRadius: TRAFFIC.policeResumeRadius,
  });
  expect(result.first).toBe(TEX.police[0]);
  expect(result.second).toBe(TEX.police[1]);
  expect(result.before).toBeGreaterThan(30);
  expect(result.stopped).toBeLessThan(5);
  expect(result.stoppedLamps).toBe(true);
  expect(result.heldLamps).toBe(true);
  expect(result.resumed).toBeGreaterThan(result.stopped);
  expect(result.resumedLamps).toBe(false);
  expect(result.hasGlow).toBe(false);
});

test('queue relief only removes traffic outside both camera views', async ({ page }) => {
  await page.goto('/?race=2&seed=3&questions=off');
  await page.waitForFunction(() => (window.__race?.npcs.size ?? 0) >= 2);
  const result = await page.evaluate((jamClearAfterSec) => {
    const race = window.__race;
    const [visible, hidden] = [...race.npcs].filter((npc): npc is TrafficCar => 'follow' in npc);
    const scene = race.scene as unknown as { systems: (GameSystem & { relieveJam(): void })[] };
    const traffic = scene.systems.find((system) => system.name === 'traffic')!;
    // Fix the camera bounds to make the oldest jam visible to P2 alone.
    const originalView = race.camera.worldView;
    race.camera.worldView = (player) => player === 0
      ? { x: 0, y: 0, w: 500, h: 500 }
      : { x: 2000, y: 2000, w: 500, h: 500 };
    try {
      visible.setPose(2250, 2250, 0);
      hidden.setPose(3500, 3500, 0);
      visible.queuedSec = jamClearAfterSec + 2;
      hidden.queuedSec = jamClearAfterSec + 1;
      traffic.relieveJam();
    } finally {
      race.camera.worldView = originalView;
    }
    return { visibleRemains: race.npcs.has(visible), hiddenRemoved: !race.npcs.has(hidden) };
  }, TRAFFIC.jamClearAfterSec);
  expect(result).toEqual({ visibleRemains: true, hiddenRemoved: true });
});
