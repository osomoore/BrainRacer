import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import { TEX } from '../../src/core/assetKeys';
import { installGamepadMock, setPad, tapPad } from './gamepadMock';

const WAIT = { timeout: 20_000 };

async function waitForRace(page: Page) {
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.5, undefined, WAIT);
}

async function damageCar(page: Page) {
  const now = await page.evaluate(() => {
    const race = window.__race;
    race.bus.emit('vehicle:damage', { player: 0, impact: 700 });
    return race.elapsedSec;
  });
  await page.waitForFunction((time) => window.__race.elapsedSec >= time + 0.3, now, WAIT);
}

test('a battered car smokes, catches fire, breaks down, and can be replaced using B', async ({ page }) => {
  await installGamepadMock(page, 1);
  await page.goto('/?race=1&map=industrial&seed=3&questions=off&heat=100');
  await waitForRace(page);
  expect(await page.evaluate(() => window.__race.settings.players[0].device)).toEqual({ type: 'gamepad', index: 0 });
  const playerTexture = await page.evaluate(() => window.__race.players[0].chassis.texture.key);
  await damageCar(page);
  const visibleEffect = (key: string) => page.evaluate((texture) =>
    (window.__race.scene.children.list as Phaser.GameObjects.Image[])
      .some((object) => object.visible && object.texture?.key === texture), key);
  expect(await visibleEffect(TEX.fxSmoke)).toBe(true);
  expect(await visibleEffect(TEX.fxFlame)).toBe(false);

  await damageCar(page);
  expect(await visibleEffect(TEX.fxFlame)).toBe(true);
  await damageCar(page);
  expect(await page.evaluate(() => window.__race.players[0].disabled)).toBe(true);
  await setPad(page, 0, { buttons: { 7: 1 } });
  await page.waitForTimeout(350);
  const speed = await page.evaluate(() => window.__race.players[0].forwardSpeed);
  await setPad(page, 0, { buttons: { 7: 0 } });
  expect(Math.abs(speed)).toBeLessThan(10);

  await page.waitForFunction(() => [...window.__race.npcs].some((npc) => npc.npcKind === 'police'), undefined, WAIT);
  for (const kind of ['police', 'truck'] as const) {
    await page.waitForFunction((targetKind) => [...window.__race.npcs]
      .some((npc) => !npc.destroyed && npc.npcKind === targetKind), kind, WAIT);
    const expected = await page.evaluate((targetKind) => {
      const { scene, players, npcs } = window.__race;
      const car = players[0];
      const target = [...npcs].find((npc) => !npc.destroyed && npc.npcKind === targetKind)!;
      for (const npc of npcs) if (npc !== target) npc.destroy();
      const body = scene.matter.body;
      body.setPosition(car.body, { x: 2000, y: 1408 });
      body.setPosition(target.body, { x: 2100, y: 1408 });
      body.setVelocity(car.body, { x: 0, y: 0 });
      body.setVelocity(target.body, { x: 0, y: 0 });
      return { id: target.body.id, length: target.spec.length };
    }, kind);
    await tapPad(page, 0, 1);
    expect(await page.evaluate(() => window.__race.players[0].spec.length)).not.toBe(expected.length);
    await tapPad(page, 0, 1);
    await expect.poll(() => page.evaluate((id) => {
      const { players, npcs } = window.__race;
      return { length: players[0].spec.length, disabled: players[0].disabled, remainsNpc: [...npcs].some((npc) => npc.body.id === id) };
    }, expected.id)).toEqual({ length: expected.length, disabled: false, remainsNpc: false });
  }
  expect(await page.evaluate(() => window.__race.players[0].chassis.texture.key)).not.toBe(playerTexture);
});

test('destination handoff publishes the next goal immediately', async ({ page }) => {
  await page.goto('/?race=1&seed=3&questions=off');
  await waitForRace(page);
  const result = await page.evaluate(() => {
    const race = window.__race;
    const old = race.goal!;
    const atCompletion = new Promise<{ completedAt: number; spawnedAt: number; nextId: number; nextX: number }>((resolve) => {
      race.bus.once('goal:completed', () => {
        const completedAt = race.elapsedSec;
        race.bus.once('goal:spawned', ({ goal }) => {
          resolve({ completedAt, spawnedAt: race.elapsedSec, nextId: goal.id, nextX: goal.x });
        });
      });
    });
    const site = race.world.places.find((place) => place.word !== old.placeWord)!;
    race.world.places.splice(0, race.world.places.length,
      { ...site, front: { x: old.x + 900, y: old.y } });
    race.scene.matter.body.setPosition(race.players[0].body, old);
    return atCompletion;
  });
  expect(result.nextId).toBe(2);
  expect(result.spawnedAt).toBe(result.completedAt);
  expect(result.nextX).toBeGreaterThan(0);
});

test('Industrial destination ring texture has transparent corners', async ({ page }) => {
  await page.goto('/?race=1&map=industrial&seed=3&questions=off');
  await waitForRace(page);
  const alpha = await page.evaluate((ring) => {
    const image = window.__race.scene.textures.get(ring).getSourceImage() as HTMLCanvasElement;
    const context = image.getContext('2d')!;
    return [[1, 1], [image.width - 2, 1], [1, image.height - 2], [image.width - 2, image.height - 2],
      [image.width / 2, image.height / 2]].map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]);
  }, TEX.goalRing);
  expect(alpha.slice(0, 4)).toEqual([0, 0, 0, 0]);
  expect(alpha[4]).toBeGreaterThan(0);
});
