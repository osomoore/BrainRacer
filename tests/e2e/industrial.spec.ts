import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { RaceContext } from '../../src/core/race';
import type { IndustrialDecoration, PlayerId, RaceMap } from '../../src/core/types';
import { installGamepadMock } from './gamepadMock';

declare global {
  interface Window {
    __game: Phaser.Game;
    __race: RaceContext;
  }
}

test.use({ viewport: { width: 1920, height: 1080 } });

const WAIT = { timeout: 15_000 };
const THROTTLE = ['KeyW', 'ArrowUp'] as const;
const STEER_OUTWARD = ['KeyD', 'ArrowLeft'] as const;

async function waitScene(page: Page, key: string) {
  await page.waitForFunction((scene) => window.__game?.scene.isActive(scene), key, WAIT);
}

async function waitForGo(page: Page) {
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.25, undefined, WAIT);
}

async function openSetup(page: Page) {
  await waitScene(page, 'Title');
  await page.keyboard.press('Space');
  await page.waitForTimeout(800); // Title allows time for a second player to join.
  await page.keyboard.press('Space');
  await waitScene(page, 'Setup');
}

async function chooseNextMap(page: Page, key: 'KeyD' | 'KeyA' = 'KeyD') {
  // Player one's cursor opens on Difficulty. Map is four rows below it.
  for (let row = 0; row < 4; row++) {
    await page.keyboard.press('KeyS', { delay: 55 });
    await page.waitForTimeout(55);
  }
  await page.keyboard.press(key);
}

async function assertMap(page: Page, map: RaceMap) {
  await waitScene(page, 'Race');
  const state = await page.evaluate(() => {
    const { scene, settings, world } = window.__race;
    return {
      map: settings.map,
      industrialLayout: !!world.industrial,
      crossing: !!scene.children.getByName('industrial-crossing-signal-0'),
      headlight: !!scene.children.getByName('industrial-headlight-0'),
    };
  });
  const industrial = map === 'industrial';
  expect(state).toEqual({ map, industrialLayout: industrial, crossing: industrial, headlight: industrial });
}

test('legacy settings start in City and Setup can switch to Industrial and back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installGamepadMock(page, 0);
  await page.addInitScript(() => {
    localStorage.setItem('brainracer.settings.v1', JSON.stringify({ challengeMode: 'off' }));
  });
  await page.goto('/');
  await openSetup(page);
  await page.keyboard.press('Space');
  await assertMap(page, 'city');

  for (const map of ['industrial', 'city'] as const) {
    await waitForGo(page);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__race.paused, undefined, WAIT);
    await page.keyboard.press('KeyW', { delay: 80 }); // Wrap from Resume to Quit to Title.
    await page.keyboard.press('Space');
    await openSetup(page);
    await chooseNextMap(page, map === 'city' ? 'KeyA' : 'KeyD'); // Map row: City, Factory, Farm
    await page.keyboard.press('Space');
    await assertMap(page, map);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('brainracer.settings.v1')!).map)).toBe(map);
  }
  expect(errors).toEqual([]);
});

type Direction = -1 | 1;
type Drive = { player: PlayerId; x: number; y: number; targetX: number; direction: Direction };

function bridgeDrive(
  bridge: IndustrialDecoration, player: PlayerId, direction: Direction, exit: IndustrialDecoration = bridge,
): Drive {
  const west = bridge.x - bridge.w / 2 - 95;
  const east = exit.x + exit.w / 2 + 95;
  return { player, y: bridge.y, x: direction === 1 ? west : east, targetX: direction === 1 ? east : west, direction };
}

async function stageCars(page: Page, drives: Drive[]) {
  await page.evaluate((placements) => {
    const { scene, players } = window.__race;
    for (const { player, x, y, direction } of placements) {
      const car = players[player];
      // Isolate traffic while retaining static collisions with the bay and bridge.
      car.setGhost(true);
      scene.matter.body.setPosition(car.body, { x, y });
      scene.matter.body.setAngle(car.body, direction === 1 ? 0 : Math.PI);
      scene.matter.body.setVelocity(car.body, { x: 0, y: 0 });
      scene.matter.body.setAngularVelocity(car.body, 0);
    }
  }, drives);
}

