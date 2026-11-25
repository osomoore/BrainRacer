import { expect, test, type Page } from '@playwright/test';
import { installGamepadMock, setPad, tapPad } from './gamepadMock';
import { seedProfiles } from './profiles';

const state = (page: Page) => page.evaluate(() => (window as any).__ws.state());
const key = async (page: Page, code: string) => { await page.keyboard.press(code); await page.waitForTimeout(100); };
const screens = (page: Page, expected: string) => expect.poll(async () => (await state(page)).screens.join(','), { timeout: 10_000 }).toBe(expected);

async function join(page: Page): Promise<void> {
  await page.goto('/workshop.html?mobile=0');
  await page.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });
  await key(page, 'Space');
  await key(page, 'Space');
  await screens(page, 'profile');
}

async function openProfilesPanel(page: Page): Promise<void> {
  await page.keyboard.press('F9');
  await expect.poll(async () => (await state(page)).adminOpen).toBe(true);
  await page.evaluate(() => {
    const admin = (window as any).__ws.game.scene.getScene('admin');
    admin.rows.find((row: any) => row.label === 'Profiles').run();
  });
  await expect(page.getByRole('button', { name: 'Delete Robin' })).toBeVisible();
}

async function deleteRobin(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Delete Robin' }).click();
  await page.getByRole('button', { name: 'Continue to delete' }).click();
  await page.getByRole('button', { name: 'Yes, delete profile' }).click();
  await expect(page.getByText('Profile deleted.')).toBeVisible();
}

test('deleting the active profile destroys its pane screen before changing pane identity', async ({ page }) => {
  await seedProfiles(page, { names: ['Robin'] });
  await join(page);
  await key(page, 'Space');
  await screens(page, 'reading');
  await page.evaluate(() => {
    const pane = (window as any).__ws.panes[0];
    const current = pane.screen;
    const destroy = current.destroy.bind(current);
    current.destroy = () => {
      pane.__destroyedIdentity = { profileId: pane.profileId ?? null, workshopId: pane.workshopId ?? null };
      destroy();
    };
  });
  await openProfilesPanel(page);
  await deleteRobin(page);
  await expect.poll(() => page.evaluate(() => (window as any).__ws.panes[0].__destroyedIdentity)).toEqual({ profileId: 'p1', workshopId: null });
  await page.getByRole('button', { name: 'Close profiles' }).click();
  await key(page, 'F9');
  await screens(page, 'profile');
  expect(await page.evaluate(() => (window as any).__ws.panes[0].profileId)).toBeUndefined();
});

test('admin profile rows refresh after the profile manager closes', async ({ page }) => {
  await seedProfiles(page, { names: ['Robin'] });
  await join(page);
  await openProfilesPanel(page);
  await deleteRobin(page);
  await page.getByRole('button', { name: 'Close profiles' }).click();
  await expect.poll(() => page.evaluate(() => {
    const admin = (window as any).__ws.game.scene.getScene('admin');
    return admin.rows.some((row: any) => row.label === 'Robin');
  })).toBe(false);
  expect((await state(page)).adminOpen).toBe(true);
});

test('B closes the profiles panel without also closing its parent admin menu', async ({ page }) => {
  await installGamepadMock(page, 1);
  await seedProfiles(page, { names: ['Robin'] });
  await page.goto('/workshop.html?mobile=0');
  await page.waitForFunction(() => (window as any).__ws?.state().scene === 'title', null, { timeout: 30_000 });
  await tapPad(page, 0, 0);
  await tapPad(page, 0, 0);
  await screens(page, 'profile');
  await page.keyboard.press('F9');
  await expect.poll(async () => (await state(page)).adminOpen).toBe(true);
  await page.evaluate(() => {
    const admin = (window as any).__ws.game.scene.getScene('admin');
    admin.rows.find((row: any) => row.label === 'Profiles').run();
  });
  await expect(page.getByRole('button', { name: 'Delete Robin' })).toBeVisible();
  await setPad(page, 0, { buttons: { 1: 1 } });
  await page.waitForTimeout(350);
  await setPad(page, 0, { buttons: { 1: 0 } });
  await page.waitForTimeout(100);
  await expect(page.getByRole('button', { name: 'Delete Robin' })).toHaveCount(0);
  await expect.poll(async () => (await state(page)).adminOpen).toBe(true);
  await tapPad(page, 0, 1);
  await expect.poll(async () => (await state(page)).adminOpen).toBe(false);
});
