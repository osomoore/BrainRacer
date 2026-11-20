import { expect, test, type Page } from '@playwright/test';
import { DINO, DINO_RIDE, VEHICLE_CONDITION } from '../../src/config/gameConfig';
import type { RaceContext } from '../../src/core/race';

type RideWindow = Window & { __race: RaceContext; __dinoDefeat?: () => void };
const WAIT = { timeout: 20_000 };

async function startAndTame(page: Page, query: string): Promise<void> {
  await page.goto(`/?race=1&seed=3&questions=off&dino=now${query}`);
  await page.waitForFunction((ready) => {
    const race = (window as RideWindow).__race;
    return race?.dino.active && race.elapsedSec > ready;
  }, DINO.devSpawnDelaySec + DINO.dropSec + 0.2, WAIT);
  await page.evaluate(() => (window as RideWindow).__dinoDefeat!());
  await page.waitForFunction(() => (window as RideWindow).__race.dino.tamed === true, undefined, WAIT);
}

test('beaten dino can be boarded, ridden over everything, and returns the player to a car', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await startAndTame(page, '&dinoride=8');

  // Put a traffic vehicle closer than the dino, which is beyond the old 150px reach.
  // One B press must still choose the dino from the expanded range.
  const distance = DINO_RIDE.boardReach + VEHICLE_CONDITION.transferReach - 35;
  expect(distance).toBeGreaterThan(150 + VEHICLE_CONDITION.transferReach);
  await page.waitForFunction(() => (window as RideWindow).__race.npcs.size > 0, undefined, WAIT);
  await page.evaluate((range) => {
    const { scene, players, dino, npcs } = (window as RideWindow).__race;
    const car = players[0], npc = [...npcs][0];
    const x = dino.x - Math.sin(dino.angle) * range, y = dino.y + Math.cos(dino.angle) * range;
    scene.matter.body.setPosition(car.body, { x, y });
    scene.matter.body.setVelocity(car.body, { x: 0, y: 0 });
    scene.matter.body.setPosition(npc.body, { x: x + 80, y });
    scene.matter.body.setVelocity(npc.body, { x: 0, y: 0 });
  }, distance);
  await page.keyboard.press('KeyB', { delay: 60 });
  await page.waitForFunction(() => (window as RideWindow).__race.dino.rider === 0, undefined, WAIT);

  const riding = await page.evaluate(() => {
    const { players, dino } = (window as RideWindow).__race;
    const car = players[0];
    return {
      riding: car.riding, visible: car.view.visible, mask: car.body.collisionFilter.mask,
      maxSpeed: car.spec.maxSpeed, tamed: dino.tamed, left: dino.rideLeftSec, x: car.x, y: car.y,
      onDino: Math.hypot(car.x - dino.x, car.y - dino.y),
    };
  });
  expect(riding.riding).toBe(true);
  expect(riding.visible).toBe(false);
  expect(riding.mask).toBe(0); // walks over buildings, props and fences
  expect(riding.maxSpeed).toBe(DINO_RIDE.spec.maxSpeed);
  expect(riding.tamed).toBe(false); // nobody else can board now
  expect(riding.left).toBeGreaterThan(5);
  expect(riding.onDino).toBeLessThan(5);

  // the HUD countdown shows for the rider
  await page.waitForFunction(() => {
    const hud = (window as RideWindow).__race.scene.scene.get('Hud');
    const card = hud?.children.getByName('dino-ride-countdown') as { visible?: boolean } | null;
    return !!card?.visible;
  }, undefined, WAIT);

  // Repeated transfer and reset presses cannot cut the ride short.
  await page.keyboard.press('KeyB');
  await page.keyboard.press('KeyB');
  await page.keyboard.press('KeyR');
  await page.keyboard.press('KeyR');
  expect(await page.evaluate(() => {
    const { players, dino } = (window as RideWindow).__race;
    return players[0].riding && dino.rider === 0 && (dino.rideLeftSec ?? 0) > 0;
  })).toBe(true);

  // Wait for movement rather than relying on the old, faster speed and a fixed delay.
  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction((start) => {
      const { dino } = (window as RideWindow).__race;
      return Math.hypot(dino.x - start.x, dino.y - start.y) > 20;
    }, riding, WAIT);
  } finally {
    await page.keyboard.up('KeyW');
  }

  // ride runs out → back in a car (visible, colliding again), the dino poofs
  await page.waitForFunction(() => {
    const { players } = (window as RideWindow).__race;
    return !players[0].riding && !players[0].boardingPosition;
  }, undefined, WAIT);
  const after = await page.evaluate(() => {
    const car = (window as RideWindow).__race.players[0];
    return { visible: car.view.visible, mask: car.body.collisionFilter.mask, maxSpeed: car.spec.maxSpeed };
  });
  expect(after.visible).toBe(true);
  expect(after.mask).not.toBe(0);
  expect(after.maxSpeed).not.toBe(DINO_RIDE.spec.maxSpeed);
  await page.waitForFunction(() => !(window as RideWindow).__race.dino.active, undefined, WAIT);
  expect(errors).toEqual([]);
});

test('a tame dino nobody boards poofs after the window', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await startAndTame(page, '');
  await page.waitForFunction(() => !(window as RideWindow).__race.dino.active, undefined, { timeout: (DINO_RIDE.tameSec + 10) * 1000 });
  const st = await page.evaluate(() => ({ ...(window as RideWindow).__race.dino, riding: (window as RideWindow).__race.players[0].riding }));
  expect(st.tamed).toBe(false);
  expect(st.rider ?? null).toBeNull();
  expect(st.riding).toBe(false);
  expect(errors).toEqual([]);
});
