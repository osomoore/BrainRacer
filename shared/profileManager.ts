/** The shared grown-up profile operations. All reads and writes here are Phaser-free. */
import { engine } from '../apps/workshop/logic';
import { JBQ_PROGRESS_KEY } from '../src/challenge/jbqProgress';
import { migrateLegacyRacers } from '../src/core/legacyRacers';
import { racerLoadouts, racerMaps, racerProgressOf, PROGRESS_KEY } from '../src/core/racerProgress';
import { listProfiles, PROFILE_REPLACEMENTS, validProfileName, type PlayerProfile } from './profiles';
import { SHARED_PREFIX } from './storage';
import { notifyProfileChanged, notifyProfileDeleted, notifyProfileRenamed, profileEditTime, profileIdentityTime,
  PROFILE_IDENTITY_TIMES, publishProfileReplacement, useSyncProfileIds } from './sync/changes';
import { MAX_PROFILE_DATA_BYTES, object, profileId, type JsonObject } from './sync/protocol';
import { mergeProfile, readRevision, type ProfileRecord } from './sync/record';
import {
  LOADOUTS_KEY, SECOND_PLAYER_KEY, SETTINGS_KEY, WORKSHOP_PLAYERS_KEY,
  parseRacerSnapshot, profileSnapshot, type ProfileSnapshot,
} from './sync/storage';

const PROFILES_KEY = `${SHARED_PREFIX}profiles`;
const SEQUENCE_KEY = `${SHARED_PREFIX}profileSeq`;
const LEGACY_IDS_KEY = `${SHARED_PREFIX}legacyIds`;
const REPLACEMENTS_KEY = `${SHARED_PREFIX}${PROFILE_REPLACEMENTS}`;
const IDENTITY_TIMES_KEY = `${SHARED_PREFIX}${PROFILE_IDENTITY_TIMES}`;
const STORAGE_ERROR = 'Could not update the profiles. Check this device’s storage and try again.';
const UNREADABLE_SAVE = 'A profile save could not be read. Both profiles are still available.';

export function listManagedProfiles() {
  migrateLegacyRacers();
  const parsed = new Map<string, unknown>();
  const read = (key: string) => {
    if (!parsed.has(key)) {
      try { parsed.set(key, JSON.parse(globalThis.localStorage?.getItem(key) ?? 'null')); }
      catch { parsed.set(key, undefined); }
    }
    return parsed.get(key);
  };
  return listProfiles().map(profile => {
    const snapshot = profileSnapshot(profile, read);
    const rooms = Object.values(snapshot.workshop?.workshops ?? {});
    const progress = snapshot.racer.progress ?? racerProgressOf({}, undefined);
    return {
      ...profile,
      workshopParts: rooms.reduce((total, room) => total + (Array.isArray(room?.bought) ? room.bought.length : 0), 0),
      workshopChallenges: rooms.reduce((total, room) => total + Object.keys(room?.completed ?? {}).length, 0),
      racerWorlds: racerMaps(progress, false).length,
      racerCars: racerLoadouts(progress, false).cars.length,
    };
  });
}

/** Uses the family-sync rules for progress and retains the identity the grown-up chose to keep. */
export function combineProfileRecords(source: ProfileRecord, target: ProfileRecord): ProfileRecord {
  const merged = mergeProfile({ deleted: false, data: source }, { deleted: false, data: target });
  if (merged.deleted) throw new Error(UNREADABLE_SAVE);
  return { ...merged.data, profile: target.profile, identityUpdatedAt: target.identityUpdatedAt };
}

/** Keeps slot positions and controllers, changing only the profile and its personal loadout. */
export function replaceProfileSlot(slot: unknown, sourceId: string, targetId?: string,
  loadout?: ProfileSnapshot['racer']['loadout']): unknown {
  if (!object(slot) || slot.profile !== sourceId) return slot;
  if (!targetId) {
    const { profile: _profile, ...rest } = slot;
    return rest;
  }
  if (!loadout) return { ...slot, profile: targetId };
  const { car, guide, devCar, devGuide } = loadout;
  return { ...slot, car, guide, devCar, devGuide, profile: targetId };
}

export function replaceLegacyProfileIds(ids: JsonObject, sourceId: string, targetId?: string): JsonObject {
  return Object.fromEntries(Object.entries(ids).flatMap(([oldId, id]) =>
    id === sourceId ? (targetId ? [[oldId, targetId]] : []) : [[oldId, id]]));
}

