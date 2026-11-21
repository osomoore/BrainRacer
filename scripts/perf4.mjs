// Spike: BRAINRACER_PERF=1 node scripts/perf4.mjs  (needs `vite preview --port 5199 --strictPort` running,
// built with VITE_ALLOW_QUESTIONS_OFF=1). Not part of the normal e2e run.
import { chromium } from '@playwright/test';

if (process.env.BRAINRACER_PERF !== '1') { console.log('skipped (set BRAINRACER_PERF=1)'); process.exit(0); }
const base = process.env.PERF_URL || 'http://localhost:5199';
const maps = (process.env.PERF_MAPS || 'city,volcano,brickworks,forest').split(',');
const browser = await chromium.launch({ channel: 'msedge' });
const rows = [];
for (const map of maps) for (const views of [2, 4]) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${base}/?dev=FourViewPerf&map=${map}&seed=3&questions=off&round=600&views=${views}`);
  await page.waitForFunction(() => window.__perf && window.__perf.done, null, { timeout: 120000, polling: 1000 });
  const r = await page.evaluate(() => window.__perf);
  if (process.env.PERF_SHOTS) await page.screenshot({ path: `${process.env.PERF_SHOTS}/${map}-${views}.png` });
  console.log(JSON.stringify(r));
  rows.push(r);
  await page.close();
}
console.log('\nmap | views | avg FPS | 1% low | avg ms');
for (const r of rows) console.log(`${r.map} | ${r.views} | ${r.avgFps} | ${r.low1Fps} | ${r.avgMs}`);
await browser.close();
