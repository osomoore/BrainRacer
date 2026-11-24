import { expect, test, type Page } from '@playwright/test';
import { CATALOGS } from '../../apps/workshop/content';
import { solveAffordable } from '../../apps/workshop/logic/affordability';
import { available } from '../../apps/workshop/logic/available';
import { solve } from '../../apps/workshop/logic/solver';
import { seedProfiles } from './profiles';

/**
 * Adventure Workshop: run + results screens (fail / win / unlock / hint / reading level / Admin Mode / 2P / Dino / multi-stage).
 * Hooks: window.__ws. Set WS_SHOTS=<dir> to also save screenshots of the results screens.
 */

type Reading = 'easy' | 'medium' | 'hard';
type Ws = 'race' | 'dino';

const screens = (page: Page) => page.evaluate(() => (window as any).__ws.screens() as string[]);
const expectScreens = (page: Page, want: string, timeout = 15_000) =>
  expect.poll(async () => (await screens(page)).join(','), { timeout }).toBe(want);
const key = async (page: Page, k: string) => { await page.keyboard.press(k); await page.waitForTimeout(150); };

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedProfiles(page);
  await page.goto('/workshop.html');
  await page.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });
  await page.waitForTimeout(300);
}

/** Joins (1P or 2P), then gives each pane profile p1 / p2 with a fresh save, and opens `screen`. */
async function enter(page: Page, opts: { players: 1 | 2; ws?: Ws; reading?: Reading; screen?: string }): Promise<void> {
  await key(page, 'Space');
  if (opts.players === 2) await key(page, 'Enter');
  await key(page, 'Space');
  await expectScreens(page, Array(opts.players).fill('profile').join(','));
  await page.evaluate(({ ws, reading, screen }) => {
    const w = (window as any).__ws;
    w.contexts().forEach((ctx: any, i: number) => {
      const id = `p${i + 1}`;
      let save = w.engine.newPlayerSave(reading);
      save = { ...save, workshops: { [ws]: w.engine.progressOf(save, ws) } };
      w.store.setPlayer(id, save);
      ctx.setProfile(id);
      ctx.setWorkshop(ws);
      ctx.go(screen);
    });
  }, { ws: opts.ws ?? 'race', reading: opts.reading ?? 'medium', screen: opts.screen ?? 'board' });
  await expectScreens(page, Array(opts.players).fill(opts.screen ?? 'board').join(','));
  await page.waitForTimeout(300);
}

interface TextInfo { text: string; color: string; size: number }

/** Phaser Text objects shown in a pane (inside Buttons too). */
const paneTexts = (page: Page, pane = 0): Promise<string[]> => paneTextInfo(page, pane).then((t) => t.map((x) => x.text));
const paneTextInfo = (page: Page, pane = 0) => page.evaluate((pane) => {
  const out: TextInfo[] = [];
  const walk = (o: any) => {
    if (o.type === 'Text' && o.visible !== false) {
      out.push({ text: String(o.text).replace(/\s+/g, ' ').trim(), color: String(o.style.color), size: parseInt(String(o.style.fontSize), 10) });
    }
    o.list?.forEach(walk);
  };
  (window as any).__ws.panes[pane].children.list.forEach(walk);
  return out;
}, pane) as Promise<TextInfo[]>;

const saved = (page: Page, id = 'p1', ws: Ws = 'race') => page.evaluate(({ id, ws }) =>
  JSON.parse(localStorage.getItem('workshop.players.v1') ?? '{}')[id]?.workshops?.[ws] as any, { id, ws });
const rawPlayers = (page: Page) => page.evaluate(() => localStorage.getItem('workshop.players.v1') ?? '');

const activeIds = (page: Page, pane = 0, ws: Ws = 'race') => page.evaluate(({ pane, ws }) => {
  const w = (window as any).__ws;
  return w.engine.progressOf(w.contexts()[pane].save(), ws).active as string[];
}, { pane, ws });