async function driveAcross(page: Page, drives: Drive[]) {
  await Promise.all(drives.map(async ({ player, y, targetX, direction }) => {
    await page.keyboard.down(THROTTLE[player]);
    try {
      await page.waitForFunction(({ player, targetX, direction }) => {
        const car = window.__race.players[player];
        return (car.x - targetX) * direction >= 0;
      }, { player, targetX, direction }, WAIT);
      const result = await page.evaluate((player) => {
        const car = window.__race.players[player];
        return { y: car.y, airborne: car.airborne };
      }, player);
      expect(Math.abs(result.y - y)).toBeLessThan(24);
      expect(result.airborne).toBe(false);
    } finally {
      await page.keyboard.up(THROTTLE[player]);
    }
  }));
}

async function checkHeadlights(page: Page, count: number) {
  const lights = await page.evaluate(() => {
    const { scene, players } = window.__race;
    return players.map(({ player, view, chassis, airborne }) => {
      const beam = scene.children.getByName(`industrial-headlight-${player}`) as Phaser.GameObjects.Image;
      const rotation = view.rotation + chassis.rotation;
      const offset = chassis.displayWidth * view.scaleX * 0.44;
      return {
        airborne,
        angleError: Math.abs(Math.sin((beam.rotation - rotation) / 2)),
        poseError: Math.hypot(beam.x - view.x - Math.cos(rotation) * offset, beam.y - view.y - Math.sin(rotation) * offset),
        lengthScale: beam.scaleX,
        cameras: scene.cameras.cameras.map((camera) => beam.willRender(camera)),
      };
    });
  });
  expect(lights).toHaveLength(count);
  for (const light of lights) {
    expect(light.angleError).toBeLessThan(0.001);
    expect(light.poseError).toBeLessThan(0.001);
    expect(light.cameras).toEqual(Array.from({ length: count }, () => true));
  }
  return lights;
}

