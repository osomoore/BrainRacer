const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = 'http://localhost:5198/tools/art-review/grade.html';
    assert.equal((await page.goto(base)).status(), 200);
    await page.locator('#editor').waitFor({ state: 'visible' });
    await page.getByLabel('Workshop', { exact: true }).selectOption('dino');
    await page.getByLabel('Part', { exact: true }).selectOption('teeth');
    await page.getByRole('button', { name: /Big Teeth/ }).click();
    await page.locator('input[name=grade][value="4"]').check();
    await page.getByLabel('Comment', { exact: true }).fill('Reviewer persistence check');
    await page.reload();
    await page.getByLabel('Workshop', { exact: true }).selectOption('dino');
    await page.getByLabel('Part', { exact: true }).selectOption('teeth');
    await page.getByRole('button', { name: /Big Teeth/ }).click();
    assert.equal(await page.getByLabel('Comment', { exact: true }).inputValue(), 'Reviewer persistence check');
    assert.equal(await page.locator('input[name=grade][value="4"]').isChecked(), true);
    assert.ok((await page.evaluate(() => JSON.parse(localStorage.getItem('adventure-workshop.art-review.v1'))['dino/teeth.big'].hash)), 'saved report carries the picture hash');
    await page.getByLabel('Only changed since I graded').check();
    assert.match(await page.locator('#progress').textContent(), /to review of/);
    await page.getByLabel('Only changed since I graded').uncheck();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download JSON' }).click();
    const download = await downloadEvent;
    const entries = JSON.parse(require('node:fs').readFileSync(await download.path(), 'utf8'));
    assert.deepEqual(Object.keys(entries[0]), ['workshop', 'aspect', 'variant', 'name', 'grade', 'comment']);
    assert.deepEqual([entries[0].workshop, entries[0].aspect, entries[0].variant, entries[0].grade], ['dino', 'teeth', 'teeth.big', 4]);
    assert.deepEqual(errors, []);
    console.log('Edge verified review persistence and the feedback JSON schema.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
