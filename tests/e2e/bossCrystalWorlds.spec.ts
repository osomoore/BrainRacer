import { expect, test } from '@playwright/test';
import { DINO } from '../../src/config/gameConfig';
import type { RaceContext } from '../../src/core/race';

type CrystalWindow = Window & { __race: RaceContext; __dinoDefeat?: () => void };
const WAIT = { timeout: 25_000 };
const SHOTS = process.env.BRAINRACER_SHOTS_DIR;

const MAPS = [
  'city', 'industrial', 'harbor', 'underground', 'farm', 'sky', 'forest', 'underwater',
  'brickworks', 'mushroom', 'tundra', 'volcano', 'candy', 'castle', 'airport', 'house',
] as const;

for (const map of MAPS) {
  test(`${map}: crystal, both players ride, rider lasers, clean finish`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/?race=2&map=${map}&seed=3&questions=off&dino=now&dinoride=2`);
    await page.waitForFunction((ready) => {
      const race = (window as CrystalWindow).__race;
      return race?.dino.active && race.elapsedSec > ready;
    }, DINO.devSpawnDelaySec + DINO.dropSec + 0.2, WAIT);
    await page.evaluate(() => {
      const game = window as CrystalWindow;
      game.__dinoDefeat!();
      const { scene, players, dino } = game.__race;
      players.forEach((car, i) => {
        scene.matter.body.setPosition(car.body, { x: dino.x + (i ? 260 : -260), y: dino.y + 40 });
        scene.matter.body.setVelocity(car.body, { x: 0, y: 0 });
      });
    });
    await page.waitForFunction(() => (window as CrystalWindow).__race.dino.tamed === true, undefined, WAIT);
    if (SHOTS) { // screenshots only when asked: wait past the DEFEATED banner first
      await page.waitForTimeout(3200);
      await page.screenshot({ path: `${SHOTS}/crystal-${map}.png` });
    }

    await page.keyboard.press('KeyB', { delay: 60 });
    await page.waitForFunction(() => (window as CrystalWindow).__race.dino.riders?.includes(0), undefined, WAIT);
    expect(await page.evaluate(() => (window as CrystalWindow).__race.dino.claimedBy)).toBe(0);
    await page.keyboard.press('KeyN', { delay: 60 });
    await page.waitForFunction(() => (window as CrystalWindow).__race.dino.riders?.length === 2, undefined, WAIT);
    await page.keyboard.press('KeyB');
    await page.keyboard.press('KeyN');
    if (SHOTS) {
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${SHOTS}/riders-${map}.png` });
    }

    await page.waitForFunction(() => {
      const { players, dino } = (window as CrystalWindow).__race;
      return !players[0].riding && !players[1].riding && !dino.active && !dino.riders?.length;
    }, undefined, { timeout: 30_000 });
    expect(errors).toEqual([]);
  });
}
