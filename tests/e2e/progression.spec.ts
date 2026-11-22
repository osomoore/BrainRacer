import { expect, test, type Page } from '@playwright/test';
import { WORLD_REWARDS } from '../../src/config/collectibles';
import { installGamepadMock, tapPad } from './gamepadMock';
import { seedProfiles } from './profiles';

test.beforeEach(({ page }) => seedProfiles(page)); // Robin (p1), Sam (p2), Kim (p3), Lee (p4)

type Racers = Record<string, { worlds: string[]; items: string[]; overrides: Record<string, boolean> }>;
const racers = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('brainracer.racers.v1') ?? '{}') as Racers);
const items = async (page: Page, racer: string) => (await racers(page))[racer]?.items ?? [];
const seedRacers = (page: Page, seed: Record<string, { worlds?: string[]; items?: string[] }>) => page.addInitScript(value => {
  const key = 'brainracer.racers.v1';
  if (localStorage.getItem(key)) return;
  const empty = { worlds: [], items: [], overrides: {} };
  localStorage.setItem(key, JSON.stringify(Object.fromEntries(['p2', 'p1', 'p3', 'p4'].map(id => [id, { ...empty, ...value[id] }]))));
}, seed);

async function waitScene(page: Page, key: string) {
  await page.waitForFunction(name => window.__game?.scene.isActive(name), key);
}

async function tap(page: Page, key: string) {
  await page.keyboard.press(key, { delay: 65 });
  await page.waitForTimeout(65);
}

async function finishRound(page: Page, objectives = 3) {
  await page.waitForFunction(() => window.__race?.elapsedSec > 0);
  await page.evaluate(count => {
    const race = window.__race;
    for (let i = 0; i < count; i++) {
      race.bus.emit('goal:completed', { goal: race.goal!, arrived: race.players.map(player => player.player) });
    }
    race.elapsedSec = race.roundLengthSec;
  }, objectives);
  await waitScene(page, 'Results');
}

async function waitSummary(page: Page) {
  await page.waitForFunction(() => window.__game.scene.getScene('Results').children.getByName('results-actions'));
  await page.waitForTimeout(1300);
}

test('two objectives replay the City and three reveal Factory before the racer reward', async ({ page }) => {
  await seedRacers(page, { p1: { items: ['owl'] } });
  await page.goto('/?race=1&seed=3&questions=off'); // One player: Robin.
  await waitScene(page, 'Race');
  expect(await items(page, 'p1')).toEqual(['owl']);
  expect(await page.evaluate(() => window.__race.settings.map)).toBe('city');

  await finishRound(page, 2);
  await waitSummary(page);
  expect(await racers(page)).toMatchObject({ p1: { worlds: [], items: ['owl'] } });
  await tap(page, 'Space');
  await waitScene(page, 'Race');
  expect(await page.evaluate(() => window.__race.settings.map)).toBe('city');

  await finishRound(page);
  expect(await page.evaluate(() => !!window.__game.scene.getScene('Results').children.getByName('world-unlock-reveal'))).toBe(true);
  await page.waitForFunction(() => {
    const children = window.__game.scene.getScene('Results').children;
    return !children.getByName('world-unlock-reveal') && children.getByName('collectible-reveal');
  });
  await waitSummary(page);
  const after = await racers(page);
  expect(after.p1.worlds).toContain('industrial');
  expect(after.p1.items).toHaveLength(2);
  expect(after.p1.items[0]).toBe('owl');
  const cityRewards = [...WORLD_REWARDS.city.cars, WORLD_REWARDS.city.buddy] as string[];
  expect(cityRewards).toContain(after.p1.items[1]);
  expect(after.p2).toMatchObject({ worlds: [], items: [] });

  await tap(page, 'Space');
  await waitScene(page, 'Race');
  expect(await page.evaluate(() => window.__race.settings.map)).toBe('industrial');
  expect(await racers(page)).toEqual(after);
});