/** Id of an offered challenge the current build fails (or passes). */
const pickChallenge = (page: Page, pane: number, ws: Ws, wantPass: boolean) => page.evaluate(({ pane, ws, wantPass }) => {
  const w = (window as any).__ws;
  const p = w.engine.progressOf(w.contexts()[pane].save(), ws);
  return p.active.find((id: string) => w.engine.evaluate(ws, p.model, p.challenges[id]).passed === wantPass) as string | undefined;
}, { pane, ws, wantPass });

/** Buys the supporting parts and sets the pane's build to an affordable solution. */
async function useSolution(page: Page, pane: number, ws: Ws, challengeId: string): Promise<void> {
  const d = await page.evaluate(({ pane, ws, challengeId }) => {
    const w = (window as any).__ws;
    const p = w.engine.progressOf(w.contexts()[pane].save(), ws);
    const ch = p.challenges[challengeId];
    return {
      checks: ch.stages.flatMap((s: any) => s.requirements.flatMap((r: any) => r.checks)),
      progress: p,
    };
  }, { pane, ws, challengeId });
  const sol = solveAffordable(CATALOGS[ws], d.checks, d.progress);
  expect(sol, 'the challenge has an affordable solution').not.toBeNull();
  const owned = available(CATALOGS[ws], d.progress);
  const purchases = Object.entries(sol!.build).filter(([, variant]) => !owned.has(variant));
  await page.evaluate(({ pane, ws, build, purchases }) => {
    const c = (window as any).__ws.contexts()[pane];
    const save = c.save();
    const w = (window as any).__ws;
    let p = w.engine.progressOf(save, ws);
    for (const [aspect, variant] of purchases) {
      const out = w.engine.purchase(ws, p, aspect, variant);
      if (out.status !== 'bought') throw new Error(`Could not buy ${variant}: ${out.status}`);
      p = out.progress;
    }
    c.commit({ ...save, workshops: { ...save.workshops, [ws]: { ...p, model: build } } });
  }, { pane, ws, build: sol!.build, purchases });
}

const goRun = (page: Page, pane: number, challengeId: string) =>
  page.evaluate(({ pane, challengeId }) => (window as any).__ws.contexts()[pane].go('run', { challengeId }), { pane, challengeId });

/** Opens the run, waits past the input guard, skips with B. */
async function skipToResults(page: Page, back = 'Escape', pane = 0): Promise<void> {
  const want = (await screens(page)).map((s, i) => (i === pane ? 'results' : s)).join(',');
  await page.waitForTimeout(550);
  await key(page, back);
  await expectScreens(page, want);
  await page.waitForTimeout(550); // results ignore input for a moment
}

const shot = async (page: Page, name: string) => {
  const dir = process.env.WS_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
};

/** Layout checks for a results screen: nothing overlaps, text >= 40 px, tap targets >= 120 px, buttons never cover text. */
async function expectCleanLayout(page: Page, pane: number): Promise<void> {
  const r = await page.evaluate((pane) => {
    const scene = (window as any).__ws.panes[pane];
    const texts: { text: string; b: { x: number; y: number; w: number; h: number }; size: number }[] = [];
    const buttons: { x: number; y: number; w: number; h: number }[] = [];
    const walk = (o: any, inBtn: boolean) => {
      const isBtn = typeof o.w === 'number' && typeof o.h === 'number' && o.type === 'Container' && o.visible !== false;
      if (isBtn && o.alpha > 0) buttons.push({ x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h });
      if (o.type === 'Text' && o.visible !== false && !inBtn && !o.parentContainer) {
        const b = o.getBounds();
        texts.push({ text: String(o.text).slice(0, 30), b: { x: b.x, y: b.y, w: b.width, h: b.height }, size: parseInt(String(o.style.fontSize), 10) });
      }
      o.list?.forEach((c: any) => walk(c, inBtn || isBtn));
    };
    scene.children.list.forEach((o: any) => walk(o, false));
    return { texts, buttons, w: scene.ctx.size.w };
  }, pane);
  const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, tol = 6) =>
    a.x + tol < b.x + b.w && b.x + tol < a.x + a.w && a.y + tol < b.y + b.h && b.y + tol < a.y + a.h;
  expect(r.buttons.length).toBeGreaterThanOrEqual(3);
  for (const b of r.buttons) { expect(b.h).toBeGreaterThanOrEqual(120); expect(b.w).toBeGreaterThanOrEqual(120); }
  for (const t of r.texts) {
    expect(t.size, t.text).toBeGreaterThanOrEqual(40);
    expect(t.b.x, t.text).toBeGreaterThanOrEqual(-4);
    expect(t.b.x + t.b.w, t.text).toBeLessThanOrEqual(r.w + 4);
    for (const b of r.buttons) expect(hit(t.b, b), `${t.text} overlaps a button`).toBe(false);
  }
  for (let i = 0; i < r.buttons.length; i++) for (let j = i + 1; j < r.buttons.length; j++) expect(hit(r.buttons[i], r.buttons[j], 2)).toBe(false);
  for (let i = 0; i < r.texts.length; i++) for (let j = i + 1; j < r.texts.length; j++) {
    expect(hit(r.texts[i].b, r.texts[j].b, 14), `${r.texts[i].text} / ${r.texts[j].text}`).toBe(false);
  }
}

