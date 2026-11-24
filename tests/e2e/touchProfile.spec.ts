import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });

const SHOT = process.env.TAP_SHOTS; // optional folder for screenshots

async function waitScene(page: Page, key: string) {
  await page.waitForFunction((k) => (window as any).__game?.scene.isActive(k), key, { timeout: 30_000 });
}

/** Tap a point given in 1920x1080 logical game coordinates. */
async function tapLogical(page: Page, x: number, y: number) {
  const b = await page.locator('canvas').boundingBox();
  if (!b) throw new Error('no canvas');
  await page.touchscreen.tap(b.x + (x / 1920) * b.width, b.y + (y / 1080) * b.height);
  await page.waitForTimeout(150);
}

// Letter grid geometry (LetterPicker): picker at (960, 70), 7 columns, pitch 128, keys start 260 below the picker top.
const keyXY = (row: number, col: number, span = 1) => ({ x: 960 - 440 + col * 128 + (span * 128 - 16) / 2, y: 70 + 260 + row * 128 + 56 });
const letter = (ch: string) => { const i = ch.charCodeAt(0) - 65; return keyXY(Math.floor(i / 7), i % 7); };

async function shot(page: Page, name: string) {
  if (SHOT) await page.screenshot({ path: `${SHOT}/${name}.png` });
}

test('fresh device: a phone player makes a profile by tapping only', async ({ page }) => {
  await page.goto('/racer.html');
  await waitScene(page, 'Title');
  await tapLogical(page, 960, 500); // mobile: a tap anywhere on the title starts as player 1
  await waitScene(page, 'Setup');
  await page.waitForTimeout(600);
  await shot(page, '1-setup');

  // Tap the "New Profile" racer row on the (single, centered) player card.
  await tapLogical(page, 960, 332);
  await page.waitForTimeout(400);
  for (const ch of 'SAM') await tapLogical(page, letter(ch).x, letter(ch).y);
  await shot(page, '2-name');
  const done = keyXY(4, 4, 3);
  await tapLogical(page, done.x, done.y);
  await page.waitForTimeout(500);
  await shot(page, '3-age');
  await tapLogical(page, 960, 720); // age 8-9 (Medium)
  await page.waitForTimeout(800);
  await shot(page, '6-setup-after');
  expect(await page.evaluate(() => { const sc = (window as any).__game.scene; const st = sc.getScene('Setup'); return { setup: sc.isActive('Setup'), ready: st.panels[0].ready, isNew: st.isNew[0] }; })).toEqual({ setup: true, ready: false, isNew: false }); // created and selected, not ready

  const profiles = await page.evaluate(() => JSON.parse(localStorage.getItem('hub.profiles') ?? '[]') as { name: string }[]);
  expect(profiles.map((p) => p.name)).toEqual(['SAM']);
  const racer = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('brainracer.settings.v1') ?? '{}').racerProfiles ?? {}) as { difficulty: string; roundSec: number }[]);
  expect(racer[0]).toMatchObject({ difficulty: 'normal', roundSec: 300 });

  await tapLogical(page, 960, 836); // Questions
  await tapLogical(page, 800, 540); // Math off
  await tapLogical(page, 1120, 540); // JBQ on
  await tapLogical(page, 960, 628); // 10 -> 20 points
  await tapLogical(page, 960, 716); // Week -> Month
  await tapLogical(page, 960, 836); // Done
  await tapLogical(page, 960, 836); // reopen
  expect(await page.evaluate(() => {
    const st = (window.__game.scene.getScene('Setup') as any);
    const { questionTypes, jbq } = st.cfg.players[0];
    return { open: st.panels[0].questionsGroup.visible, questionTypes, jbq };
  })).toEqual({ open: true, questionTypes: { math: false, reading: true, jbq: true }, jbq: { points: 20, scope: 'month' } });

  await page.reload();
  await waitScene(page, 'Title');
  await tapLogical(page, 960, 500);
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await tapLogical(page, 960, 836);
  expect(await page.evaluate(() => {
    const st = (window.__game.scene.getScene('Setup') as any);
    const { questionTypes, jbq } = st.cfg.players[0];
    return { open: st.panels[0].questionsGroup.visible, questionTypes, jbq };
  })).toEqual({ open: true, questionTypes: { math: false, reading: true, jbq: true }, jbq: { points: 20, scope: 'month' } });
});
