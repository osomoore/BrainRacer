import { expect, test } from '@playwright/test';
import { installGamepadMock, setPad } from './gamepadMock';

test('an open Setup tab follows a cross-tab merge before it persists', async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hub.profiles', JSON.stringify([
      { id: 'p1', name: 'Robin', createdAt: 1 }, { id: 'p2', name: 'Sam', createdAt: 2 },
    ]));
    localStorage.setItem('hub.profileSeq', '2');
    localStorage.setItem('brainracer.settings.v1', JSON.stringify({
      racerProfiles: {
        p1: { difficulty: 'easy', questionTypes: { math: true, reading: false, jbq: false }, roundSec: 300, jbq: { points: 10, scope: 'week' } },
        p2: { difficulty: 'hard', questionTypes: { math: false, reading: true, jbq: false }, roundSec: 180, jbq: { points: 20, scope: 'all' } },
      },
      players: [{ profile: 'p2', device: { type: 'keyboard', layout: 'left' }, car: 'kart', guide: 'none' }],
    }));
  });
  await page.goto('/racer.html');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Title'));
  await page.keyboard.press('Space', { delay: 120 });
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Setup'));
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('Setup').cfg.players[0]?.profile)).toBe('p2');
  await page.evaluate(() => {
    const scene = (window as any).__game.scene.getScene('Setup');
    scene.addPlayer({ type: 'keyboard', layout: 'right' }, scene.cfg.players);
  });
  await expect.poll(() => page.evaluate(() => (window as any).__game.scene.getScene('Setup').cfg.players.map((p: any) => p.profile))).toEqual(['p2', 'p1']);

  const other = await context.newPage();
  await other.goto('/racer.html');
  await other.evaluate(() => {
    localStorage.setItem('brainracer.settings.v1', JSON.stringify({
      racerProfiles: {
        p1: { difficulty: 'normal', questionTypes: { math: true, reading: true, jbq: true }, roundSec: 420, jbq: { points: 30, scope: 'month' } },
      },
      players: [{ profile: 'p1', device: { type: 'keyboard', layout: 'left' }, car: 'dino', guide: 'bear' }],
    }));
    localStorage.setItem('hub.profileReplacements.v1', JSON.stringify({ p2: 'p1' }));
    localStorage.setItem('hub.profiles', JSON.stringify([{ id: 'p1', name: 'Robin', createdAt: 1 }]));
  });

  await expect.poll(() => page.evaluate(() => {
    const scene = (window as any).__game.scene.getScene('Setup');
    return {
      ids: scene.cfg.players.map((p: any) => p.profile),
      newSecond: scene.isNew[1],
      secondReady: scene.slots[1]?.ready,
      difficulty: scene.cfg.racerProfiles.p1?.difficulty,
    };
  })).toEqual({ ids: ['p1', undefined], newSecond: true, secondReady: false, difficulty: 'normal' });

  await other.close();
  await page.evaluate(() => {
    const scene = (window as any).__game.scene.getScene('Setup');
    scene.persist();
    scene.goNext();
  });
  await expect.poll(() => page.evaluate(() => ({
    setup: (window as any).__game.scene.isActive('Setup'),
    track: (window as any).__game.scene.isActive('TrackSelect'),
  }))).toEqual({ setup: true, track: false });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('brainracer.settings.v1')!));
  expect(saved.players[0].profile).toBe('p1');
  expect(saved.racerProfiles.p1.difficulty).toBe('normal');
  expect(saved.racerProfiles.p1.jbq.scope).toBe('month');
  expect(saved.racerProfiles.p2).toBeUndefined();
});

test('a held B press closing Profiles does not close Admin Settings', async ({ page }) => {
  await installGamepadMock(page, 1);
  await page.goto('/racer.html');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Title'));
  await page.keyboard.press('F9');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Config')
    && (window as any).__game.scene.isPaused('Title'));
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas not found');
  await page.mouse.click(box.x + (1430 / 1920) * box.width, box.y + (685 / 1080) * box.height);
  await page.waitForFunction(() => (window as any).__profilesPanelOpen === true);

  await setPad(page, 0, { buttons: { 1: 1 } });
  await page.waitForFunction(() => (window as any).__profilesPanelOpen !== true);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__game.scene.isPaused('Title'))).toBe(true);

  await setPad(page, 0, { buttons: { 1: 0 } });
  await page.waitForTimeout(100);
  await setPad(page, 0, { buttons: { 1: 1 } });
  await page.waitForFunction(() => (window as any).__game.scene.isPaused('Title') === false);
});