for (const count of [1, 2] as const) {
  const layout = count === 1 ? 'solo' : 'split';
  test(`seeded Industrial ${layout} drives both bridge and bay routes in both directions`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/?race=${count}&map=industrial&seed=3&questions=off`);
    await waitForGo(page);
    await assertMap(page, 'industrial');
    const { seed, decorations, mode } = await page.evaluate(() => {
      const { world, camera } = window.__race;
      return { seed: world.seed, decorations: world.industrial!.decorations, mode: camera.layout().mode };
    });
    expect(seed).toBe(3);
    expect(mode).toBe(count === 1 ? 'single' : 'split');
    const bridges = decorations.filter(({ kind }) => kind === 'bridge').sort((a, b) => a.y - b.y);
    const bays = decorations.filter(({ kind }) => kind === 'factoryBay').sort((a, b) => a.y - b.y);
    expect(bridges).toHaveLength(6);
    expect(bays).toHaveLength(2);

    await checkHeadlights(page, count);
    await page.waitForFunction(() => window.__race.elapsedSec > 1.2, undefined, WAIT);
    const screenshot = testInfo.outputPath(`industrial-${layout}.png`);
    await page.screenshot({ path: screenshot });
    await testInfo.attach(`industrial-${layout}`, { path: screenshot, contentType: 'image/png' });

    const driveKeys = [...THROTTLE.slice(0, count), ...STEER_OUTWARD.slice(0, count)];
    for (const key of driveKeys) await page.keyboard.down(key);
    try {
      await page.waitForFunction(() => window.__race.players.every((car) => Math.abs(car.view.rotation) > 0.24), undefined, WAIT);
      await checkHeadlights(page, count);
    } finally {
      for (const key of driveKeys) await page.keyboard.up(key);
    }

    for (const direction of [1, -1] as const) {
      const drives = bays.map((bay, i) => bridgeDrive(bridges.find((b) => b.y === bay.y)!, count === 1 ? 0 : i as PlayerId, direction, bay));
      if (count === 1) {
        drives.push(bridgeDrive(bridges.at(-1)!, 0, direction));
        for (const drive of drives) {
          await stageCars(page, [drive]);
          await driveAcross(page, [drive]);
        }
      } else {
        await stageCars(page, drives);
        await driveAcross(page, drives);
      }
    }
    await checkHeadlights(page, count);
    await page.evaluate(() => {
      const { bus, players } = window.__race;
      for (const { player } of players) bus.emit('jump:request', { player, airSec: 1.8, boost: true });
    });
    await page.waitForFunction(() => window.__race.players.every((car) => car.airborne && car.view.scaleX > 1.03), undefined, WAIT);
    const jumping = await checkHeadlights(page, count);
    expect(jumping.every((light) => light.airborne && light.lengthScale > 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('freight circles both crossings and drivers can take the central bridge during a pass', async ({ page }, testInfo) => {
  await page.goto('/?race=1&map=industrial&seed=3&questions=off');
  await waitForGo(page);
  const bridge = await page.evaluate(() => window.__race.world.industrial!.decorations
    .filter(({ kind }) => kind === 'bridge').sort((a, b) => a.y - b.y)[2]);
  const drive: Drive = {
    player: 0, direction: 1, y: bridge.y, x: bridge.x - bridge.w / 2 - 25, targetX: bridge.x + bridge.w / 2 + 25,
  };
  await stageCars(page, [drive]);
  const waitForCrossing = async (index: number, occupied: boolean, passedX?: number) => {
    const handle = await page.waitForFunction(({ index, occupied, passedX }) => {
      const { scene, elapsedSec, players, world } = window.__race;
      const { center, width } = world.industrial!.rail.crossings[index];
      const signal = scene.children.getByName(`industrial-crossing-signal-${index}`) as Phaser.GameObjects.Image;
      const train = scene.children.list.filter((obj) => obj.name.startsWith('industrial-train-')) as Phaser.GameObjects.Image[];
      const bodies = scene.matter.world.getAllBodies().filter((body) => body.plugin?.owner?.kind === 'train');
      const blocking = bodies.some(({ bounds }) => bounds.min.x < center.x + width / 2 && bounds.max.x > center.x - width / 2
        && bounds.min.y <= center.y && bounds.max.y >= center.y);
      if (passedX !== undefined && players[0].x < passedX) return false;
      if (occupied ? blocking : !blocking && signal.texture.key === 'industrial_crossing_lit') {
        return { elapsedSec, cars: train.length, solidCars: bodies.filter((body) => body.collisionFilter.mask).length,
          allVisible: train.every((image) => image.visible && image.alpha === 1) };
      }
      return false;
    }, { index, occupied, passedX }, { timeout: 30_000 });
    return await handle.jsonValue();
  };
  const warning = await waitForCrossing(0, false);
  const arrival = await waitForCrossing(0, true);
  if (warning === false || arrival === false) throw new Error('Crossing transition was missing');
  expect(arrival.cars).toBe(5);
  expect(arrival.solidCars).toBe(5);
  expect(arrival.allVisible).toBe(true);
  expect(arrival.elapsedSec - warning.elapsedSec).toBeGreaterThan(2);
  const [, stillOccupied] = await Promise.all([driveAcross(page, [drive]), waitForCrossing(0, true, drive.x + 100)]);
  if (stillOccupied === false) throw new Error('Crossing occupancy was missing');
  expect(stillOccupied.elapsedSec - arrival.elapsedSec).toBeLessThan(2.5);
  const crossing = await page.evaluate(() => window.__race.world.industrial!.rail.crossings[0].center);
  await stageCars(page, [{ player: 0, direction: 1, x: crossing.x, y: crossing.y - 155, targetX: crossing.x }]);
  const next = await waitForCrossing(1, true);
  const returned = await waitForCrossing(0, true);
  if (!next || !returned) throw new Error('Train did not complete its circuit');
  expect(next.solidCars).toBe(5);
  expect(next.allVisible && returned.allVisible).toBe(true);
  expect(returned.elapsedSec).toBeGreaterThan(next.elapsedSec);
  const screenshot = testInfo.outputPath('freight-crossing.png');
  await page.screenshot({ path: screenshot });
  await testInfo.attach('freight-crossing', { path: screenshot, contentType: 'image/png' });
});
