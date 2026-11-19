import { expect, test } from '@playwright/test';

test('quick race runs: countdown, driving, challenges, no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?race=2&seed=3');
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Race'), null, { timeout: 30_000 });
  // countdown (3 s) then race starts
  await page.waitForFunction(() => ((window as any).__race?.elapsedSec ?? 0) > 0.5, null, { timeout: 15_000 });
  const start = await page.evaluate(() => { const p = (window as any).__race.players[0]; return { x: p.x, y: p.y }; });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyW');
  const moved = await page.evaluate(([sx, sy]) => { const p = (window as any).__race.players[0]; return Math.hypot(p.x - sx, p.y - sy); }, [start.x, start.y]);
  expect(moved).toBeGreaterThan(100);
  // Pause style: a shared question break freezes the world until both players answer correctly.
  const KEYS = [['Digit1', 'Digit2', 'Digit3', 'Digit4'], ['Comma', 'Period', 'Slash', 'KeyM']];
  const challenge = (p: number) => page.evaluate((i) => (window as any).__challenge.current(i), p);
  await page.waitForFunction(() => (window as any).__race.questionBreak === true, null, { timeout: 20_000 });
  await page.waitForTimeout(700);
  const frozen = await page.evaluate(() => { const r = (window as any).__race; return { t: r.elapsedSec, x: r.players[0].x, y: r.players[0].y }; });
  await page.screenshot({ path: 'test-results/break-2p.png' });
  await page.waitForTimeout(500);
  const still = await page.evaluate(() => { const r = (window as any).__race; return { t: r.elapsedSec, x: r.players[0].x, y: r.players[0].y }; });
  // The world (cars) is frozen, but the round clock keeps counting down during a break.
  expect({ x: still.x, y: still.y }).toEqual({ x: frozen.x, y: frozen.y });
  expect(still.t).toBeGreaterThan(frozen.t);
  const c0 = await challenge(0);
  expect(c0.options).toHaveLength(4);
  // wrong answer -> a different question arrives
  await page.keyboard.press(KEYS[0][(c0.correct + 1) % 4]);
  await page.waitForFunction((id) => (window as any).__challenge.current(0)?.id !== id, c0.id, { timeout: 5_000 });
  // right answers (P1 first: P1 waits for P2)
  await page.waitForTimeout(400);
  const c1 = await challenge(0);
  await page.keyboard.press(KEYS[0][c1.correct]);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__race.questionBreak)).toBe(true);
  await page.screenshot({ path: 'test-results/break-2p-waiting.png' });
  const d1 = await challenge(1);
  await page.keyboard.press(KEYS[1][d1.correct]);
  await page.waitForFunction(() => (window as any).__race.questionBreak === false, null, { timeout: 5_000 });
  const resumed = await page.evaluate(() => { const p = (window as any).__race.players[0]; return { x: p.x, y: p.y }; });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/race.png' });
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(([sx, sy]) => { const p = (window as any).__race.players[0]; return Math.hypot(p.x - sx, p.y - sy); }, [resumed.x, resumed.y]);
  expect(after).toBeGreaterThan(50);
  expect(errors).toEqual([]);
});

test('short round ends and reaches the results screen', async ({ page }) => {
  const errors: string[] = [];
  const warns: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning' && m.text().includes('[race teardown]')) warns.push(m.text());
  });
  await page.goto('/?race=2&seed=5&round=12');
  // Question breaks freeze the round clock, so answer them (correctly) as they come.
  const KEYS = [['Digit1', 'Digit2', 'Digit3', 'Digit4'], ['Comma', 'Period', 'Slash', 'KeyM']];
  for (let i = 0; i < 400; i++) {
    const st = await page.evaluate(() => {
      const w = window as any;
      if (w.__game?.scene.isActive('Results')) return { done: true };
      const c = w.__challenge;
      if (!w.__race?.questionBreak || !c) return { done: false };
      return { done: false, slots: [0, 1].map((p) => (c.state(p) === 'asking' ? c.current(p)?.correct : null)) };
    });
    if (st.done) break;
    for (const [p, slot] of (st.slots ?? []).entries()) if (slot !== null && slot !== undefined) await page.keyboard.press(KEYS[p][slot]);
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Results'), null, { timeout: 20_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/results.png' });
  expect(errors).toEqual([]);
  expect(warns).toEqual([]);
});
