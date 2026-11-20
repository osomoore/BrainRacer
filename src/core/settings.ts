/** Settings persistence (localStorage, failure-tolerant). */
import { DEFAULT_SETTINGS } from '../config/gameConfig';
import { currentLaunchOptions } from '../config/launchOptions';
import type { RaceMap, Settings } from './types';

const KEY = 'brainracer.settings.v1';
export const RACE_MAPS: readonly RaceMap[] = ['city', 'industrial', 'farm', 'harbor', 'underground'];

export function isRaceMap(map: unknown): map is RaceMap {
  return RACE_MAPS.some(known => known === map);
}

export function loadSettings(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) {
      const settings: Settings = { ...structuredClone(DEFAULT_SETTINGS), ...JSON.parse(raw) };
      if (!isRaceMap(settings.map)) settings.map = 'city';
      return { ...settings, ...currentLaunchOptions() };
    }
  } catch { /* ignore */ }
  return { ...structuredClone(DEFAULT_SETTINGS), ...currentLaunchOptions() };
}

export function saveSettings(s: Settings): void {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
