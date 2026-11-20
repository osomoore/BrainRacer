import { expect, test, type Page } from '@playwright/test';
import { installGamepadMock, tapPad } from './gamepadMock';

const unlocks = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('brainracer.unlocks.v1') ?? '[]') as string[]);

async function waitScene(page: Page, key: string) {
  await page.waitForFunction(name => window.__game?.scene.isActive(name), key);
}

async function tap(page: Page, key: string) {
  await page.keyboard.press(key, { delay: 65 });
  await page.waitForTimeout(65);
}

async function finishRound(page: Page) {
  await page.waitForFunction(() => window.__race?.elapsedSec > 0);
  await page.evaluate(() => { window.__race.elapsedSec = window.__race.roundLengthSec; });
  await waitScene(page, 'Results');
  await page.waitForTimeout(1300);
}

const raceLoadouts = (page: Page) => page.evaluate(() => window.__race.settings.players.map((player, slot) => ({
  car: window.__race.players[slot].kind,
  guide: player.guide,
})));

test('map completion grants one unlock and Confirm advances to a different map', async ({ page }) => {
  await page.goto('/?race=1&seed=3&questions=off');
  await waitScene(page, 'Race');
  const startingUnlocks = await unlocks(page);
  expect(startingUnlocks).toHaveLength(1);
  expect(await page.evaluate(() => window.__race.settings.map)).toBe('city');

  await finishRound(page);
  const after = await unlocks(page);
  expect(after).toHaveLength(2);
  expect(after).toContain(startingUnlocks[0]);

  await tap(page, 'Space');
  await waitScene(page, 'Race');
  expect(await page.evaluate(() => window.__race.settings.map)).not.toBe('city');
  expect(await unlocks(page)).toEqual(after);
});

test('both players can use the same collection after a solo map and a reload', async ({ page }) => {
  await installGamepadMock(page, 2);
  await page.addInitScript(() => {
    const key = 'brainracer.unlocks.v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(['owl']));
  });
  await page.goto('/?race=1&seed=50&questions=off');
  await waitScene(page, 'Race');
  await finishRound(page);
  await expect.poll(() => unlocks(page)).toEqual(['owl', 'towTruck']);

  await tap(page, 'KeyD'); // Results → Setup.
  await tap(page, 'Space');
  await waitScene(page, 'Setup');
  await tapPad(page, 0, 13); // Car.
  await tapPad(page, 0, 14); // Wrap from Dino to the new Tow Truck.
  await tapPad(page, 0, 13); // Guide.
  await tapPad(page, 0, 15); // Star → Night Owl.
  await tapPad(page, 0, 0);
  await waitScene(page, 'Race');
  expect(await raceLoadouts(page)).toEqual([{ car: 'towTruck', guide: 'owl' }]);

  await page.goto('/?seed=4&questions=off');
  await waitScene(page, 'Title');
  await tapPad(page, 0, 0);
  await tapPad(page, 1, 0);
  await page.waitForTimeout(800);
  await tapPad(page, 0, 0);
  await waitScene(page, 'Setup');
  expect(await unlocks(page)).toEqual(['owl', 'towTruck']);

  await tapPad(page, 1, 13); // P2 Car.
  await tapPad(page, 1, 14); // Dino → Tow Truck, already equipped by P1.
  await tapPad(page, 1, 13); // P2 Guide.
  await tapPad(page, 1, 15); // Star → Night Owl, already equipped by P1.
  await tapPad(page, 1, 0);
  await waitScene(page, 'Race');
  expect(await raceLoadouts(page)).toEqual([{ car: 'towTruck', guide: 'owl' }, { car: 'towTruck', guide: 'owl' }]);

  await finishRound(page);
  expect(await unlocks(page)).toHaveLength(3);
  await tap(page, 'KeyD'); // Results → Setup.
  await tap(page, 'Space');
  await waitScene(page, 'Setup');
  await tapPad(page, 1, 13); // P2 Car.
  await tapPad(page, 1, 15); // Wrap from Tow Truck to Dino for P2 only.
  await tapPad(page, 1, 0);
  await waitScene(page, 'Race');
  expect(await raceLoadouts(page)).toEqual([{ car: 'towTruck', guide: 'owl' }, { car: 'dino', guide: 'owl' }]);
});

test('Developer Mode previews and plays locked loadouts without granting completion rewards', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('brainracer.unlocks.v1', JSON.stringify(['owl'])));
  await page.goto('/?questions=off');
  await waitScene(page, 'Title');
  await tap(page, 'Space');
  await page.waitForTimeout(700);
  await tap(page, 'Space');
  await waitScene(page, 'Setup');

  const toggleDeveloperMode = async (scene: string) => {
    await tap(page, 'F9');
    await page.waitForFunction(name => window.__game.scene.isPaused(name), scene);
    for (let i = 0; i < 8; i++) await tap(page, 'KeyS');
    await tap(page, 'KeyD');
    await tap(page, 'Space');
    await waitScene(page, scene);
  };
  await toggleDeveloperMode('Setup');
  await tap(page, 'KeyS'); // Car.
  await tap(page, 'KeyD');
  await tap(page, 'KeyD'); // Motor Trike.
  await tap(page, 'KeyS'); // Guide.
  await tap(page, 'KeyD');
  await tap(page, 'KeyD'); // Bumblebee, since non-Dino cars default to the star.
  await tap(page, 'Space');
  await waitScene(page, 'Race');
  expect(await page.evaluate(() => ({
    round: window.__race.roundLengthSec,
    car: window.__race.players[0].kind,
    guide: window.__race.settings.players[0].guide,
    guideVisible: window.__race.scene.children.list.some(o => 'texture' in o && (o.texture as { key: string }).key === 'buddy_bumblebee'),
  }))).toEqual({ round: 60, car: 'motorTrike', guide: 'bumblebee', guideVisible: true });

  await finishRound(page);
  expect(await unlocks(page)).toEqual(['owl']);
  await toggleDeveloperMode('Results');
  await tap(page, 'KeyD'); // Setup lets players manually choose the next map.
  await tap(page, 'Space');
  await waitScene(page, 'Setup');
  await tap(page, 'KeyW'); // Start.
  await tap(page, 'KeyW'); // Map.
  await tap(page, 'KeyD'); // Factory.
  await tap(page, 'Space');
  await waitScene(page, 'Race');
  expect(await page.evaluate(() => ({
    map: window.__race.settings.map,
    round: window.__race.roundLengthSec,
    car: window.__race.players[0].kind,
    guide: window.__race.settings.players[0].guide,
  }))).toEqual({ map: 'industrial', round: 300, car: 'dino', guide: 'dino' });
});
