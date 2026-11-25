import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('one online visit prepares the launcher and both games for offline play', async ({ context, page }) => {
  const workshopTitle = () => page.waitForFunction(() =>
    (window as Window & { __ws?: { state(): { scene: string } } }).__ws?.state().scene === 'title');
  await page.goto('./workshop.html');
  await workshopTitle();
  // A controlling worker has finished installing and precaching its manifest.
  await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated');

  // Mark the current network HTML so serving the old precached HTML would fail this check.
  await context.route('**/racer.html', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'x-test-build': 'current' } });
  });
  const racerTitle = () => page.waitForFunction(() => window.__game?.scene.isActive('Title'));
  const racer = await page.goto('./racer.html');
  await racerTitle();
  expect(racer?.fromServiceWorker()).toBe(true);
  expect(await racer?.headerValue('x-test-build')).toBe('current');
  await context.unroute('**/racer.html');

  await context.setOffline(true);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await racerTitle();

  // The TV wrapper appends a fresh timestamp even when the device is offline.
  expect((await page.goto('./?v=123456789'))?.fromServiceWorker()).toBe(true);
  await page.waitForURL('**/racer.html?v=123456789');
  await racerTitle();
  await page.goto('./index.html');
  await expect(page.getByRole('heading', { name: 'Pick a game!' })).toBeVisible();

  await page.goto('./workshop.html');
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await workshopTitle();

  const manifestUrl = new URL('audio/manifest.json', page.url()).href;
  const manifestResponse = page.waitForResponse(manifestUrl);
  const manifest = await page.evaluate(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    return response.json();
  }, manifestUrl);
  expect(manifest).toHaveProperty('music.title.file', 'music/title.ogg');
  expect((await manifestResponse).fromServiceWorker()).toBe(true);

  for (const [path, signature] of [
    ['audio/music/title.ogg', [79, 103, 103, 83]], // OggS
    ['audio/workshop/music/title.ogg', [79, 103, 103, 83]],
    ['scenes/scene_001.png', [137, 80, 78, 71]], // PNG
  ] as const) {
    const assetUrl = new URL(path, page.url()).href;
    const assetResponse = page.waitForResponse((response) => response.url() === assetUrl);
    expect(await page.evaluate(async (url) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
      return [...new Uint8Array(await response.arrayBuffer(), 0, 4)];
    }, assetUrl)).toEqual(signature);
    expect((await assetResponse).fromServiceWorker()).toBe(true);
  }

  await context.setOffline(false);
  await page.goto('./workshop.html?nosw=1');
  await page.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration()));
  await page.reload();
  await workshopTitle();
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
});