test('fail: red cross, fail counted, Try again re-runs, the hint appears after three fails', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1, reading: 'medium' });
  const id = (await pickChallenge(page, 0, 'race', false))!;
  expect(id).toBeTruthy();
  const reqText = await page.evaluate((id) => {
    const w = (window as any).__ws;
    return w.engine.progressOf(w.contexts()[0].save(), 'race').challenges[id].stages[0].requirements[0].text.medium as string;
  }, id);

  await goRun(page, 0, id);
  await expectScreens(page, 'run');
  await skipToResults(page);
  let info = await paneTextInfo(page);
  expect(info.map((t) => t.text)).toContain('Not yet!');
  expect(info.map((t) => t.text)).toContain(reqText);
  const cross = info.find((t) => t.text === '✗');
  expect(cross, 'a red cross').toBeTruthy();
  expect(cross!.color).toBe('#e8232a');
  expect((await saved(page)).fails[id]).toBe(1);
  expect(info.some((t) => t.text.startsWith('Hint:'))).toBe(false);
  await expectCleanLayout(page, 0);
  await shot(page, 'results-fail');

  for (const n of [2, 3]) {
    await key(page, 'KeyA'); await key(page, 'KeyA'); // Workshop -> Test -> Try again
    await key(page, 'Space');
    await expectScreens(page, 'run');
    await skipToResults(page);
    expect((await saved(page)).fails[id]).toBe(n);
    info = await paneTextInfo(page);
    expect(info.some((t) => t.text.startsWith('Hint:')), `hint after ${n} fails`).toBe(n === 3);
  }
  await expectCleanLayout(page, 0);
  await shot(page, 'results-fail-hint');
  // the Workshop button (focused after a fail) goes back to the room
  await key(page, 'Space');
  await expectScreens(page, 'room');
});

test('run input: a press right after opening is ignored, A fast-forwards with a >> icon, B skips exactly once', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1 });
  const id = (await pickChallenge(page, 0, 'race', false))!;
  await goRun(page, 0, id);
  await expectScreens(page, 'run');
  const speed = () => page.evaluate(() => (window as any).__ws.panes[0].tweens.timeScale as number);
  const iconShown = () => page.evaluate(() => (window as any).__ws.panes[0].children.list.some((o: any) => o.type === 'Image' && o.texture?.key === 'ws:ff-icon' && o.visible));
  await page.keyboard.press('Space'); // inside the input guard
  await page.waitForTimeout(100);
  expect(await speed()).toBe(1);
  expect(await iconShown()).toBe(false);
  await page.waitForTimeout(500);
  await key(page, 'Space');
  expect(await speed()).toBe(4);
  expect(await iconShown()).toBe(true);
  await key(page, 'Space');
  expect(await speed()).toBe(1);
  await key(page, 'Space');
  // B twice in a row: one fail only
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expectScreens(page, 'results');
  expect(await speed()).toBe(1); // the run restored the speed when it was torn down
  expect((await saved(page)).fails[id]).toBe(1);
});

