/** Settings persistence (localStorage, failure-tolerant). */
import { DEFAULT_SETTINGS } from '../config/gameConfig';
import type { Settings } from './types';

const KEY = 'brainracer.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return { ...structuredClone(DEFAULT_SETTINGS), ...JSON.parse(raw) } as Settings;
  } catch { /* ignore */ }
  return structuredClone(DEFAULT_SETTINGS);
}

export function saveSettings(s: Settings): void {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
