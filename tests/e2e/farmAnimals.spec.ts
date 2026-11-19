import { expect, test } from '@playwright/test';
import type { RaceContext } from '../../src/core/race';

type W = Window & { __race: RaceContext };
type Views = { ai: { kind: string; mode: string; x: number; y: number } }[];

test('a car drives into a cow: it flies off, lands, and nobody is hurt', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?race=1&map=farm&seed=3&questions=off');
  await page.waitForFunction(() => (window as unknown as W).__race?.elapsedSec > 1 && !!(globalThis as unknown as { __animals?: Views }).__animals, undefined, { timeout: 30_000 });
  await page.evaluate(() => {
    const A = (globalThis as unknown as { __animals: Views }).__animals;
    const cow = A.find((v) => v.ai.kind === 'cow')!;
    const { scene, players } = (window as unknown as W).__race;
    scene.matter.body.setPosition(players[0].body, { x: cow.ai.x - 520, y: cow.ai.y });
    scene.matter.body.setAngle(players[0].body, 0);
    scene.matter.body.setVelocity(players[0].body, { x: 0, y: 0 });
  });
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => (globalThis as unknown as { __animals: Views }).__animals.some((v) => v.ai.mode === 'fly' || v.ai.mode === 'daze'), undefined, { timeout: 15_000 });
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(() => (globalThis as unknown as { __animals: Views }).__animals.every((v) => v.ai.mode !== 'fly' && v.ai.mode !== 'daze'), undefined, { timeout: 15_000 });
  expect(errors).toEqual([]);
});