test('run: leaving mid-run (pane exit) cleans up and records nothing', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1 });
  const id = (await pickChallenge(page, 0, 'race', false))!;
  await goRun(page, 0, id);
  await expectScreens(page, 'run');
  await page.waitForTimeout(500);
  await page.keyboard.press('Space'); // fast-forward on, then abandon the run from outside
  await page.waitForTimeout(150);
  await page.evaluate(() => (window as any).__ws.contexts()[0].go('room'));
  await expectScreens(page, 'room');
  await page.waitForTimeout(1500);
  expect(await screens(page)).toEqual(['room']);
  expect((await saved(page)).fails[id] ?? 0).toBe(0);
  expect(await page.evaluate(() => (window as any).__ws.panes[0].tweens.timeScale)).toBe(1);
  // leaving the pane (exit to the title) mid-run is fine too
  await page.evaluate((id) => (window as any).__ws.contexts()[0].go('run', { challengeId: id }), id);
  await expectScreens(page, 'run');
  await page.evaluate(() => (window as any).__ws.contexts()[0].exit());
  await page.waitForTimeout(800);
  expect((await saved(page)).fails[id] ?? 0).toBe(0);
});

test('win: green check, currency saved, board refills, replay does not pay again', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1, reading: 'easy' });
  const id = (await pickChallenge(page, 0, 'race', false))!;
  await useSolution(page, 0, 'race', id);
  const before = await saved(page);
  expect(typeof before.wallet).toBe('number');

  await goRun(page, 0, id);
  await expectScreens(page, 'run');
  // let it play to the end naturally, fast-forwarded
  await page.waitForTimeout(550);
  await key(page, 'Space');
  await expectScreens(page, 'results', 60_000);
  await page.waitForTimeout(600);
  const info = await paneTextInfo(page);
  const texts = info.map((t) => t.text);
  expect(texts).toContain('It worked!');
  expect(info.find((t) => t.text === '✓')?.color).toBe('#2fb84f');
  expect(texts).not.toContain('✗');
  const after = await saved(page);
  expect(after.completed[id].payout).toBeGreaterThan(0);
  expect(after.wallet).toBe(before.wallet + after.completed[id].payout);
  await expectCleanLayout(page, 0);
  await shot(page, 'results-first-win');

  // Test button: the board has three cards and the solved one was replaced
  await key(page, 'Space'); // focused: Test after a win
  await expectScreens(page, 'board');
  const active = await activeIds(page);
  expect(active).toHaveLength(3);
  expect(active).not.toContain(id);

  // Replaying a completed challenge cannot pay again; the run screen guards it from selection.
  const replay = await page.evaluate(({ id, after }) => {
    const w = (window as any).__ws;
    return w.engine.recordWin('race', after, id, after.completed[id].build, 9999);
  }, { id, after });
  expect(replay.payout).toBe(0);
  expect(replay.progress.wallet).toBe(after.wallet);
  expect(replay.progress.completed[id]).toEqual(after.completed[id]);
});

test('results text follows the reading level', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1, reading: 'easy' });
  const id = (await pickChallenge(page, 0, 'race', false))!;
  const req = await page.evaluate((id) => {
    const w = (window as any).__ws;
    return w.engine.progressOf(w.contexts()[0].save(), 'race').challenges[id].stages[0].requirements[0].text as Record<Reading, string>;
  }, id);
  for (const level of ['easy', 'medium', 'hard'] as Reading[]) {
    await page.evaluate((level) => {
      const w = (window as any).__ws;
      w.store.setPlayer('p1', { ...w.store.player('p1'), reading: level });
    }, level);
    await goRun(page, 0, id);
    await expectScreens(page, 'run');
    await skipToResults(page);
    const t = await paneTexts(page);
    expect(t).toContain(req[level]);
    for (const other of (['easy', 'medium', 'hard'] as Reading[]).filter((l) => l !== level)) expect(t).not.toContain(req[other]);
    await expectCleanLayout(page, 0);
    await page.evaluate(() => (window as any).__ws.contexts()[0].go('board'));
    await expectScreens(page, 'board');
  }
});

