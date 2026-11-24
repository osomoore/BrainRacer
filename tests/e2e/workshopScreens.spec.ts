import { expect, test, type Page } from '@playwright/test';
import { seedProfiles } from './profiles';

/** Adventure Workshop: room, station and board screens (keyboard, touch, 2P split). Hooks: window.__ws. */

type Reading = 'easy' | 'medium' | 'hard';

const screens = (page: Page) => page.evaluate(() => (window as any).__ws.screens() as string[]);
const expectScreens = (page: Page, want: string) => expect.poll(async () => (await screens(page)).join(','), { timeout: 15_000 }).toBe(want);
const key = async (page: Page, k: string) => { await page.keyboard.press(k); await page.waitForTimeout(150); };

async function boot(page: Page, url = '/workshop.html'): Promise<void> {
  await seedProfiles(page);
  await page.goto(url);
  await page.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });
  await page.waitForTimeout(300);
}

/** Joins with the keyboard (1P or 2P), starts, and gives each pane a profile + a fresh save in `workshop`. */
async function enter(page: Page, opts: { players: 1 | 2; ws?: 'race' | 'dino'; reading?: Reading; screen?: string; data?: Record<string, unknown> }): Promise<void> {
  await key(page, 'Space');
  if (opts.players === 2) await key(page, 'Enter');
  await key(page, 'Space');
  await expectScreens(page, Array(opts.players).fill('profile').join(','));
  await page.evaluate(({ ws, reading, screen, data }) => {
    const w = (window as any).__ws;
    w.contexts().forEach((ctx: any, i: number) => {
      const id = `p${i + 1}`;
      let save = w.engine.newPlayerSave(reading);
      save = { ...save, workshops: { [ws]: w.engine.progressOf(save, ws) } };
      w.store.setPlayer(id, save);
      ctx.setProfile(id);
      ctx.setWorkshop(ws);
      ctx.go(screen, data);
    });
  }, { ws: opts.ws ?? 'race', reading: opts.reading ?? 'medium', screen: opts.screen ?? 'room', data: opts.data ?? {} });
  await expectScreens(page, Array(opts.players).fill(opts.screen ?? 'room').join(','));
  await page.waitForTimeout(300);
}

const storedModel = (page: Page, id: string, ws: string) =>
  page.evaluate(({ id, ws }) => JSON.parse(localStorage.getItem('workshop.players.v1') ?? '{}')[id]?.workshops?.[ws]?.model as Record<string, string>, { id, ws });

async function buyPart(page: Page, ws: 'race' | 'dino', aspect: string, variant?: string): Promise<string> {
  return page.evaluate(({ ws, aspect, variant }) => {
    const w = (window as any).__ws;
    const c = w.contexts()[0];
    const save = c.save();
    const p = w.engine.progressOf(save, ws);
    const offer = w.engine.shopOffers(ws, p, aspect).find((item: any) => !variant || item.variant === variant);
    if (!offer) throw new Error(`No matching shop offer for ${aspect}`);
    const result = w.engine.purchase(ws, p, aspect, offer.variant);
    if (result.status !== 'bought') throw new Error(`Could not buy ${offer.variant}: ${result.status}`);
    c.commit({ ...save, workshops: { ...save.workshops, [ws]: result.progress } });
    return offer.variant as string;
  }, { ws, aspect, variant });
}

/** Every Phaser Text currently shown in a pane (whitespace-normalised). */
const paneTexts = (page: Page, pane = 0) => page.evaluate((pane) => {
  const out: string[] = [];
  const walk = (o: any) => {
    if (o.type === 'Text' && o.visible !== false) out.push(String(o.text).replace(/\s+/g, ' ').trim());
    o.list?.forEach(walk);
  };
  (window as any).__ws.panes[pane].children.list.forEach(walk);
  return out;
}, pane);

const activeChallenges = (page: Page, id = 'p1', ws = 'race') =>
  page.evaluate(({ id, ws }) => {
    const p = JSON.parse(localStorage.getItem('workshop.players.v1') ?? '{}')[id]?.workshops?.[ws];
    return (p.active as string[]).map((c) => p.challenges[c]) as { title: string; intro: Record<string, string>; stages: { requirements: { text: Record<string, string> }[] }[] }[];
  }, { id, ws });

