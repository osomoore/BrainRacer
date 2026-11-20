import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import type { TrafficCar } from '../../src/entities/TrafficCar';

test('traffic lights its rear lamps when braking without tinting its paint', async ({ page }) => {
  await page.goto('/?race=1&seed=3&questions=off');
  await page.waitForFunction(() => window.__race && window.__race.npcs.size > 0);
  const result = await page.evaluate(() => {
    const race = window.__race;
    const car = [...race.npcs].find((npc): npc is TrafficCar => 'follow' in npc)!;
    const lamp = car.view.getByName('traffic-brake-lights') as Phaser.GameObjects.Image;
    const player = race.players[0];
    const body = race.scene.matter.body;
    const gap = (player.spec.length + car.spec.length) / 2 + 1;
    const initiallyLit = lamp?.visible;
    const paint = car.appearanceKey;
    body.setPosition(player.body, { x: car.x + gap * Math.cos(car.angle), y: car.y + gap * Math.sin(car.angle) });
    body.setVelocity(player.body, { x: 0, y: 0 });
    car.update(0, race, race.rng.fork(1));
    return { initiallyLit, braking: lamp?.visible, tinted: car.sprite.isTinted, samePaint: paint === car.appearanceKey };
  });
  expect(result).toEqual({ initiallyLit: false, braking: true, tinted: false, samePaint: true });
});

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

test('stop-and-answer questions stay on screen after time expires and both answers count', async ({ page }) => {
  const errors: string[] = [];
  const warns: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning' && m.text().includes('[race teardown]')) warns.push(m.text());
  });
  await page.goto('/?race=2&seed=5&round=12');
  const KEYS = [['Digit1', 'Digit2', 'Digit3', 'Digit4'], ['Comma', 'Period', 'Slash', 'KeyM']];
  await page.waitForFunction(() => window.__race?.questionBreak);
  const questions = () => page.evaluate(() => [0, 1].map(p => (window as any).__challenge.current(p)));
  const final = await questions();
  await page.evaluate(() => { window.__race.elapsedSec = window.__race.roundLengthSec; });
  await page.waitForFunction(() => window.__race?.timeExpired);
  await page.waitForTimeout(4400);
  expect(await questions()).toEqual(final);
  expect(await page.evaluate(() => window.__game.scene.isActive('Race'))).toBe(true);
  await page.keyboard.press(KEYS[0][final[0].correct]);
  await page.waitForFunction(() => (window as any).__challenge.state(0) === 'done');
  expect(await page.evaluate(() => window.__race.pendingQuestions)).toBe(true);
  await page.keyboard.press(KEYS[1][final[1].correct]);
  await page.waitForFunction(() => (window as any).__game?.scene.isActive('Results'), null, { timeout: 20_000 });
  expect(await page.evaluate(() => window.__game.registry.get('results').players.map((p: { correct: number }) => p.correct))).toEqual([1, 1]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/results.png' });
  expect(errors).toEqual([]);
  expect(warns).toEqual([]);
});

test('a while-driving question can be answered past its original deadline when the round ends', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('brainracer.settings.v1', JSON.stringify({ questionStyle: 'drive' })));
  await page.goto('/?race=1&seed=5&round=30&questions=math');
  const question = () => page.evaluate(() => (window as any).__challenge.current(0));
  await page.waitForFunction(() => (window as any).__challenge?.current(0));
  const final = await question();
  await page.evaluate(() => {
    window.__race.elapsedSec = window.__race.roundLengthSec;
  });
  await page.waitForFunction(() => window.__race?.timeExpired);
  await page.waitForTimeout(4400);
  expect(await question()).toEqual(final);
  await page.keyboard.press(['Digit1', 'Digit2', 'Digit3'][final.correct]);
  await page.waitForFunction(() => window.__game?.scene.isActive('Results'));
});