test('Admin Mode: a failed or passed run never touches the real save', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1 });
  await page.evaluate(() => (window as any).__ws.shell.setAdminMode(true));
  const real = await rawPlayers(page);
  await page.evaluate(() => (window as any).__ws.contexts()[0].go('board'));
  await page.waitForTimeout(400);
  const failId = (await page.evaluate(() => {
    const w = (window as any).__ws;
    const p = w.contexts()[0].save().workshops.race;
    return p.active.find((id: string) => !w.engine.evaluate('race', p.model, p.challenges[id]).passed) as string;
  }))!;
  for (let i = 0; i < 3; i++) {
    await goRun(page, 0, failId);
    await expectScreens(page, 'run');
    await skipToResults(page);
    expect((await paneTexts(page))).toContain('Not yet!');
    expect((await paneTexts(page)).some((t) => t.startsWith('Hint:'))).toBe(false); // nothing is counted in the sandbox
  }
  expect(await rawPlayers(page)).toBe(real);

  // a winning build in the sandbox
  const d = await page.evaluate((id) => {
    const w = (window as any).__ws;
    const p = w.contexts()[0].save().workshops.race;
    return { checks: p.challenges[id].stages.flatMap((s: any) => s.requirements.flatMap((r: any) => r.checks)), avail: [...w.engine.available('race', p)] as string[] };
  }, failId);
  const sol = solve(CATALOGS.race, d.checks, new Set(d.avail), { stopAtFirst: true })!;
  await page.evaluate((build) => {
    const c = (window as any).__ws.contexts()[0];
    const s = c.save();
    c.commit({ ...s, workshops: { ...s.workshops, race: { ...s.workshops.race, model: build } } });
  }, sol.build);
  await goRun(page, 0, failId);
  await expectScreens(page, 'run');
  await skipToResults(page);
  const t = await paneTexts(page);
  expect(t).toContain('It worked!');
  expect(t.some((x) => x.startsWith('New part'))).toBe(false);
  expect(await rawPlayers(page)).toBe(real);
  await page.evaluate(() => (window as any).__ws.shell.setAdminMode(false));
});

test('2P: both panes run at once and each results screen belongs to its own player', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 2 });
  const failId = (await pickChallenge(page, 0, 'race', false))!;
  const winId = (await pickChallenge(page, 1, 'race', false))!;
  await useSolution(page, 1, 'race', winId);
  await goRun(page, 0, failId);
  await goRun(page, 1, winId);
  await expectScreens(page, 'run,run');
  await page.waitForTimeout(550);
  await key(page, 'Escape'); // KB1 = pane 0 only
  await expectScreens(page, 'results,run');
  await key(page, 'Backspace'); // KB2 = pane 1
  await expectScreens(page, 'results,results');
  await page.waitForTimeout(600);
  const t0 = await paneTexts(page, 0);
  const t1 = await paneTexts(page, 1);
  expect(t0).toContain('Not yet!');
  expect(t0).toContain('✗');
  expect(t0).not.toContain('✓');
  expect(t1).toContain('It worked!');
  expect(t1).toContain('✓');
  expect(t1.some((x) => x.startsWith('New part'))).toBe(false);
  expect((await saved(page, 'p1')).fails[failId]).toBe(1);
  expect((await saved(page, 'p1')).completed[failId]).toBeUndefined();
  expect((await saved(page, 'p2')).completed[winId].payout).toBeGreaterThan(0);
  expect((await saved(page, 'p2')).fails[winId] ?? 0).toBe(0);
  await expectCleanLayout(page, 0);
  await expectCleanLayout(page, 1);
  await shot(page, 'results-2p');
});

test('Dino Lab: a run plays through (fast-forward) and reaches the results', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1, ws: 'dino' });
  const id = (await pickChallenge(page, 0, 'dino', false))!;
  await goRun(page, 0, id);
  await expectScreens(page, 'run');
  await page.waitForTimeout(550);
  await key(page, 'Space');
  await expectScreens(page, 'results', 60_000);
  await page.waitForTimeout(600);
  expect(await paneTexts(page)).toContain('Not yet!');
  await expectCleanLayout(page, 0);
  expect((await saved(page, 'p1', 'dino')).fails[id]).toBe(1);
});

