import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import { TEX } from '../../src/core/assetKeys';
import type { RaceContext } from '../../src/core/race';

type RaceWindow = Window & { __race?: RaceContext };

test('the kart guide leads up and right toward a clipped destination ring', async ({ page }) => {
  await page.goto('/?race=2&seed=3');
  await page.waitForFunction(() => (window as RaceWindow).__race);
  await page.evaluate(() => {
    const race = (window as RaceWindow).__race!;
    const fountain = race.world.places.find(({ front }) => front.x === 2240 && front.y === 448)!;
    race.world.places.splice(0, race.world.places.length, fountain);
    // On this stretch the nearest traffic lane heads away from the fountain.
    const car = race.players[1].body;
    race.scene.matter.body.setPosition(car, { x: 1408, y: 416 });
    race.scene.matter.body.setAngle(car, -Math.PI / 4);
  });
  await page.waitForFunction(() => ((window as RaceWindow).__race?.elapsedSec ?? 0) > 1);
  const { car, star, goal, view, nominalRadius, ringRadius } = await page.evaluate((starKey) => {
    const race = (window as RaceWindow).__race!;
    const car = race.players[1];
    const guide = (race.scene.children.list as Phaser.GameObjects.Image[])
      .find((obj) => obj.texture?.key === starKey && obj.visible)!;
    const goal = race.goal!;
    const project = ({ x, y }: { x: number; y: number }) => race.camera.worldToScreen(1, x, y);
    const screen = project(goal);
    const screenRadius = (radius: number) => {
      const rim = project({ x: goal.x + radius, y: goal.y });
      return Math.hypot(rim.x - screen.x, rim.y - screen.y);
    };
    return {
      car: project(car), star: project(guide), goal: screen, view: race.camera.layout().playerViews[1],
      nominalRadius: screenRadius(goal.radius), ringRadius: screenRadius(goal.ringRadius!),
    };
  }, TEX.buddyStar);

  const distanceFromView = Math.hypot(goal.x - view.x - view.w, goal.y - view.y);
  expect(goal.x).toBeGreaterThan(view.x + view.w);
  expect(goal.y).toBeLessThan(view.y);
  expect(distanceFromView).toBeGreaterThan(nominalRadius);
  expect(distanceFromView).toBeLessThan(ringRadius);
  expect(goal.y).toBeLessThan(car.y);
  expect(star.x).toBeGreaterThan(car.x);
  expect(star.y).toBeLessThan(car.y);
});

test('single-player team score and timer share a top-left panel', async ({ page }) => {
  await page.goto('/?race=1&seed=3');
  await page.waitForFunction(() => (window as RaceWindow).__race?.scene.scene.isActive('Hud'));
  const scoreboard = await page.evaluate(() => {
    const race = (window as RaceWindow).__race!;
    const hud = race.scene.scene.get('Hud');
    const panel = (hud.children.list as Phaser.GameObjects.Container[]).find((obj) =>
      obj.type === 'Container' && obj.list.some((child) => (child as Phaser.GameObjects.Text).text === 'TEAM'),
    )!;
    return { x: panel.x, y: panel.y, content: panel.list.map((child) => (child as Phaser.GameObjects.Text).text) };
  });
  expect(scoreboard.x).toBeLessThan(300);
  expect(scoreboard.y).toBeLessThan(30);
  expect(scoreboard.content.some((text) => /^\d{2}:\d{2}$/.test(text))).toBe(true);
});