const roomBuddyX = (page: Page, pane = 0) => page.evaluate((index) =>
  (window as any).__ws.panes[index].children.getByName('workshop-buddy').x as number, pane);

test('room: walk to a station, pick another part, it is saved and the room reopens', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1, data: { from: 'wheels' } });
  await buyPart(page, 'race', 'wheels', 'wheels.mud');
  const before = await storedModel(page, 'p1', 'race');
  expect(before.wheels).toBe('wheels.road');
  const roomTexts = await paneTexts(page);
  for (const label of ['Wheels', 'Engine', 'Paint', 'Extra', 'Test']) expect(roomTexts).toContain(label);

  await key(page, 'Space'); // the focused sign (Wheels): the character walks, then the station opens
  await expectScreens(page, 'station');
  await page.waitForTimeout(900);
  expect(await paneTexts(page)).toContain('Wheels');
  expect(await paneTexts(page)).toContain('Road Tires ✓');
  await key(page, 'KeyD'); // preview the next tires
  await page.waitForTimeout(200);
  expect(await paneTexts(page)).toContain('Mud Tires');
  expect((await storedModel(page, 'p1', 'race')).wheels).toBe('wheels.road'); // previewing changes nothing
  await key(page, 'Space'); // Use it!
  await expectScreens(page, 'room');
  expect((await storedModel(page, 'p1', 'race')).wheels).toBe('wheels.mud');
  // On return it approaches the model from the right, instead of following the still-focused Wheels sign.
  await expect.poll(() => roomBuddyX(page)).toBeLessThan(1440);
  expect(await roomBuddyX(page)).toBeGreaterThan(960);
});

test('station: Back leaves the part as it was and guards the room', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1, ws: 'dino' });
  await buyPart(page, 'dino', 'teeth');
  await page.evaluate(() => (window as any).__ws.contexts()[0].go('station', { aspect: 'teeth' }));
  await expectScreens(page, 'station');
  await page.waitForTimeout(700);
  await key(page, 'KeyD');
  await key(page, 'Escape');
  await key(page, 'Escape');
  await expectScreens(page, 'room');
  expect(await paneTexts(page)).not.toContain('Leave the workshop?');
  expect((await storedModel(page, 'p1', 'dino')).teeth).toBe('teeth.flat');
});

test('room: B asks before returning to the workshop picker', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1 });
  await key(page, 'Escape');
  expect(await paneTexts(page)).toContain('Leave the workshop?');
  await key(page, 'Space'); // KB1 confirm: default No
  await expectScreens(page, 'room');
  await key(page, 'Escape');
  await key(page, 'KeyA'); // KB1 left selects Yes
  await key(page, 'Space');
  await expectScreens(page, 'pickWorkshop');
});

test('buddy station: a split-screen player can pick an unlocked buddy for their workshop', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 2, ws: 'dino', data: { from: 'buddies' } });
  await page.evaluate(() => {
    const [p1] = (window as any).__ws.contexts();
    const save = p1.save();
    save.workshops.dino.buddies.unlocked.push('star');
    p1.commit(save);
  });

  await key(page, 'Space');
  await expectScreens(page, 'buddyStation,room');
  expect(await paneTexts(page)).toContain('Twinkle Star');
  await key(page, 'KeyD');
  await key(page, 'Space');
  await expectScreens(page, 'room,room');

  const selections = await page.evaluate(() => {
    const { panes } = (window as any).__ws;
    const saves = JSON.parse(localStorage.getItem('workshop.players.v1') ?? '{}');
    return {
      saved: ['p1', 'p2'].map((id) => saves[id].workshops.dino.buddies.selected),
      room: panes.map((pane: any) => pane.children.getByName('workshop-buddy').texture.key),
    };
  });
  expect(selections.saved).toEqual(['star', 'dino']);
  expect(selections.room[0]).toBe('buddy_star');
  expect(selections.room[1]).toMatch(/^buddy_dino_/);
});