/** Puts the biggest generated challenge of an Admin Mode sandbox in the pane and returns its id. */
async function bigChallenge(page: Page, ws: Ws, minStages: number): Promise<string> {
  return page.evaluate(({ ws, minStages }) => {
    const w = (window as any).__ws;
    const c = w.contexts()[0];
    let best: { id: string; reqs: number; progress: any } | undefined;
    for (let seed = 1; seed <= 60; seed++) {
      const p = w.engine.adminSandbox(ws, w.engine.progressOf(c.save(), ws), seed, 10);
      for (const id of p.active) {
        const ch = p.challenges[id];
        const reqs = ch.stages.reduce((n: number, s: any) => n + s.requirements.length, 0);
        if (ch.stages.length >= minStages && (!best || reqs > best.reqs)) best = { id, reqs, progress: p };
      }
    }
    if (!best) throw new Error('no multi-stage challenge found');
    w.shell.sandboxes.set('p1', ws, best.progress);
    return best.id;
  }, { ws, minStages });
}

for (const [layout, players] of [['wide', 1], ['tall', 2]] as const) {
  test(`multi-stage challenge at Hard reading plays to results and fits the ${layout} pane`, async ({ page }) => {
    await boot(page);
    await enter(page, { players, reading: 'hard' });
    await page.evaluate(() => (window as any).__ws.shell.setAdminMode(true));
    const id = await bigChallenge(page, 'race', 3);
    await goRun(page, 0, id);
    await expectScreens(page, players === 2 ? 'run,board' : 'run');
    await page.waitForTimeout(550);
    await key(page, 'Space'); // fast-forward through all the stages
    await expectScreens(page, players === 2 ? 'results,board' : 'results', 90_000);
    await page.waitForTimeout(600);
    const info = await paneTextInfo(page);
    const marks = info.filter((t) => t.text === '✓' || t.text === '✗');
    const stageBadges = info.filter((t) => /^[1-3]$/.test(t.text));
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(stageBadges.length).toBeGreaterThanOrEqual(1);
    await expectCleanLayout(page, 0);
    await shot(page, `results-multistage-${layout}`);
    // page through when the list is long
    const pages = info.find((t) => /^\d \/ \d$/.test(t.text));
    if (layout === 'tall') expect(pages, 'a long Hard checklist is paged in the tall pane').toBeTruthy();
    if (pages) {
      const n = Number(pages.text.split(' / ')[1]);
      for (let p = 2; p <= n; p++) {
        await key(page, 'KeyD'); // right at the right-most button flips the page
        await page.waitForTimeout(200);
        expect(await screens(page)).toContain('results');
        expect(await paneTexts(page)).toContain(`${p} / ${n}`);
        await expectCleanLayout(page, 0);
        await shot(page, `results-multistage-${layout}-p${p}`);
      }
    }
    await page.evaluate(() => (window as any).__ws.shell.setAdminMode(false));
  });
}

test('Dino Lab: aborting runs early leaves no orphaned tweens behind', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1, ws: 'dino' });
  const id = (await pickChallenge(page, 0, 'dino', false))!;
  const tweenCount = () => page.evaluate(() => (window as any).__ws.panes[0].tweens.getTweens().length as number);
  const abort = async (): Promise<void> => {
    await goRun(page, 0, id);
    await expectScreens(page, 'run');
    await page.waitForTimeout(1500); // let the scenario start its loops (clouds, sun, gait...)
    await skipToResults(page);
    await page.evaluate(() => (window as any).__ws.contexts()[0].go('board'));
    await expectScreens(page, 'board');
    await page.waitForTimeout(300);
  };
  await abort(); // warm-up: lazily created screens may add a few persistent tweens
  const base = await tweenCount();
  for (let i = 0; i < 5; i++) await abort();
  expect(await tweenCount()).toBeLessThanOrEqual(base);
});
