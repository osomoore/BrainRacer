import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import { GUIDE } from '../../src/config/gameConfig';
import { TEX } from '../../src/core/assetKeys';
import type { RaceContext } from '../../src/core/race';
import type { Rect, Vec2 } from '../../src/core/types';

type RaceWindow = Window & { __race?: RaceContext };

function goalRingInView(center: Vec2, radius: number, view: Rect): boolean {
  const dx = Math.max(view.x - center.x, 0, center.x - (view.x + view.w));
  const dy = Math.max(view.y - center.y, 0, center.y - (view.y + view.h));
  return Math.hypot(dx, dy) <= radius;
}

async function parkKartByTheFountain(page: Page, x: number, angle: number) {
  await page.goto('/?race=2&seed=3&questions=off');
  await page.waitForFunction(() => (window as RaceWindow).__race);
  await page.evaluate(({ x, angle }) => {
    const race = (window as RaceWindow).__race!;
    const fountain = race.world.places.find(({ front }) => front.x === 2240 && front.y === 448)!;
    race.world.places.splice(0, race.world.places.length, fountain);
    // On this stretch the nearest traffic lane heads away from the fountain.
    const car = race.players[1];
    car.setGhost(true); // Isolate the guide from traffic bumps while the kart turns in place.
    race.scene.matter.body.setPosition(car.body, { x, y: 416 });
    race.scene.matter.body.setAngle(car.body, angle);
  }, { x, angle });
  await page.waitForFunction(() => ((window as RaceWindow).__race?.elapsedSec ?? 0) > 1);
}

test('the kart guide leads up and right toward a clipped destination ring', async ({ page }) => {
  await parkKartByTheFountain(page, 1408, -Math.PI / 4);
  const { car, star, goal, view, nominalRadius, ringRadius } = await page.evaluate(({ starKey, ringKey }) => {
    const race = (window as RaceWindow).__race!;
    const car = race.players[1];
    const images = race.scene.children.list as Phaser.GameObjects.Image[];
    const guide = images.find((obj) => obj.texture?.key === starKey && obj.visible)!;
    const ring = images.find((obj) => obj.texture?.key === ringKey)!;
    const goal = race.goal!;
    const project = ({ x, y }: { x: number; y: number }) => race.camera.worldToScreen(1, x, y);
    const screen = project(goal);
    const screenRadius = (radius: number) => {
      const rim = project({ x: goal.x + radius, y: goal.y });
      return Math.hypot(rim.x - screen.x, rim.y - screen.y);
    };
    return {
      car: project(car), star: project(guide), goal: screen, view: race.camera.layout().playerViews[1],
      nominalRadius: screenRadius(goal.radius), ringRadius: screenRadius(ring.displayWidth / 2),
    };
  }, { starKey: TEX.buddyStar, ringKey: TEX.goalRing });

  const distanceFromView = Math.hypot(goal.x - view.x - view.w, goal.y - view.y);
  expect(goal.x).toBeGreaterThan(view.x + view.w);
  expect(goal.y).toBeLessThan(view.y);
  expect(distanceFromView).toBeGreaterThan(nominalRadius);
  expect(distanceFromView).toBeLessThan(ringRadius);
  expect(goal.y).toBeLessThan(car.y);
  expect(star.x).toBeGreaterThan(car.x);
  expect(star.y).toBeLessThan(car.y);
});

test('turning toward a clipped goal keeps the kart guide aligned and moving smoothly', async ({ page }, testInfo) => {
  await parkKartByTheFountain(page, 1280, -Math.PI / 2);
  const frames = await page.evaluate(({ starKey, ringKey }) => {
    const race = (window as RaceWindow).__race!;
    const car = race.players[1];
    const images = race.scene.children.list as Phaser.GameObjects.Image[];
    const guide = images.find((obj) => obj.texture?.key === starKey && obj.visible)!;
    const ring = images.find((obj) => obj.texture?.key === ringKey)!;
    const goal = race.goal!;
    const view = race.camera.layout().playerViews[1];
    const project = ({ x, y }: { x: number; y: number }) => race.camera.worldToScreen(1, x, y);
    const sample = () => {
      const star = project(guide);
      const kart = project(car);
      const center = project(goal);
      const rim = project({ x: goal.x + ring.displayWidth / 2, y: goal.y });
      return {
        elapsed: race.elapsedSec,
        car: { x: car.x, y: car.y },
        guide: { x: guide.x, y: guide.y },
        offset: { x: star.x - kart.x, y: star.y - kart.y },
        goalOffset: { x: center.x - kart.x, y: center.y - kart.y },
        ring: { center, radius: Math.hypot(rim.x - center.x, rim.y - center.y), view },
      };
    };

    return new Promise<ReturnType<typeof sample>[]>((resolve) => {
      const samples = [sample()];
      const start = race.elapsedSec;
      let turned = false;
      const capture = () => {
        samples.push(sample());
        const elapsed = race.elapsedSec - start;
        if (!turned && elapsed >= 0.2) {
          // Change the heading while parked. The real camera eases through the turn.
          race.scene.matter.body.setAngle(car.body, -Math.PI / 4);
          turned = true;
        }
        if (elapsed >= 1.5) {
          race.scene.events.off('postupdate', capture);
          resolve(samples);
        }
      };
      race.scene.events.on('postupdate', capture);
    });
  }, { starKey: TEX.buddyStar, ringKey: TEX.goalRing });

  const steps = frames.slice(1).map((frame, i) => ({
    from: frames[i],
    to: frame,
    distance: Math.hypot(frame.guide.x - frames[i].guide.x, frame.guide.y - frames[i].guide.y),
  }));
  const largest = steps.reduce((a, b) => a.distance > b.distance ? a : b);
  const telemetry = testInfo.outputPath('guide-turn-frames.json');
  await writeFile(telemetry, JSON.stringify({ largest, frames }, null, 2));
  await testInfo.attach('guide-turn-frames', { path: telemetry, contentType: 'application/json' });

  const { ring } = frames[0];
  expect(goalRingInView(ring.center, ring.radius, ring.view)).toBe(false);
  expect(frames.some(({ ring }) => goalRingInView(ring.center, ring.radius, ring.view))).toBe(true);
  const carTravel = Math.max(...frames.map(({ car }) => Math.hypot(car.x - frames[0].car.x, car.y - frames[0].car.y)));
  expect(carTravel).toBeLessThan(1);
  const maxAngleError = Math.max(...frames.map(({ offset, goalOffset }) => {
    const cross = offset.x * goalOffset.y - offset.y * goalOffset.x;
    const dot = offset.x * goalOffset.x + offset.y * goalOffset.y;
    return Math.atan2(Math.abs(cross), dot);
  }));
  // Allow the star to bob around the ray to the goal.
  expect(maxAngleError).toBeLessThan(5 * Math.PI / 180);

  // Flight caps the step at 1/30 s. Allow the full range of the sprite's hover bob on top.
  const maxStep = GUIDE.maxSpeed / 30 + 3 * GUIDE.bobAmp;
  const { from, to, distance } = largest;
  expect(distance, `Guide moved ${distance.toFixed(1)} world px in one frame. Screen offset: (${from.offset.x.toFixed(0)}, ${from.offset.y.toFixed(0)}) to (${to.offset.x.toFixed(0)}, ${to.offset.y.toFixed(0)}).`)
    .toBeLessThanOrEqual(maxStep);
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
