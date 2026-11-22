/**
 * TEMPORARY: one-time remap of Brain Racer's own saved data from the old racer ids (the four built-in racers
 * and custom 'u1', 'u2', ...) to the shared profile ids made by shared/legacyProfiles.ts.
 * Delete this file (and its call in BootScene) in a later release, once every family device has run it.
 * Contains old ids only: names live in the shared profiles.
 */
import { legacyIdMap } from '../../shared/profiles';
import type { RacerProfile } from './types';
import { parseProgress, PROGRESS_KEY, type AllProgress } from './racerProgress';

const COMPLETED_KEY = 'brainracer.legacyRemap.v1';
const SETTINGS_KEY = 'brainracer.settings.v1';
const SECOND_PLAYER_KEY = 'brainracer.secondPlayer.v1';
const LEGACY_UNLOCKS = 'brainracer.unlocks.v1';
const LEGACY_ACCESS = 'brainracer.content.v1';

const Q = (addition: boolean, multiplication: boolean) => ({ addition, multiplication, spelling: true });
/** The old per-family default settings, kept for the migrated profiles unless they were edited in Admin Settings. */
export const LEGACY_RACER_DEFAULTS: Record<string, RacerProfile> = {
  abe: { difficulty: 'easy', questionTypes: Q(true, false), roundSec: 300 },
  gideon: { difficulty: 'normal', questionTypes: Q(true, false), roundSec: 300 },
  helen: { difficulty: 'hard', questionTypes: Q(false, true), roundSec: 180 },
  daddy: { difficulty: 'hard', questionTypes: Q(false, true), roundSec: 180 },
};

function readJson(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch { return undefined; }
}
function writeJson(key: string, value: unknown): void {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Pure: the old shared unlocks went to the first two built-in racers; the other two started fresh. */
export function legacyProgressFromSharedUnlocks(unlocksRaw: unknown, accessRaw: unknown): AllProgress {
  const a = isObj(accessRaw) ? accessRaw : {};
  const shared = parseProgress({ worlds: a.worlds, items: unlocksRaw, overrides: a.overrides });
  const copy = () => ({ worlds: [...shared.worlds], items: [...shared.items], overrides: { ...shared.overrides } });
  return { abe: copy(), gideon: copy(), helen: parseProgress({}), daddy: parseProgress({}) };
}

/** Pure: settings with old racer ids replaced; the old names and custom list are dropped (the shared store owns names). */
export function remapSettings(raw: unknown, map: Readonly<Record<string, string>>): Record<string, unknown> {
  const s: Record<string, unknown> = isObj(raw) ? { ...raw } : {};
  const saved = isObj(s.racerProfiles) ? s.racerProfiles : {};
  const racerProfiles: Record<string, unknown> = {};
  for (const [old, id] of Object.entries(map)) {
    const entry: Record<string, unknown> = { ...LEGACY_RACER_DEFAULTS[old], ...(isObj(saved[old]) ? saved[old] : {}) };
    delete entry.name;
    if (Object.keys(entry).length) racerProfiles[id] = entry;
  }
  s.racerProfiles = racerProfiles;
  delete s.customRacers;
  if (Array.isArray(s.players)) s.players = s.players.map((p) => remapPlayer(p, map));
  return s;
}

export function remapPlayer(p: unknown, map: Readonly<Record<string, string>>): unknown {
  if (!isObj(p) || typeof p.profile !== 'string') return p;
  const { profile, ...rest } = p;
  return map[profile as string] ? { ...rest, profile: map[profile as string] } : rest;
}

/** Pure: progress with its keys renamed; keys of unmapped racers are kept untouched. */
export function remapProgress(raw: unknown, map: Readonly<Record<string, string>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(isObj(raw) ? raw : {})) out[map[k] ?? k] = v;
  return out;
}

/** Runs once per device after `ensureProfiles()`; does nothing without a legacy id map. */
export function migrateLegacyRacers(): void {
  const map = legacyIdMap();
  if (!Object.keys(map).length || readJson(COMPLETED_KEY) !== undefined) return;

  writeJson(SETTINGS_KEY, remapSettings(readJson(SETTINGS_KEY), map));
  const second = readJson(SECOND_PLAYER_KEY);
  if (second !== undefined) writeJson(SECOND_PLAYER_KEY, remapPlayer(second, map));

  let progress = readJson(PROGRESS_KEY);
  if (progress === undefined) {
    const unlocks = readJson(LEGACY_UNLOCKS);
    const access = readJson(LEGACY_ACCESS);
    if (unlocks !== undefined || access !== undefined) progress = legacyProgressFromSharedUnlocks(unlocks, access);
  }
  if (progress !== undefined) writeJson(PROGRESS_KEY, remapProgress(progress, map));
  writeJson(COMPLETED_KEY, true);
}
