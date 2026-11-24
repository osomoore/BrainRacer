const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const shots = path.join(__dirname, 'shots');
const portArg = process.argv.indexOf('--port');
const port = Number(portArg > 0 ? process.argv[portArg + 1] : process.env.ART_REVIEW_PORT) || 5198;
const base = `http://localhost:${port}`;
const shapesOnly = process.argv.includes('--shapes');
const crypto = require('node:crypto');
const noOpen = process.argv.includes('--no-open');
const viewQuery = (shapesOnly ? '&art=shapes' : '') + '&freeze=1';

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const { createServer } = await import('vite');
  const server = await createServer({ root, server: { port, strictPort: true } });
  let browser;
  try {
    await server.listen();
    if (server.httpServer.address()?.port !== port) throw new Error(`Vite did not bind port ${port}`);
    browser = await chromium.launch({ channel: 'msedge' });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/workshop.html?dev=WorkshopParts${viewQuery}`);
    const catalog = await page.evaluate(async () => {
      const { CATALOGS } = await import('/apps/workshop/content/index.ts');
      const shops = ['dino', 'race'].map(id => ({
        id,
        title: CATALOGS[id].title,
        aspects: CATALOGS[id].aspects.map(aspect => ({
          id: aspect.id,
          label: aspect.label,
          top: aspect.visibleFromTop,
          variants: CATALOGS[id].variants.filter(variant => variant.aspect === aspect.id)
            .map(({ id, name }) => ({ id, name })),
        })),
      }));
      const { BEAK_LOOKS } = await import('/apps/workshop/art/dino/looks.ts');
      shops.find(shop => shop.id === 'dino').aspects.push({
        id: 'beak-review', label: 'Beak alternatives', top: true,
        sheet: 'shots/beak-designs.png',
        variants: BEAK_LOOKS.map(({ name }, index) => ({ id: `beak.profile-${index + 1}`, name })),
      });
      return shops;
    });
    /** Hash each variant's side+top pixels (labels excluded). Stored per variant so the grader can spot changed art. */
    async function fingerprints(count) {
      const cells = await page.evaluate(() => window.__partsCells);
      if (!cells || cells.count !== count) throw new Error(`Cell layout mismatch: ${JSON.stringify(cells)} vs ${count} variants`);
      const hashes = [];
      for (let i = 0; i < count; i++) {
        const hash = crypto.createHash('sha1');
        for (const region of [cells.side, cells.top]) {
          hash.update(await page.screenshot({ clip: { x: Math.round(cells.cw * i), y: region.y, width: Math.round(cells.cw), height: region.h } }));
        }
        hashes.push(hash.digest('hex').slice(0, 16));
      }
      return hashes;
    }
    async function capture(file, query, variants, wait = 320) {
      await page.goto(`${base}/workshop.html?dev=${query}${viewQuery}`);
      await page.locator('canvas').waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(shots, `${file}.png`) });
      (await fingerprints(variants.length)).forEach((hash, i) => { variants[i].hash = hash; });
      console.log(`Captured ${file}`);
    }
    for (const shop of catalog) {
      for (const aspect of shop.aspects.filter(part => part.id !== 'beak-review')) {
        await capture(`grade-${shop.id}-${aspect.id}`, `WorkshopParts&workshop=${shop.id}&aspect=${aspect.id}`, aspect.variants);
      }
    }
    await capture('beak-designs', 'WorkshopParts&workshop=dino&page=beaks',
      catalog.find(shop => shop.id === 'dino').aspects.find(part => part.id === 'beak-review').variants);
    fs.writeFileSync(path.join(shots, 'review-catalog.js'), `window.reviewCatalog = ${JSON.stringify(catalog, null, 2)};\n`, 'utf8');
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`Captured ${catalog.reduce((sum, shop) => sum + shop.aspects.filter(part => part.id !== 'beak-review').reduce((n, part) => n + part.variants.length, 0), 0)} catalogue variants across both views.`);
  } catch (error) {
    await server.close();
    throw error;
  } finally {
    if (browser) await browser.close();
  }
  const url = `${base}/tools/art-review/grade.html`;
  if (noOpen) console.log(`Reviewer ready (not opening a browser): ${url}`);
  else {
    console.log(`Opening reviewer: ${url}`);
    spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  }
  console.log(`Vite stays open on port ${port}. Press Ctrl+C in this terminal when finished reviewing.`);
  process.once('SIGINT', () => server.close().then(() => process.exit(0)));
})().catch(error => { console.error(error); process.exitCode = 1; });