function editStorage(edit: (read: (key: string) => unknown, write: (key: string, data: unknown) => void) => void): void {
  const originals = new Map<string, string | null>();
  const parsed = new Map<string, unknown>();
  const changes = new Map<string, string>();
  const applied: string[] = [];
  const readRaw = (key: string) => {
    if (!originals.has(key)) originals.set(key, localStorage.getItem(key));
    return originals.get(key) ?? null;
  };
  const read = (key: string): unknown => {
    if (parsed.has(key)) return parsed.get(key);
    const raw = readRaw(key);
    try { parsed.set(key, raw === null ? undefined : JSON.parse(raw)); }
    catch { throw new Error(UNREADABLE_SAVE); }
    return parsed.get(key);
  };
  try {
    edit(read, (key, data) => {
      const raw = JSON.stringify(data);
      if (raw !== readRaw(key)) {
        changes.set(key, raw);
        parsed.set(key, data);
      }
    });
    for (const [key, original] of originals) {
      if (localStorage.getItem(key) !== original) throw new Error('The profiles changed on this device. Try again.');
    }
    for (const [key, raw] of changes) {
      localStorage.setItem(key, raw);
      applied.push(key);
      if (localStorage.getItem(key) !== raw) throw new Error(STORAGE_ERROR);
    }
  } catch (error) {
    for (const key of applied.reverse()) {
      const original = originals.get(key);
      try {
        if (original == null) localStorage.removeItem(key);
        else localStorage.setItem(key, original);
        if (localStorage.getItem(key) !== (original ?? null)) throw new Error(STORAGE_ERROR);
      } catch {
        // If the identity is already retired and can't be restored, keep its combined saves.
        if (key === PROFILES_KEY) break;
      }
    }
    if (!applied.length && error instanceof Error && !(error instanceof DOMException)) throw error;
    throw new Error(STORAGE_ERROR, { cause: error });
  }
}

type Read = (key: string) => unknown;
type Write = (key: string, data: unknown) => void;

function readMap(value: unknown): JsonObject {
  if (value === undefined) return {};
  if (object(value)) return value;
  throw new Error(UNREADABLE_SAVE);
}

function profileList(read: Read): PlayerProfile[] {
  const raw = read(PROFILES_KEY);
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || !raw.every(p => object(p) && typeof p.id === 'string' && typeof p.name === 'string')) {
    throw new Error(UNREADABLE_SAVE);
  }
  return raw.map(p => ({ ...p, createdAt: Number(p.createdAt) || 0 }));
}

function readProfileRecord(profile: PlayerProfile, read: Read): ProfileRecord {
  const { id, createdAt } = profile;
  const snapshot = profileSnapshot(profile, read);
  const progress = readMap(read(PROGRESS_KEY))[id];
  const jbq = readMap(read(JBQ_PROGRESS_KEY))[id];
  const settings = readMap(read(SETTINGS_KEY));
  const prefs = readMap(settings.racerProfiles)[id];
  const loadout = readMap(read(LOADOUTS_KEY))[id];
  if ((progress !== undefined && !parseRacerSnapshot({ progress }))
    || (jbq !== undefined && !parseRacerSnapshot({ jbq }))
    || (prefs !== undefined && !snapshot.racer.settings)
    || (loadout !== undefined && !snapshot.racer.loadout)) throw new Error(UNREADABLE_SAVE);
  const data: ProfileRecord = { ...snapshot, schema: 1, updatedAt: profileEditTime(id, createdAt),
    identityUpdatedAt: profileIdentityTime(id, profile) ?? createdAt };
  const valid = () => readRevision({ id, rev: 1, updatedAt: data.updatedAt, data });
  if (!valid()) {
    // Legacy Workshop saves can be repaired through the same reader the game uses.
    const repaired = engine.normalizeSave(data.workshop);
    if (!repaired) throw new Error(UNREADABLE_SAVE);
    data.workshop = repaired;
    if (!valid()) throw new Error(UNREADABLE_SAVE);
  }
  return data;
}

function replaceSettings(read: Read, write: Write, sourceId: string, targetId?: string,
  racer?: ProfileSnapshot['racer']): void {
  const replace = (slot: unknown) => {
    if (targetId && racer?.loadout && object(slot) && slot.profile === targetId) {
      return replaceProfileSlot(slot, targetId, targetId, racer.loadout);
    }
    return replaceProfileSlot(slot, sourceId, targetId, racer?.loadout);
  };
  const raw = read(SETTINGS_KEY);
  if (raw !== undefined || racer?.settings) {
    const settings = readMap(raw);
    const prefs = { ...readMap(settings.racerProfiles) };
    if (targetId && racer?.settings) prefs[targetId] = racer.settings;
    delete prefs[sourceId];
    const players = Array.isArray(settings.players)
      ? settings.players.map(replace)
      : settings.players;
    write(SETTINGS_KEY, { ...settings, players, racerProfiles: prefs });
  }
  const second = read(SECOND_PLAYER_KEY);
  const next = replace(second);
  if (next !== second) write(SECOND_PLAYER_KEY, next);
  const legacy = read(LEGACY_IDS_KEY);
  if (legacy !== undefined) write(LEGACY_IDS_KEY, replaceLegacyProfileIds(readMap(legacy), sourceId, targetId));
}

