import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import { CAT, DEPTH, DINO, FARM_TRAFFIC, TRACTOR_SPEC } from '../../src/config/gameConfig';
import { TEX } from '../../src/core/assetKeys';
import type { RaceContext } from '../../src/core/race';
import type { HayWagon } from '../../src/entities/HayWagon';
import { installGamepadMock } from './gamepadMock';

declare global {
  interface Window {
    __game: Phaser.Game;
    __race: RaceContext;
  }
}

test.use({ viewport: { width: 1920, height: 1080 } });

const WAIT = { timeout: 20_000 };
const THROTTLE = ['KeyW', 'ArrowUp'] as const;

async function waitScene(page: Page, key: string) {
  await page.waitForFunction((scene) => window.__game?.scene.isActive(scene), key, WAIT);
}

async function waitForGo(page: Page) {
  await page.waitForFunction(() => window.__race?.elapsedSec > 0.25, undefined, WAIT);
}

/** What the farm renderer put in the scene (drive-through fences, golden grade, blades). */
async function farmState(page: Page) {
  return page.evaluate(() => {
    const { scene, settings, world } = window.__race;
    const bodies = scene.matter.world.getAllBodies();
    const fenceBodies = bodies.filter((b) => (b as { plugin?: { owner?: { kind: string } } }).plugin?.owner?.kind === 'fence').length;
    const textures = new Set(scene.children.list.map((o) => (o as Phaser.GameObjects.Image).texture?.key));
    return {
      map: settings.map,
      farm: !!world.farm,
      fences: world.farm?.fences.length ?? 0,
      fenceBodies,
      grade: !!scene.children.getByName('farm-golden-hour'),
      barn: textures.has('farm_lot_barn'),
      blades: textures.has('farm_turbine_blade') && textures.has('farm_windmill_blade'),
      grainWindmill: !!scene.children.getByName('farm-grain-windmill'),
      farmTileset: scene.textures.exists('world_tileset_farm'),
    };
  });
}

