/**
 * Player profiles shared by every app (launcher, Brain Racer, Adventure Workshop).
 *
 * A profile is just an id + a name. Each app keeps its own per-profile data (settings, progress)
 * in its own storage keyed by the profile id. Stored under `hub.profiles` (see shared/storage.ts).
 * Pure: no Phaser, no DOM besides localStorage.
 */
import { readShared, writeShared } from './storage';
import { runLegacyMigration } from './legacyProfiles';
import { newSyncProfileId, notifyProfileChanged, notifyProfileDeleted, useSyncProfileIds } from './sync/changes';

export interface PlayerProfile { id: string; name: string; createdAt: number }

/** Name rules every app uses: letters (any language) and single spaces, up to `maxLen` characters. */
export const PROFILE_NAME = { maxLen: 10, chars: /^[\p{L} ]+$/u };

const PROFILES_KEY = 'profiles';
const SEQ_KEY = 'profileSeq';
const LEGACY_IDS_KEY = 'legacyIds';

/** Normalized name (trimmed, single spaces, letters/spaces only, max length) or undefined if empty/invalid. */
export function validProfileName(name: unknown): string | undefined {
  if (typeof name !== 'string') return undefined;
  const n = name.replace(/\s+/g, ' ').trim().slice(0, PROFILE_NAME.maxLen).trim();
  return n && PROFILE_NAME.chars.test(n) ? n : undefined;
}

function isProfile(v: unknown): v is PlayerProfile {
  const p = v as Partial<PlayerProfile> | null;
  return !!p && typeof p === 'object' && typeof p.id === 'string' && p.id !== '' && typeof p.name === 'string';
}

/** All profiles in creation order. */
export function listProfiles(): PlayerProfile[] {
  const raw = readShared<unknown>(PROFILES_KEY, []);
  return Array.isArray(raw) ? raw.filter(isProfile).map((p) => ({ id: p.id, name: p.name, createdAt: Number(p.createdAt) || 0 })) : [];
}

export function getProfile(id: string | undefined): PlayerProfile | undefined {
  return id === undefined ? undefined : listProfiles().find((p) => p.id === id);
}

/** Next opaque id `p<n>`; the counter never goes back, so a deleted profile's id is never reused. */
function nextId(list: readonly PlayerProfile[]): string {
  if (useSyncProfileIds()) {
    return `p-${newSyncProfileId()}`;
  }
  const used = list.map((p) => Number(/^p(\d+)$/.exec(p.id)?.[1] ?? 0));
  const n = Math.max(Number(readShared<number>(SEQ_KEY, 0)) || 0, ...used) + 1;
  writeShared(SEQ_KEY, n);
  return `p${n}`;
}

/** Creates a profile; null if the name is invalid. Names may repeat here; apps can warn if they care. */
export function createProfile(name: string): PlayerProfile | null {
  const n = validProfileName(name);
  if (!n) return null;
  const list = listProfiles();
  const profile: PlayerProfile = { id: nextId(list), name: n, createdAt: Date.now() };
  writeShared(PROFILES_KEY, [...list, profile]);
  notifyProfileChanged(profile.id);
  return profile;
}

export function renameProfile(id: string, name: string): boolean {
  const n = validProfileName(name);
  const list = listProfiles();
  if (!n || !list.some((p) => p.id === id)) return false;
  writeShared(PROFILES_KEY, list.map((p) => (p.id === id ? { ...p, name: n } : p)));
  notifyProfileChanged(id);
  return true;
}

/**
 * Deletes a profile for EVERY app. Product rule: only the grown-up admin menu may call this
 * (Brain Racer's hidden ConfigScene). Kid-facing screens (setup, launcher, other games) never offer delete.
 */
export function deleteProfile(id: string): void {
  const list = listProfiles();
  if (list.some((p) => p.id === id)) {
    writeShared(PROFILES_KEY, list.filter((p) => p.id !== id));
    notifyProfileDeleted(id);
  }
}

/** Old Brain Racer racer id to shared profile id (only on devices that migrated). */
export function legacyIdMap(): Record<string, string> {
  const raw = readShared<unknown>(LEGACY_IDS_KEY, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, string>) } : {};
}

/**
 * Call once at startup in every app. The very first call on a device (nothing written yet) runs the
 * one-time legacy migration; after that `hub.profiles` always exists, so it never runs again.
 */
export function ensureProfiles(): void {
  if (readShared<unknown>(PROFILES_KEY, null) !== null) return;
  writeShared(PROFILES_KEY, []);
  const map = runLegacyMigration(createProfile);
  if (Object.keys(map).length) writeShared(LEGACY_IDS_KEY, map);
}
