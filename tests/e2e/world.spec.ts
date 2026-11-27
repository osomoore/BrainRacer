import { expect, test, type Page } from '@playwright/test';
import type { WorldContext } from '../../apps/world/core/runtime';

test.use({ viewport: { width: 1920, height: 1080 } });

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const ctx = (window as Window & { __world?: WorldContext }).__world!;
    return {
      seed: ctx.world.seed,
      players: ctx.players.map(({ move, camera, sprite }) => {
        const { x, y, width, height, renderList } = camera;
        const rotation = (camera as typeof camera & { rotation: number }).rotation;
        const headingError = move.angle + rotation + Math.PI / 2;
        return {
          move: { ...move },
          view: { x, y, width, height },
          rotation,
          headingError: Math.atan2(Math.sin(headingError), Math.cos(headingError)),
          playerSprites: renderList.filter(obj => ctx.players.some(player => player.sprite === obj)).length,
          hasHome: renderList.some(obj => (obj as Phaser.GameObjects.Image).texture?.key === 'world:w5a:prop:home'),
          hasSprite: !!sprite,
        };
      }),
    };
  });
}

async function boot(page: Page, count: number): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`/world.html?play=${count}&seed=29`);
  await waitForWorld(page);
  return errors;
}

async function waitForWorld(page: Page): Promise<void> {
  await page.waitForFunction(() => ((window as Window & { __world?: WorldContext }).__world?.time ?? 0) > 0.1);
}

test('solo quick start draws a home, drives, and follows the creation heading', async ({ page }) => {
  const errors = await boot(page, 1);
  const start = await snapshot(page);
  expect(start.seed).toBe(29);
  expect(start.players).toHaveLength(1);
  const [first] = start.players;
  expect(first.view).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  expect(first.hasHome).toBe(true);
  expect(first.hasSprite).toBe(true);
  expect(Math.abs(first.headingError)).toBeLessThan(0.01);

  await page.keyboard.down('w');
  await expect.poll(async () => (await snapshot(page)).players[0].move.x - first.move.x).toBeGreaterThan(55);
  await page.keyboard.up('w');
  await page.keyboard.down('d');
  await expect.poll(async () => (await snapshot(page)).players[0].move.angle).toBeGreaterThan(first.move.angle + 0.35);
  await page.keyboard.up('d');
  await expect.poll(async () => Math.abs((await snapshot(page)).players[0].headingError)).toBeLessThan(0.05);
  expect((await snapshot(page)).players[0].rotation).toBeLessThan(first.rotation - 0.3);

  const last = (await snapshot(page)).players[0].move;
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => {
    const saves = JSON.parse(localStorage.getItem('world.players.v1') ?? '{}');
    return saves['world-quick-1']?.last?.angle as number | undefined;
  })).toBeCloseTo(last.angle, 3);
  await page.reload();
  await waitForWorld(page);
  expect((await snapshot(page)).players[0].move.angle).toBeCloseTo(last.angle, 3);
  expect(errors).toEqual([]);
});

test('split quick start shows both creations in both cameras and steers independently', async ({ page }) => {
  const errors = await boot(page, 2);
  const { players: [left, right] } = await snapshot(page);
  expect(left.view).toEqual({ x: 0, y: 0, width: 960, height: 1080 });
  expect(right.view).toEqual({ x: 960, y: 0, width: 960, height: 1080 });
  expect(left.hasHome && right.hasHome).toBe(true);
  expect([left.playerSprites, right.playerSprites]).toEqual([2, 2]);

  await page.keyboard.down('w');
  await expect.poll(async () => (await snapshot(page)).players[0].move.x - left.move.x).toBeGreaterThan(55);
  await page.keyboard.up('w');
  expect((await snapshot(page)).players[1].move.x).toBe(right.move.x);

  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).players[1].move.x - right.move.x).toBeGreaterThan(55);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).players[1].move.angle).toBeLessThan(right.move.angle - 0.35);
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => Math.abs((await snapshot(page)).players[1].headingError)).toBeLessThan(0.05);
  const turned = (await snapshot(page)).players;
  expect(turned[0].rotation).toBeCloseTo(left.rotation);
  expect(turned[1].rotation).toBeGreaterThan(right.rotation + 0.3);
  await page.evaluate(() => {
    const ctx = (window as Window & { __world?: WorldContext }).__world!;
    const player = ctx.players[0];
    player.sprite?.setName('before-swap');
  });
  await page.keyboard.press('e');
  await page.waitForFunction(() => {
    const player = (window as Window & { __world?: WorldContext }).__world?.players[0];
    return player?.traits.kind === 'dino' && !!player.sprite && player.sprite.name !== 'before-swap';
  });
  expect(errors).toEqual([]);
});