for (const count of [1, 2] as const) {
  const layout = count === 1 ? 'solo' : 'split';
  test(`seeded Farm ${layout} reaches GO, renders the farm and both cars drive`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/?race=${count}&map=farm&seed=3&questions=off`);
    await waitForGo(page);
    const state = await farmState(page);
    expect(state.map).toBe('farm');
    expect(state.farm).toBe(true);
    expect(state.fences).toBeGreaterThan(0);
    expect(state.fenceBodies).toBe(0);
    expect(state).toMatchObject({ grade: true, barn: true, blades: true, grainWindmill: true, farmTileset: true });
    expect(await page.evaluate(() => window.__race.camera.layout().mode)).toBe(count === 1 ? 'single' : 'split');

    await page.waitForFunction(() => window.__race.elapsedSec > 1.2, undefined, WAIT);
    const screenshot = testInfo.outputPath(`farm-${layout}.png`);
    await page.screenshot({ path: screenshot });
    await testInfo.attach(`farm-${layout}`, { path: screenshot, contentType: 'image/png' });

    const start = await page.evaluate(() => window.__race.players.map((c) => ({ x: c.x, y: c.y })));
    const keys = THROTTLE.slice(0, count);
    for (const key of keys) await page.keyboard.down(key);
    try {
      await page.waitForFunction((s) => window.__race.players.every((c, i) => Math.hypot(c.x - s[i].x, c.y - s[i].y) > 150),
        start, WAIT);
    } finally {
      for (const key of keys) await page.keyboard.up(key);
    }
    expect(errors).toEqual([]);
  });
}

test('Setup can select Farm', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installGamepadMock(page, 0);
  await page.addInitScript(() => {
    localStorage.setItem('brainracer.settings.v1', JSON.stringify({ challengeMode: 'off', map: 'city' }));
    localStorage.setItem('brainracer.content.v1', JSON.stringify({ overrides: { industrial: true, farm: true } }));
  });
  await page.goto('/?questions=off');
  await waitScene(page, 'Title');
  await page.keyboard.press('Space');
  await page.waitForTimeout(800); // Title allows time for a second player to join.
  await page.keyboard.press('Space');
  await waitScene(page, 'Setup');
  // From Racer, go up to Start and then Map. City → Factory → Farm.
  for (let row = 0; row < 2; row++) {
    await page.keyboard.press('KeyW', { delay: 55 });
    await page.waitForTimeout(55);
  }
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(80);
  await page.keyboard.press('KeyD');
  await page.keyboard.press('Space');
  await waitScene(page, 'Race');
  await waitForGo(page);
  const state = await farmState(page);
  expect(state.map).toBe('farm');
  expect(state.farm).toBe(true);
  expect(state.grade).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('brainracer.settings.v1')!).map)).toBe('farm');
  expect(errors).toEqual([]);
});

test('a hay wagon keeps its body and can roll again after a dino toss', async ({ page }) => {
  await page.goto('/?race=1&map=farm&seed=3&questions=off&dino=now');
  await page.waitForFunction(({ ready, key }) => {
    const race = window.__race;
    return race?.dino.active && race.elapsedSec > ready
      && [...race.npcs].some(npc => npc.appearanceKey === key && (npc as HayWagon).hitched);
  }, { ready: DINO.devSpawnDelaySec + DINO.dropSec + DINO.graceSec + 0.25, key: TEX.farm.hayWagon }, WAIT);

  const id = await page.evaluate((key) => {
    const { scene, dino, npcs } = window.__race;
    const wagon = [...npcs].find(npc => npc.appearanceKey === key && (npc as HayWagon).hitched)!;
    const hitch = scene.matter.world.getAllConstraints().find(c => c.bodyB === wagon.body)!;
    const x = dino.x - Math.sin(dino.angle) * 55, y = dino.y + Math.cos(dino.angle) * 55;
    const dx = x - wagon.x, dy = y - wagon.y;
    const tractor = hitch.bodyA!;
    scene.matter.body.setPosition(tractor, { x: tractor.position.x + dx, y: tractor.position.y + dy });
    scene.matter.body.setPosition(wagon.body, { x, y });
    return wagon.body.id;
  }, TEX.farm.hayWagon);

  await page.waitForFunction(({ id, depth }) => {
    const wagon = [...window.__race.npcs].find(npc => npc.body.id === id) as HayWagon | undefined;
    return wagon && !wagon.hitched && wagon.view.depth === depth && wagon.sprite.displayWidth > wagon.spec.length;
  }, { id, depth: DEPTH.fx }, WAIT);

  await page.waitForFunction(({ id, player }) => {
    const wagon = [...window.__race.npcs].find(npc => npc.body.id === id);
    return wagon && !wagon.destroyed && !!(wagon.body.collisionFilter.mask! & player);
  }, { id, player: CAT.player }, WAIT);
});

test('a player ramming a hitched wagon pushes it sideways', async ({ page }) => {
  await page.goto('/?race=1&map=farm&seed=3&questions=off');
  await waitForGo(page);
  await page.waitForFunction(key => [...window.__race.npcs].some(npc => npc.appearanceKey === key), TEX.farm.hayWagon, WAIT);

  const start = await page.evaluate(({ key, tractorLength, gap }) => {
    const { scene, players, world, npcs } = window.__race;
    const car = players[0];
    const wagon = [...npcs].find(npc => npc.appearanceKey === key) as HayWagon;
    const hitch = scene.matter.world.getAllConstraints().find(c => c.bodyB === wagon.body)!;
    const tractor = hitch.bodyA!;
    const bodies = scene.matter.world.getAllBodies();
    const lane = world.laneGraph.nodes.find(({ x, y }) => !scene.matter.query.region(bodies, {
      min: { x: x - 158, y: y - 158 }, max: { x: x + 158, y: y + 158 },
    }).length)!;
    const { x, y } = lane;
    // Put the tractor and its real hitch on a clear patch, with the player facing the wagon side.
    const { angle } = tractor;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const distance = (car.spec.length + wagon.spec.width) / 2 + 10;
    const hitchDistance = (tractorLength + wagon.spec.length) / 2 + gap;
    scene.matter.body.setPosition(tractor, { x: x + hitchDistance * cos, y: y + hitchDistance * sin });
    scene.matter.body.setStatic(tractor, true);
    wagon.setPose(x, y, angle);
    scene.matter.body.setPosition(car.body, { x: x - 30 * cos - distance * sin, y: y - 30 * sin + distance * cos });
    scene.matter.body.setAngle(car.body, angle - Math.PI / 2);
    scene.matter.body.setVelocity(car.body, { x: 0, y: 0 });
    return { id: wagon.body.id, x, y, cos, sin };
  }, { key: TEX.farm.hayWagon, tractorLength: TRACTOR_SPEC.length, gap: FARM_TRAFFIC.wagonGapPx });

  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction(({ id, x, y, cos, sin }) => {
      const wagon = [...window.__race.npcs].find(npc => npc.body.id === id) as HayWagon | undefined;
      return wagon?.hitched && (wagon.y - y) * cos - (wagon.x - x) * sin < -12;
    }, start, WAIT);
  } finally { await page.keyboard.up('KeyW'); }
});

test('a driven-through Farm fence restores after both players leave', async ({ page }) => {
  await page.goto('/?race=2&map=farm&seed=3&questions=off');
  await waitForGo(page);
  const fence = await page.evaluate(() => {
    const { players, scene } = window.__race;
    const sections = scene.children.list.filter(o => o.name === 'farm-fence-section') as Phaser.GameObjects.Image[];
    const section = sections.find(o => o.x > 2200 && o.y > 1800)!;
    const { x, y, rotation } = section;
    const heading = rotation - Math.PI / 2;
    scene.matter.body.setPosition(players[0].body, { x: x - Math.cos(heading) * 70, y: y - Math.sin(heading) * 70 });
    scene.matter.body.setAngle(players[0].body, heading);
    scene.matter.body.setVelocity(players[0].body, { x: 0, y: 0 });
    scene.matter.body.setPosition(players[1].body, { x: x - Math.cos(heading) * 200, y: y - Math.sin(heading) * 200 });
    return { x, y, rotation, index: sections.indexOf(section) };
  });

  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction(({ x, y, index }) => {
      const section = window.__race.scene.children.list.filter(o => o.name === 'farm-fence-section')[index] as Phaser.GameObjects.Image;
      return Math.hypot(section.x - x, section.y - y) > 25;
    }, fence, WAIT);
  } finally { await page.keyboard.up('KeyW'); }

  const leave = (player: number) => page.evaluate((i) => {
    const { players, scene } = window.__race;
    scene.matter.body.setPosition(players[i].body, { x: 520 + i * 100, y: 520 });
    scene.matter.body.setVelocity(players[i].body, { x: 0, y: 0 });
  }, player);
  await leave(0);
  await page.waitForTimeout(750);
  expect(await page.evaluate(({ index, rotation }) => {
    const section = window.__race.scene.children.list.filter(o => o.name === 'farm-fence-section')[index] as Phaser.GameObjects.Image;
    return section.rotation !== rotation;
  }, fence)).toBe(true);
  await leave(1);
  await page.waitForFunction(({ x, y, index }) => {
    const section = window.__race.scene.children.list.filter(o => o.name === 'farm-fence-section')[index] as Phaser.GameObjects.Image;
    return section.x === x && section.y === y;
  }, fence, WAIT);
});
