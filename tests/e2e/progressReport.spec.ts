import { expect, test, type Page } from '@playwright/test';
import { seedProfiles } from './profiles';

const SHOTS = process.env.PROGRESS_REPORT_SHOTS;

async function openReport(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  await seedProfiles(page, { names: ['Robin'] });
  await page.goto('/workshop.html?mobile=0');
  await page.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });
  await page.evaluate(() => {
    const w = (window as any).__ws;
    let save = w.engine.newPlayerSave('easy');
    for (const ws of ['race', 'dino']) {
      const p = w.engine.progressOf(save, ws);
      const seed = Object.values(p.challenges).find((challenge: any) => !challenge.stages.some((stage: any) => stage.scenario === 'practice'));
      if (!seed) throw new Error(`No learning challenge available for ${ws}`);
      const completed: Record<string, any> = {};
      const learning: Record<string, any> = {};
      for (let i = 0; i < 12; i++) {
        const id = `report-${ws}-${i}`;
        p.challenges[id] = { ...seed, id, workshop: ws, title: `${ws === 'race' ? 'Race' : 'Dino'} Sample ${String(i).padStart(2, '0')}` };
        const wonAt = 1_700_000_000_000 + i * 1_000;
        completed[id] = { build: { ...p.model }, wonAt, payout: 0 };
        // Newest ten average two tries. The oldest known win averages four; one of the
        // current-window samples has legacy data and should read "tries unknown".
        const tries = i <= 1 ? 4 : 2;
        if (i !== 0) learning[id] = { tries, hintShown: i === 1, firstTryAt: wonAt - 1_000, wonAt,
          activeMs: i === 11 ? 150_000 : 65_000, failedChecks: [] };
      }
      save = { ...save, workshops: { ...save.workshops, [ws]: { ...p, completed, learning } } };
    }
    w.store.setPlayer('p1', save);
  });
  await page.keyboard.press('F9');
  await expect.poll(() => page.evaluate(() => (window as any).__ws.state().adminOpen)).toBe(true);
  await page.evaluate(() => {
    const admin = (window as any).__ws.game.scene.getScene('admin');
    admin.rows.find((row: any) => row.label === 'Robin').run();
  });
  await page.evaluate(() => {
    const admin = (window as any).__ws.game.scene.getScene('admin');
    admin.rows.find((row: any) => row.label === 'Progress report').run();
  });
  await expect(page.locator('[data-progress-report="true"]')).toBeVisible();
}

test('Workshop admin progress report shows newest wins, learning trends, legacy unknowns, and both shops', async ({ page }) => {
  await openReport(page, { width: 1920, height: 1080 });
  const report = page.locator('[data-progress-report="true"]');
  await expect(report.getByRole('heading', { name: 'Progress report' })).toBeVisible();
  await expect(report.getByText(/Average tries: 2\.0 \(last 10\) vs 4\.0 \(previous 10\)/)).toBeVisible();
  await expect(report.getByText(/First-try wins: 0%/)).toBeVisible();
  const raceTable = report.getByRole('table', { name: 'Solved tests' });
  await expect(raceTable.getByRole('columnheader', { name: 'Solved', exact: true })).toBeVisible();
  await expect(raceTable.getByRole('columnheader', { name: 'Minutes', exact: true })).toBeVisible();
  await expect(raceTable.getByRole('row').nth(1)).toContainText('Race Sample 11');
  const newestRow = raceTable.getByRole('row').nth(1);
  const expectedLocalSolved = await page.evaluate(() => new Intl.DateTimeFormat(undefined,
    { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(1_700_000_011_000)));
  await expect(newestRow.getByRole('cell').nth(0)).toHaveText(expectedLocalSolved);
  await expect(newestRow.getByRole('cell').nth(1)).toHaveText('3');
  await expect(newestRow.getByRole('cell').nth(2)).toHaveText('2');
  await report.getByRole('button', { name: 'Next' }).click();
  const legacyRow = raceTable.getByRole('row').filter({ hasText: 'Race Sample 00' });
  await expect(legacyRow).toBeVisible();
  await expect(legacyRow.getByRole('cell').nth(1)).toHaveText('—');
  await expect(legacyRow.getByRole('cell').nth(2)).toHaveText('—');
  await report.getByRole('button', { name: 'Previous' }).click();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/progress-report-desktop.png` });

  await report.getByRole('button', { name: 'Race Shop' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const dinoTable = report.getByRole('table', { name: 'Solved tests' });
  await expect(dinoTable.getByRole('row').nth(1)).toContainText('Dino Sample 11');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/progress-report-dino-desktop.png` });

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(report.getByText('Dino Sample 11')).toBeInViewport();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/progress-report-tablet.png` });
  await page.keyboard.press('Escape');
  await expect(report).toHaveCount(0);
});