function retireProfile(read: Read, write: Write, profiles: PlayerProfile[], id: string, targetId?: string): void {
  const seq = Number(/^p(\d+)$/.exec(id)?.[1] ?? 0);
  if (seq > (Number(read(SEQUENCE_KEY)) || 0)) write(SEQUENCE_KEY, seq);
  write(REPLACEMENTS_KEY, { ...readMap(read(REPLACEMENTS_KEY)), [id]: targetId ?? null });
  write(PROFILES_KEY, profiles.filter(profile => profile.id !== id));
}

export function renameManagedProfile(id: string, name: string): void {
  const normalized = validProfileName(name);
  if (!normalized) throw new Error('Enter a name with letters and spaces.');
  let renamed = false;
  editStorage((read, write) => {
    const profiles = profileList(read);
    const current = profiles.find(profile => profile.id === id);
    if (!current) throw new Error(STORAGE_ERROR);
    if (current.name === normalized) return;
    const updatedAt = Math.max(Date.now(), (profileIdentityTime(id, current) ?? current.createdAt) + 1);
    write(IDENTITY_TIMES_KEY, { ...readMap(read(IDENTITY_TIMES_KEY)), [id]: { ...current, name: normalized, updatedAt } });
    write(PROFILES_KEY, profiles.map(profile => profile.id === id ? { ...profile, name: normalized } : profile));
    renamed = true;
  });
  if (renamed) notifyProfileRenamed(id);
}

/** Retires a shared identity, keeping the underlying game saves for recovery as sync tombstones do. */
export function retireLocalProfile(sourceId: string, targetId?: string): boolean {
  let removed = false;
  let racer: ProfileSnapshot['racer'] | undefined;
  editStorage((read, write) => {
    const profiles = profileList(read);
    removed = profiles.some(profile => profile.id === sourceId);
    if (!removed && !targetId) return;
    const target = profiles.find(profile => profile.id === targetId);
    racer = target ? profileSnapshot(target, read).racer : undefined;
    retireProfile(read, write, profiles, sourceId, targetId);
  });
  if (removed || targetId) {
    try { editStorage((read, write) => replaceSettings(read, write, sourceId, targetId, racer)); }
    catch { /* The remaining settings can still be resolved through the committed retirement. */ }
  }
  return removed;
}

export function deleteManagedProfile(id: string): void {
  if (!retireLocalProfile(id)) return;
  notifyProfileDeleted(id);
  publishProfileReplacement(id);
}

export function mergeManagedProfiles(sourceId: string, targetId: string): void {
  if (!profileId(sourceId) || !profileId(targetId) || sourceId === targetId) throw new Error('Choose two different profiles.');
  migrateLegacyRacers();
  let combined: ProfileRecord | undefined;
  const saveEntries = ({ racer, workshop }: ProfileRecord) => [
    [PROGRESS_KEY, racer.progress], [JBQ_PROGRESS_KEY, racer.jbq],
    [LOADOUTS_KEY, racer.loadout], [WORKSHOP_PLAYERS_KEY, workshop ?? undefined],
  ] as const;
  editStorage((read, write) => {
    const profiles = profileList(read);
    const target = profiles.find(profile => profile.id === targetId);
    if (!target) throw new Error(STORAGE_ERROR);
    const source = profiles.find(profile => profile.id === sourceId);
    if (!source) return;
    combined = combineProfileRecords(readProfileRecord(source, read), readProfileRecord(target, read));
    const outgoing = { ...combined, updatedAt: Math.max(combined.updatedAt + 1, Date.now()) };
    if (useSyncProfileIds() && new TextEncoder().encode(JSON.stringify(outgoing)).length > MAX_PROFILE_DATA_BYTES) {
      throw new Error('The combined profile is too large for Family sync.');
    }
    // The source still owns all of its saves until the combined entries and identity are durable.
    for (const [key, save] of saveEntries(combined)) {
      const map = readMap(read(key));
      if (save !== undefined) write(key, { ...map, [targetId]: save });
    }
    if (combined.racer.settings) {
      const settings = readMap(read(SETTINGS_KEY));
      const prefs = readMap(settings.racerProfiles);
      write(SETTINGS_KEY, { ...settings, racerProfiles: { ...prefs, [targetId]: combined.racer.settings } });
    }
    retireProfile(read, write, profiles, sourceId, targetId);
  });
  const committed = combined;
  if (!committed) return;
  try {
    editStorage((read, write) => {
      replaceSettings(read, write, sourceId, targetId, committed.racer);
      for (const [key] of saveEntries(committed)) {
        const map = readMap(read(key));
        if (!Object.hasOwn(map, sourceId)) continue;
        const next = { ...map };
        delete next[sourceId];
        write(key, next);
      }
    });
  } catch { /* The combined profile is already visible; leftover source entries are recoverable. */ }
  notifyProfileChanged(targetId);
  notifyProfileDeleted(sourceId, targetId);
  publishProfileReplacement(sourceId, targetId);
}
