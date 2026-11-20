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

test('queue relief prioritizes the longest waits and protects both camera views', async ({ page }) => {
  await page.goto('/?race=2&seed=3&questions=off');
  await page.waitForFunction(() => (window.__race?.npcs.size ?? 0) >= 13);
  const result = await page.evaluate(({ jamClearAfterSec, batchSize }) => {
    const race = window.__race;
    const [visibleP1, visibleP2, recent, ...queued] = [...race.npcs]
      .filter((npc): npc is TrafficCar => 'follow' in npc).slice(0, 13);
    const scene = race.scene as unknown as { systems: (GameSystem & { relieveJam(): void })[] };
    const traffic = scene.systems.find((system) => system.name === 'traffic')!;
    const originalView = race.camera.worldView;
    race.camera.worldView = (player) => player === 0
      ? { x: 0, y: 0, w: 500, h: 500 }
      : { x: 2000, y: 2000, w: 500, h: 500 };
    try {
      visibleP1.setPose(250, 250, 0);
      visibleP2.setPose(2250, 2250, 0);
      visibleP1.queuedSec = visibleP2.queuedSec = jamClearAfterSec + 20;
      recent.setPose(3500, 3500, 0);
      recent.queuedSec = jamClearAfterSec - 1;
      queued.forEach((car, i) => {
        car.setPose(3500 + i * 85, 3500, 0);
        car.queuedSec = jamClearAfterSec + i;
      });
      const removed = () => queued.flatMap((car, i) => race.npcs.has(car) ? [] : [i]);
      const removedByCheck = Array.from({ length: Math.ceil(queued.length / batchSize) }, () => {
        traffic.relieveJam();
        return removed();
      });
      return { removedByCheck, protected: [visibleP1, visibleP2, recent].every(car => race.npcs.has(car)) };
    } finally {
      race.camera.worldView = originalView;
    }
  }, { jamClearAfterSec: TRAFFIC.jamClearAfterSec, batchSize: TRAFFIC.jamClearBatchSize });
  expect(result).toEqual({
    removedByCheck: [[7, 8, 9], [4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
    protected: true,
  });
});

test('a civilian yielding to a parked cruiser is recycled after a continuous off-screen wait', async ({ page }) => {
  await page.goto('/?race=2&seed=3&questions=off');
  await page.waitForFunction(() => (window.__race?.npcs.size ?? 0) >= 2);
  const result = await page.evaluate(({ cruiser, yieldRadius, jamClearAfterSec, jamCheckIntervalSec }) => {
    const race = window.__race;
    const player = race.players[0] as PlayerCar;
    const civilian = [...race.npcs].find((npc): npc is TrafficCar => 'follow' in npc)!;
    const scene = race.scene as unknown as { systems: GameSystem[] };
    const traffic = scene.systems.find((system) => system.name === 'traffic')!;
    const position = { x: player.x + yieldRadius + 80, y: player.y };
    civilian.setPose(position.x, position.y, 0);
    player.replaceChassis({
      spec: player.spec, texture: cruiser, angle: 0,
      position: { x: position.x - yieldRadius + 20, y: position.y },
    });

    const originalView = race.camera.worldView;
    let visibleToP2 = true;
    race.camera.worldView = (p) => p === 1 && visibleToP2
      ? { x: position.x - 250, y: position.y - 250, w: 500, h: 500 }
      : { x: position.x - 1200, y: position.y - 1200, w: 500, h: 500 };
    const step = (seconds: number) => {
      for (let i = 0; i < Math.round(seconds * 60); i++) traffic.update(1 / 60, race);
    };
    try {
      step(jamClearAfterSec + jamCheckIntervalSec);
      const heldVisible = race.npcs.has(civilian) && civilian.isYieldingToPolice;
      visibleToP2 = false;
      step(jamClearAfterSec - 0.5);
      const heldInitiallyOffscreen = race.npcs.has(civilian);
      visibleToP2 = true;
      step(0.5);
      visibleToP2 = false;
      step(jamClearAfterSec - 0.5);
      const heldAfterReappearing = race.npcs.has(civilian);
      const before = new Set(race.npcs);
      step(jamCheckIntervalSec + 1);
      const replacement = [...race.npcs].some(npc => !before.has(npc) && 'follow' in npc);
      return { heldVisible, heldInitiallyOffscreen, heldAfterReappearing, removed: !race.npcs.has(civilian), replacement };
    } finally {
      race.camera.worldView = originalView;
    }
  }, { cruiser: TEX.police[0], yieldRadius: TRAFFIC.policeYieldRadius,
    jamClearAfterSec: TRAFFIC.jamClearAfterSec, jamCheckIntervalSec: TRAFFIC.jamCheckIntervalSec });
  expect(result).toEqual({
    heldVisible: true, heldInitiallyOffscreen: true, heldAfterReappearing: true, removed: true, replacement: true,
  });
});
