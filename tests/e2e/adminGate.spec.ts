import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });

const SHOT = process.env.TAP_SHOTS; // optional folder for screenshots

async function waitScene(page: Page, key: string) {
  await page.waitForFunction((k) => (window as any).__game?.scene.isActive(k), key, { timeout: 30_000 });
}
async function tapLogical(page: Page, x: number, y: number) {
  const b = await page.locator('canvas').boundingBox();
  if (!b) throw new Error('no canvas');
  await page.touchscreen.tap(b.x + (x / 1920) * b.width, b.y + (y / 1080) * b.height);
  await page.waitForTimeout(200);
}
async function shot(page: Page, name: string) { if (SHOT) await page.screenshot({ path: `${SHOT}/${name}.png` }); }

// Pad geometry (ADMIN_GATE.key): 3 columns pitch 216 around x=960; rows start y=440, pitch 128, key height 112.
const PAD: Record<string, [number, number]> = {
  '7': [0, 0], '8': [1, 0], '9': [2, 0], '4': [0, 1], '5': [1, 1], '6': [2, 1], '1': [0, 2], '2': [1, 2], '3': [2, 2], '0': [1, 3],
};
async function type(page: Page, digits: string) {
  for (const d of digits) { const [c, r] = PAD[d]; await tapLogical(page, 960 + (c - 1) * 216, 440 + r * 128 + 56); }
}
const OK = [960 + 216, 440 + 3 * 128 + 56] as const;
const gateQuestion = (page: Page) => page.evaluate(() => {
  const s = (window as any).__game.scene.getScene('Setup');
  const t = s.children.list.flatMap((o: any) => (o.list ? o.list : [o])).find((o: any) => typeof o.text === 'string' && o.text.includes('×'));
  const m = /(\d+) × (\d+)/.exec(t?.text ?? '');
  return m ? Number(m[1]) * Number(m[2]) : null;
});
const adminOpen = (page: Page) => page.evaluate(() => (window as any).__game.scene.isPaused('Setup'));

test('mobile setup gear: wrong answer closes the gate, correct answer opens the admin menu', async ({ page }) => {
  await page.goto('/racer.html');
  await waitScene(page, 'Title');
  await tapLogical(page, 960, 500);
  await waitScene(page, 'Setup');
  await page.waitForTimeout(600);
  await shot(page, 'a-setup-gear');

  await tapLogical(page, 1830, 70); // gear
  const q1 = await gateQuestion(page);
  expect(q1).not.toBeNull();
  expect(q1!).toBeGreaterThanOrEqual(36); expect(q1!).toBeLessThanOrEqual(144);
  await shot(page, 'b-gate');
  await type(page, String(q1! + 1));
  await tapLogical(page, OK[0], OK[1]);
  expect(await gateQuestion(page)).toBeNull(); // gate closed
  expect(await adminOpen(page)).toBe(false);

  await tapLogical(page, 1830, 70);
  const q2 = await gateQuestion(page);
  expect(q2).not.toBeNull();
  await type(page, String(q2));
  await shot(page, 'c-gate-typed');
  await tapLogical(page, OK[0], OK[1]);
  await page.waitForTimeout(400);
  expect(await adminOpen(page)).toBe(true);
  await shot(page, 'd-admin');
});
