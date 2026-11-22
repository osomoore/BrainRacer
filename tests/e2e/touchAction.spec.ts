import { expect, test, type Page } from '@playwright/test';
import { DINO, DINO_RIDE, VEHICLE_CONDITION } from '../../src/config/gameConfig';
import type { RaceContext } from '../../src/core/race';

test.use({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });

type W = Window & { __race: RaceContext; __dinoDefeat?: () => void };
const WAIT = { timeout: 25_000 };
const SHOTS = process.env.ACTION_SHOTS;

async function tap(page: Page, btn: string) {
  const b = await page.locator(`.bt-b[data-btn="${btn}"]`).boundingBox();
  if (!b) throw new Error(`button ${btn} not visible`);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

async function start(page: Page, query = '') {
  await page.goto(`/racer.html?race=1&input=touch&seed=3&questions=off${query}`);
  await page.waitForSelector('.bt-b[data-btn="act"].show', { timeout: 30_000 });
}

test('action button does not overlap the other race buttons', async ({ page }) => {
  await start(page);
  const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
  for (const b of ['left', 'right', 'brake', 'act', 'pause', 'reset']) boxes[b] = (await page.locator(`.bt-b[data-btn="${b}"]`).boundingBox())!;
  expect(boxes.act.height).toBeGreaterThan(412 * 0.18);
  const hit = (a: typeof boxes.act, c: typeof boxes.act) => a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height;
  for (const o of ['left', 'right', 'brake', 'pause', 'reset']) expect(hit(boxes.act, boxes[o]), `act vs ${o}`).toBe(false);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/action-driving.png` });
});

test('tap the action button: ride the beaten boss, then it stays a laser button', async ({ page }) => {
  await start(page, '&dino=now&dinoride=10');
  await page.waitForFunction((ready) => (window as W).__race?.dino.active && (window as W).__race.elapsedSec > ready, DINO.devSpawnDelaySec + DINO.dropSec + 0.2, WAIT);
  await page.evaluate(() => (window as W).__dinoDefeat!());
  await page.waitForFunction(() => (window as W).__race.dino.tamed === true, undefined, WAIT);
  // Park the car in reach of the crystal.
  await page.evaluate((range) => {
    const { scene, players, dino } = (window as W).__race;
    const car = players[0];
    scene.matter.body.setPosition(car.body, { x: dino.x - Math.sin(dino.angle) * range, y: dino.y + Math.cos(dino.angle) * range });
    scene.matter.body.setVelocity(car.body, { x: 0, y: 0 });
  }, DINO_RIDE.boardReach + VEHICLE_CONDITION.transferReach - 40);
  await expect(page.locator('.bt-b[data-btn="act"]')).toHaveClass(/pulse/, WAIT);
  expect(await page.locator('.bt-b[data-btn="act"]').getAttribute('data-mode')).toBe('ride');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/action-available.png` });
  await tap(page, 'act');
  await page.waitForFunction(() => (window as W).__race.dino.riders?.includes(0), undefined, WAIT);
  await expect(page.locator('.bt-b[data-btn="act"]')).toHaveAttribute('data-mode', 'laser', WAIT);
  await expect(page.locator('.bt-b[data-btn="act"]')).not.toHaveClass(/pulse/);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/action-riding.png` });
  // Tapping while riding must not end the ride (it fires the laser instead).
  await tap(page, 'act');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as W).__race.dino.riders?.includes(0))).toBe(true);
});

test('tapping the action button twice next to a parked/traffic car switches into it', async ({ page }) => {
  await start(page);
  await page.waitForFunction(() => (window as W).__race.npcs.size > 0 && (window as W).__race.players[0].forwardSpeed > 50, undefined, WAIT);
  const before = await page.evaluate(() => {
    const { scene, players, npcs } = (window as W).__race;
    const car = players[0], npc = [...npcs][0];
    scene.matter.body.setVelocity(car.body, { x: 0, y: 0 });
    scene.matter.body.setPosition(npc.body, { x: car.x + Math.cos(car.angle) * 120, y: car.y + Math.sin(car.angle) * 120 });
    scene.matter.body.setVelocity(npc.body, { x: 0, y: 0 });
    return npc.appearanceKey as string;
  });
  await tap(page, 'act');
  await page.waitForTimeout(150);
  await tap(page, 'act');
  await page.waitForFunction((key) => (window as W).__race.players[0].chassis.texture.key === key, before, WAIT);
});
