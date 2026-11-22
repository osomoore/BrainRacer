/**
 * TEMPORARY one-time migration of the old Brain Racer racers into shared profiles.
 * Delete this file (and its call in shared/profiles.ts, src/core/legacyRacers.ts) in a later release,
 * once every family device has run it.
 *
 * It is the only place in the repo that may contain the family names. A device that already has
 * Brain Racer data gets the four built-in racers plus any custom racers (u1, u2, ...) as shared
 * profiles, keeping saved renames. A device without Brain Racer data gets nothing.
 */
import type { PlayerProfile } from './profiles';

/** Brain Racer's localStorage keys; any of them means "this device already has Brain Racer data". */
export const LEGACY_BRAINRACER_KEYS = [
  'brainracer.settings.v1', 'brainracer.racers.v1', 'brainracer.secondPlayer.v1',
  'brainracer.unlocks.v1', 'brainracer.content.v1', 'brainracer.tuning.v1',
] as const;
const SETTINGS_KEY = 'brainracer.settings.v1';

export const LEGACY_FAMILY: readonly (readonly [id: string, name: string])[] = [
  ['abe', 'Abe'], ['gideon', 'Gideon'], ['helen', 'Helen'], ['daddy', 'Daddy'],
];

function readRaw(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

export function hasLegacyBrainRacerData(): boolean {
  return LEGACY_BRAINRACER_KEYS.some((k) => readRaw(k) !== null);
}

/**
 * Creates the family profiles then the custom racers (in their saved order) with `create`, and returns
 * old racer id to new profile id. Empty (and nothing created) when there is no Brain Racer data.
 */
export function runLegacyMigration(create: (name: string) => PlayerProfile | null): Record<string, string> {
  if (!hasLegacyBrainRacerData()) return {};
  let saved: { racerProfiles?: Record<string, { name?: unknown }>; customRacers?: unknown } = {};
  try {
    const parsed: unknown = JSON.parse(readRaw(SETTINGS_KEY) ?? 'null');
    if (parsed && typeof parsed === 'object') saved = parsed as typeof saved;
  } catch { /* unreadable settings: defaults */ }
  const profiles = saved.racerProfiles && typeof saved.racerProfiles === 'object' ? saved.racerProfiles : {};
  const savedName = (id: string): string | undefined => {
    const n = profiles[id]?.name;
    return typeof n === 'string' ? n : undefined;
  };

  const map: Record<string, string> = {};
  for (const [id, defaultName] of LEGACY_FAMILY) {
    const p = create(savedName(id) ?? '') ?? create(defaultName);
    if (p) map[id] = p.id;
  }
  const custom = Array.isArray(saved.customRacers) ? saved.customRacers : [];
  for (const id of custom) {
    if (typeof id !== 'string' || !/^u\d+$/.test(id) || id in map) continue;
    const name = savedName(id);
    const p = name === undefined ? null : create(name); // same rule as before: a custom racer needs a valid name
    if (p) map[id] = p.id;
  }
  return map;
}
