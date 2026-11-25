/** Settings persistence (localStorage, failure-tolerant). */
import { DEFAULT_SETTINGS } from '../config/gameConfig';
import { currentLaunchOverrides } from '../config/launchOptions';
import { defaultRoundLength, RACE_MAPS } from './progression';
import type { PlayerSettings, RaceMap, Settings } from './types';
import { notifyProfileChanged } from '../../shared/sync/changes';

const KEY = 'brainracer.settings.v1';
const LOADOUTS_KEY = 'brainracer.loadouts.v1';
export type RacerLoadout = Pick<PlayerSettings, 'car' | 'guide' | 'devCar' | 'devGuide'>;
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
      // While Driving is retired: an old saved 'drive' loads as Stop & Answer.
      if (settings.questionStyle === 'drive') settings.questionStyle = 'pause';
      if (settings.developerMode === true && saved?.roundLengthSec === undefined) {
        settings.roundLengthSec = defaultRoundLength(true);
      }
      return { ...withProfileLoadouts(settings), ...currentLaunchOverrides() };
    }
  } catch { /* ignore */ }
  return { ...withProfileLoadouts(structuredClone(DEFAULT_SETTINGS)), ...currentLaunchOverrides() };
}

function withProfileLoadouts(settings: Settings): Settings {
  return { ...settings, players: settings.players.map(p => {
    const loadout = p.profile ? loadoutForProfile(p.profile) : undefined;
    return loadout ? { ...p, ...loadout } : p;
  }) };
}

/** Per-profile car/buddy choices, falling back to older slot-based saves before first write. */
export function loadoutForProfile(id: string): RacerLoadout | undefined {
  try {
    const keyRaw = globalThis.localStorage?.getItem(LOADOUTS_KEY);
    const keyed = keyRaw ? (JSON.parse(keyRaw) as Record<string, RacerLoadout>)[id] : undefined;
    if (keyed && typeof keyed.car === 'string') return keyed;
    const raw = globalThis.localStorage?.getItem(KEY);
    const saved = raw ? JSON.parse(raw) as Partial<Settings> : undefined;
    const slot = saved?.players?.find(p => p.profile === id);
    if (slot) return { car: slot.car, guide: slot.guide, devCar: slot.devCar, devGuide: slot.devGuide };
    const secondRaw = globalThis.localStorage?.getItem(SECOND_PLAYER_KEY);
    const second = secondRaw ? JSON.parse(secondRaw) as PlayerSettings : undefined;
    if (second?.profile === id) return { car: second.car, guide: second.guide, devCar: second.devCar, devGuide: second.devGuide };
  } catch { /* missing/corrupt local save */ }
  return undefined;
}

const SECOND_PLAYER_KEY = 'brainracer.secondPlayer.v1';

export function savedSecondPlayer(): PlayerSettings | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(SECOND_PLAYER_KEY);
    if (!raw) return undefined;
    const player = JSON.parse(raw) as PlayerSettings;
    const loadsRaw = globalThis.localStorage?.getItem(LOADOUTS_KEY);
    const loadout = player.profile && loadsRaw ? (JSON.parse(loadsRaw) as Record<string, Partial<PlayerSettings>>)[player.profile] : undefined;
    return loadout ? { ...player, ...loadout } : player;
  } catch { return undefined; }
}

export function saveSettings(s: Settings): void {
  const changed = new Set<string>();
  let previous: Partial<Settings> | null = null;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    previous = raw ? JSON.parse(raw) as Partial<Settings> : null;
  } catch { /* A normal save can restore unreadable settings. */ }
  for (const [id, profile] of Object.entries(s.racerProfiles ?? {})) {
    if (JSON.stringify(previous?.racerProfiles?.[id]) !== JSON.stringify(profile)) changed.add(id);
  }
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
    if (s.players[1]) globalThis.localStorage?.setItem(SECOND_PLAYER_KEY, JSON.stringify(s.players[1]));
  } catch { /* ignore */ }
  try {
    const raw = globalThis.localStorage?.getItem(LOADOUTS_KEY);
    const loadouts = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    for (const p of s.players ?? []) if (p.profile) {
      const { car, guide, devCar, devGuide } = p;
      const loadout = { car, guide, devCar, devGuide };
      if (JSON.stringify(loadouts[p.profile]) !== JSON.stringify(loadout)) changed.add(p.profile);
      loadouts[p.profile] = loadout;
    }
    globalThis.localStorage?.setItem(LOADOUTS_KEY, JSON.stringify(loadouts));
  } catch { /* ignore */ }
  changed.forEach(notifyProfileChanged);
}