test('board: three challenge cards at the player reading level, Test it! opens the run', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1, reading: 'easy', screen: 'board' });
  const ch = await activeChallenges(page);
  expect(ch).toHaveLength(3);
  const easy = await paneTexts(page);
  for (const c of ch) expect(easy).toContain(c.title);
  expect(easy).toContain(ch[0].stages[0].requirements[0].text.easy);
  expect(easy).not.toContain(ch[0].stages[0].requirements[0].text.hard);
  expect(easy).toContain('Test it!');
  expect(easy).not.toContain('Wheels: Road Tires'); // no part is highlighted until the vehicle is entered

  // switch the reading level: the text changes, nothing else
  await page.evaluate(() => {
    const w = (window as any).__ws;
    const save = w.store.player('p1');
    w.store.setPlayer('p1', { ...save, reading: 'hard' });
    w.contexts()[0].go('board');
  });
  await page.waitForTimeout(500);
  const hard = await paneTexts(page);
  expect(hard).toContain(ch[0].stages[0].requirements[0].text.hard);
  expect(hard).not.toContain(ch[0].stages[0].requirements[0].text.easy);

  // move to the second card: the detail follows; A on a card starts its test run
  await key(page, 'KeyD');
  await page.waitForTimeout(300);
  expect(await paneTexts(page)).toContain(ch[1].stages[0].requirements[0].text.hard);
  await key(page, 'Space');
  await expectScreens(page, 'run');
});

for (const [ws, players, first, second] of [['race', 1, 'Wheels', 'Engine'], ['dino', 1, '', ''], ['race', 2, 'Wheels', 'Engine'], ['dino', 2, '', '']] as const) {
  test(`board ${ws} ${players}P: focus enters the vehicle part view, cycles parts, and leaves again`, async ({ page }) => {
    await boot(page);
    await enter(page, { players, ws, screen: 'board' });
    const partLabel = async () => (await paneTexts(page)).find((t) => /^[^:]+: .+/.test(t) && !t.startsWith('Hint')) ?? '';
    const [enterKey, nextKey, prevKey, leaveKey] = players === 1 ? ['KeyA', 'KeyS', 'KeyW', 'KeyD'] : ['KeyW', 'KeyD', 'KeyA', 'KeyS'];
    expect(await partLabel()).toBe('');
    await key(page, enterKey);
    const a = await partLabel();
    expect(a).not.toBe('');
    if (first) expect(a.startsWith(first)).toBe(true);
    await key(page, nextKey);
    const b = await partLabel();
    expect(b).not.toBe(a);
    if (second) expect(b.startsWith(second)).toBe(true);
    await key(page, prevKey);
    expect(await partLabel()).toBe(a);
    if (ws === 'dino') {
      await key(page, 'Escape');
      await key(page, 'Escape'); // still inside the part view's back guard
      await expectScreens(page, players === 2 ? 'board,board' : 'board');
    } else {
      await key(page, leaveKey);
    }
    expect(await partLabel()).toBe('');
    // focus is back on the challenge list: Space starts the selected test
    await key(page, 'Space');
    await expectScreens(page, players === 2 ? 'run,board' : 'run');
  });
}

test('board race: the part walk skips Gears and shows both cycle arrows', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1, ws: 'race', screen: 'board' });
  const partLabel = async () => (await paneTexts(page)).find((t) => /^[^:]+: .+/.test(t) && !t.startsWith('Hint')) ?? '';
  await key(page, 'KeyA');
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) { seen.add((await partLabel()).split(':')[0]); await key(page, 'KeyS'); }
  expect(seen.has('Wheels') && seen.has('Engine')).toBe(true);
  expect(seen.has('Gears')).toBe(false);
});

test('board: B returns to the room and reopening the board restores card focus', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1, screen: 'board' });
  const [, second] = await activeChallenges(page);
  const focusedCard = () => page.evaluate(() => {
    const pane = (window as any).__ws.panes[0];
    return pane.children.list.find((o: any) => o.isFocused)?.list.find((o: any) => o.type === 'Text')?.text as string | undefined;
  });
  await key(page, 'KeyD');
  await expect.poll(focusedCard).toBe(second.title);
  await key(page, 'Escape');
  await expectScreens(page, 'room');
  await key(page, 'Space');
  await expectScreens(page, 'board');
  await expect.poll(focusedCard).toBe(second.title);
});