test('each racer earns their own reward in turn and keeps it after a reload', async ({ page }) => {
  await installGamepadMock(page, 2);
  await seedRacers(page, { p2: { items: ['brickBuggy'] }, p1: { items: ['owl'] } });
  await page.goto('/?seed=4&questions=off');
  await waitScene(page, 'Title');
  await tapPad(page, 0, 0);   // Title -> Join (P1)
  await waitScene(page, 'Setup');
  await page.waitForTimeout(400);
  await tapPad(page, 1, 0);   // P2 joins
  await page.waitForTimeout(300);

  // P1 = Robin (starters + Night Owl), P2 = Sam (starters + Brick Buggy): each list is that racer's own.
  await tapPad(page, 0, 13); // P1 Questions.
  await tapPad(page, 0, 13); // P1 Car.
  await tapPad(page, 0, 14); // Left from Dino wraps to the last car: Kart (Robin owns no extra car).
  await tapPad(page, 0, 13); // P1 Guide.
  await tapPad(page, 0, 15); // Star -> Night Owl.
  await page.waitForTimeout(300);
  await tapPad(page, 1, 13); // P2 Questions.
  await page.waitForTimeout(150);
  await tapPad(page, 1, 13); // P2 Car.
  await page.waitForTimeout(300);
  await tapPad(page, 1, 14); // P2 defaults to Kart: left to Dino,
  await tapPad(page, 1, 14); // then wrapping to Sam's Brick Buggy.
  await page.waitForTimeout(500);
  await tapPad(page, 1, 0);   // P2 ready
  await tapPad(page, 0, 0);   // P1 ready
  await page.waitForTimeout(700);
  await tapPad(page, 0, 0);   // P1 Next
  await waitScene(page, 'TrackSelect');
  await page.waitForTimeout(500);
  await tapPad(page, 0, 0);   // P1 Start
  await waitScene(page, 'Race');
  const loadouts = await page.evaluate(() => window.__race.settings.players.map((player, slot) => ({
    car: window.__race.players[slot].kind,
    racer: player.profile,
  })));
  expect(loadouts).toEqual([{ car: 'kart', racer: 'p1' }, { car: 'brickBuggy', racer: 'p2' }]);
  expect(await page.evaluate(() => window.__race.settings.players[0].guide)).toBe('owl');

  await finishRound(page);
  await page.waitForFunction(() => window.__game.scene.getScene('Results').children.getByName('collectible-reveal'));
  await page.waitForFunction(() => ((window.__game.scene.getScene('Results').children.getByName('collectible-reveal') as unknown as { list: { text?: string }[] } | null)?.list ?? []).some(o => /ROBIN'S REWARD REEL/.test(o.text ?? '')));
  await page.waitForFunction(() => ((window.__game.scene.getScene('Results').children.getByName('collectible-reveal') as unknown as { list: { text?: string }[] } | null)?.list ?? []).some(o => /ROBIN GOT .*!/.test(o.text ?? '')));
  await page.waitForFunction(() => ((window.__game.scene.getScene('Results').children.getByName('collectible-reveal') as unknown as { list: { text?: string }[] } | null)?.list ?? []).some(o => /SAM'S REWARD REEL/.test(o.text ?? '')), undefined, { timeout: 20000 });
  await waitSummary(page);

  const after = await racers(page);
  const city = [...WORLD_REWARDS.city.cars, WORLD_REWARDS.city.buddy] as string[];
  expect(after.p1.items).toHaveLength(2);
  expect(after.p2.items).toHaveLength(2);
  expect(city).toContain(after.p1.items[1]);
  expect(city).toContain(after.p2.items[1]);
  expect(after.p1.items[1]).not.toBe(after.p2.items[1]); // Distinct when each has a choice.
  expect(after.p1.worlds).toContain('industrial');
  expect(after.p2.worlds).toContain('industrial');
  expect(after.p3).toMatchObject({ worlds: [], items: [] });

  await page.reload();
  await waitScene(page, 'Title');
  expect(await racers(page)).toEqual(after);
});

test('Admin Mode previews locked loadouts and Racer Unlocks can open a world for normal play', async ({ page }) => {
  await seedRacers(page, { p1: { items: ['owl'] } });
  await page.goto('/?questions=off');
  await waitScene(page, 'Title');
  await tap(page, 'Space');   // Title -> Join
  await waitScene(page, 'Setup');

  const toggleDeveloperMode = async (scene: string) => {
    await tap(page, 'F9');
    await page.waitForFunction(name => window.__game.scene.isPaused(name), scene);
    for (let i = 0; i < 6; i++) await tap(page, 'KeyW');   // wraps to Close, then up to Admin Mode
    await tap(page, 'KeyD');
    await tap(page, 'Space');
    await waitScene(page, scene);
  };
  await toggleDeveloperMode('Setup');
  await page.waitForTimeout(300);
  await tap(page, 'KeyS'); // Questions.
  await tap(page, 'KeyS'); // Car.
  await tap(page, 'KeyD');
  await tap(page, 'KeyD'); // Motor Trike.
  await tap(page, 'KeyS'); // Guide.
  await tap(page, 'KeyD');
  await tap(page, 'KeyD'); // Bumblebee, since non-Dino cars default to the star.
  await tap(page, 'Space');   // ready
  await page.waitForTimeout(700);
  await tap(page, 'Space');   // Next
  await waitScene(page, 'TrackSelect');
  await page.waitForTimeout(500);
  await tap(page, 'Space');   // Start
  await waitScene(page, 'Race');
  expect(await page.evaluate(() => ({
    round: window.__race.roundLengthSec,
    car: window.__race.players[0].kind,
    guide: window.__race.settings.players[0].guide,
    guideVisible: window.__race.scene.children.list.some(o => 'texture' in o && (o.texture as { key: string }).key === 'buddy_bumblebee'),
  }))).toEqual({ round: 60, car: 'motorTrike', guide: 'bumblebee', guideVisible: true });

  await finishRound(page);
  await waitSummary(page);
  expect(await items(page, 'p1')).toEqual(['owl']);
  await toggleDeveloperMode('Results');
  await page.waitForTimeout(500);
  await tap(page, 'F9');
  await page.waitForFunction(() => window.__game.scene.isPaused('Results'));
  await tap(page, 'KeyW'); // Close.
  await tap(page, 'KeyW'); // Racer Profiles.
  await tap(page, 'KeyW'); // Racer Unlocks.
  await tap(page, 'Space');
  await tap(page, 'KeyS'); // Category.
  await tap(page, 'KeyS'); // Factory.
  await tap(page, 'KeyD'); // Auto (Locked) to Open.
  await tap(page, 'Backspace'); // Back to Admin Settings.
  await tap(page, 'Escape'); // Back to Results.
  await waitScene(page, 'Results');
  await tap(page, 'KeyD'); // Setup lets players manually choose the next map.
  await tap(page, 'Space');
  await waitScene(page, 'Setup');
  await page.waitForTimeout(300);
  await tap(page, 'Space');   // ready
  await page.waitForTimeout(700);
  await tap(page, 'Space');   // Next
  await waitScene(page, 'TrackSelect');
  await page.waitForTimeout(500);
  await tap(page, 'KeyD'); // Factory.
  await tap(page, 'Space');
  await waitScene(page, 'Race');
  expect(await page.evaluate(() => ({
    map: window.__race.settings.map,
    round: window.__race.roundLengthSec,
    car: window.__race.players[0].kind,
    guide: window.__race.settings.players[0].guide,
  }))).toEqual({ map: 'industrial', round: 300, car: 'dino', guide: 'dino' });
});
