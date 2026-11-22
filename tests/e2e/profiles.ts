import type { Page } from '@playwright/test';

export interface SeedOptions {
  names?: string[];
  /** Brain Racer per-profile settings by profile id (p1, p2, ...). */
  settings?: Record<string, { difficulty: string; questionTypes: Record<string, boolean>; roundSec: number }>;
}

/**
 * Starts the page with shared profiles p1.. (default Robin, Sam, Kim, Lee) instead of a fresh device.
 * Writes `hub.profiles` only once, so the one-time legacy migration never runs in tests.
 */
export function seedProfiles(page: Page, options: SeedOptions = {}): Promise<unknown> {
  const names = options.names ?? ['Robin', 'Sam', 'Kim', 'Lee'];
  return page.addInitScript(({ names, settings }) => {
    if (localStorage.getItem('hub.profiles') !== null) return;
    localStorage.setItem('hub.profiles', JSON.stringify(names.map((name, i) => ({ id: `p${i + 1}`, name, createdAt: i + 1 }))));
    localStorage.setItem('hub.profileSeq', String(names.length));
    if (settings) localStorage.setItem('brainracer.settings.v1', JSON.stringify({ racerProfiles: settings }));
  }, { names, settings: options.settings });
}