test('board: Admin Mode shows ten challenges in pages and a New Challenges button', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 1, screen: 'board' });
  await page.evaluate(() => { (window as any).__ws.shell.setAdminMode(true); });
  await page.evaluate(() => (window as any).__ws.contexts()[0].go('board'));
  await page.waitForTimeout(600);
  const t = await paneTexts(page);
  expect(t).toContain('New Challenges');
  expect(t).toContain('1 / 4');
  const before = await page.evaluate(() => (window as any).__ws.contexts()[0].save().workshops.race.active.join(','));
  expect(before.split(',')).toHaveLength(10);
  // New Challenges: focus it (down from the first card, then right) and confirm
  await page.evaluate(() => (window as any).__ws.contexts()[0].go('board'));
  await page.waitForTimeout(500);
  await key(page, 'KeyS');
  await key(page, 'KeyD');
  await key(page, 'Space');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => (window as any).__ws.contexts()[0].save().workshops.race.active.join(','));
  expect(after.split(',')).toHaveLength(10);
  expect(after).not.toBe(before);
  await page.evaluate(() => { (window as any).__ws.shell.setAdminMode(false); });
});

test('2P split: both panes show the room, each in its own player colour, and move independently', async ({ page }) => {
  await boot(page);
  await enter(page, { players: 2 });
  for (const pane of [0, 1]) {
    const t = await paneTexts(page, pane);
    for (const label of ['Wheels', 'Engine', 'Test']) expect(t).toContain(label);
  }
  const geo = await page.evaluate(() => (window as any).__ws.contexts().map((c: any) => [c.layout, c.size.w]));
  expect(geo).toEqual([['tall', 960], ['tall', 960]]);
  await page.waitForTimeout(1000); // let the entry flight (WS_BUDDIES.driftMs) settle
  const [p1Home, p2Home] = await Promise.all([roomBuddyX(page, 0), roomBuddyX(page, 1)]);
  await key(page, 'KeyW');
  await expect.poll(async () => Math.abs(await roomBuddyX(page, 0) - p1Home)).toBeGreaterThan(20);
  expect(await roomBuddyX(page, 1)).toBe(p2Home);
  await key(page, 'Escape'); // KB1 only: pane 0 opens the leave confirmation
  await expectScreens(page, 'room,room');
  expect(await paneTexts(page, 0)).toContain('Leave the workshop?');
  await key(page, 'Space'); // KB1 confirm: default No
  await expectScreens(page, 'room,room');
  await key(page, 'Escape');
  await key(page, 'KeyA');
  await key(page, 'Space');
  await expectScreens(page, 'pickWorkshop,room');
});

test('mobile: tap a station sign, the character walks there and the station opens; tap Back', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  await boot(page, '/workshop.html?mobile=1');
  await page.mouse.click(800, 450);
  await expectScreens(page, 'profile');
  await page.evaluate(() => {
    const w = (window as any).__ws;
    let save = w.engine.newPlayerSave('medium');
    save = { ...save, workshops: { race: w.engine.progressOf(save, 'race') } };
    w.store.setPlayer('p1', save);
    const c = w.contexts()[0];
    c.setProfile('p1'); c.setWorkshop('race'); c.go('room');
  });
  await expectScreens(page, 'room');
  const tap = async (label: string, x: number, y: number) => {
    // The next screen can be mounted one frame before its hit targets enter Phaser's input list.
    await page.waitForFunction((label) => (window as any).__ws.panes[0].input._list.some((obj: any) =>
      obj.input?.enabled && obj.visible && obj.list?.some((child: any) => child.text === label)), label);
    await page.mouse.click(x * (1600 / 1920), y * (900 / 1080));
  };
  await tap('Wheels', 760, 110);
  await expectScreens(page, 'station');
  await tap('Back', 420, 115); // wide layout: Back sits right of the wallet badge (WS_WALLET wide x=126)
  await expectScreens(page, 'room');
  await tap('Test', 960, 950);
  await expectScreens(page, 'board');
  await ctx.close();
});
