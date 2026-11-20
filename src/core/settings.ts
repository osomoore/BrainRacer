/** Settings persistence (localStorage, failure-tolerant). */
import { DEFAULT_SETTINGS } from '../config/gameConfig';
import { currentLaunchOverrides } from '../config/launchOptions';
import { defaultRoundLength, RACE_MAPS } from './progression';
import type { PlayerSettings, RaceMap, Settings } from './types';

const KEY = 'brainracer.settings.v1';
export { RACE_MAPS } from './progression';

export function isRaceMap(map: unknown): map is RaceMap {
  return RACE_MAPS.some(known => known === map);
}

export function loadSettings(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings> | null;
      const settings: Settings = { ...structuredClone(DEFAULT_SETTINGS), ...saved };
      if (!isRaceMap(settings.map)) settings.map = 'city';
      if (settings.developerMode === true && saved?.roundLengthSec === undefined) {
        settings.roundLengthSec = defaultRoundLength(true);
      }
      return { ...settings, ...currentLaunchOverrides() };
    }
  } catch { /* ignore */ }
  return { ...structuredClone(DEFAULT_SETTINGS), ...currentLaunchOverrides() };
}

const SECOND_PLAYER_KEY = 'brainracer.secondPlayer.v1';

export function savedSecondPlayer(): PlayerSettings | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(SECOND_PLAYER_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch { return undefined; }
}

export function saveSettings(s: Settings): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
    if (s.players[1]) globalThis.localStorage?.setItem(SECOND_PLAYER_KEY, JSON.stringify(s.players[1]));
  } catch { /* ignore */ }
}
