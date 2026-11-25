/** Storage bridge between existing app saves and the family-sync profile record. */
import type { PlayerSave } from '../../apps/workshop/core/types';
import { JBQ_PROGRESS_KEY, parseJbqProgress, type JbqCounts } from '../../src/challenge/jbqProgress';
import { PROGRESS_KEY, parseProgress, type RacerProgress } from '../../src/core/racerProgress';
import { racerSettingsOf } from '../../src/core/racerProfiles';
import type { CarKind, GuideKind, RacerProfile } from '../../src/core/types';
import { listProfiles, PROFILE_REPLACEMENTS, type PlayerProfile } from '../profiles';
import { PROFILE_EDIT_TIMES_KEY, profileIdentityTime, rememberProfileIdentityTime } from './changes';
import { readShared, writeShared } from '../storage';
import { migrateLegacyRacers } from '../../src/core/legacyRacers';
import { COLLECTIBLES, UNLOCK_GUIDE_IDS, UNLOCK_VEHICLE_IDS } from '../../src/config/collectibles';
import { RACE_MAPS } from '../../src/core/progression';

export interface RacerSnapshot {
  progress?: RacerProgress;
  jbq?: JbqCounts;
  settings?: RacerProfile;
  loadout?: { car: CarKind; guide?: GuideKind; devCar?: CarKind; devGuide?: GuideKind };
}

export interface ProfileSnapshot {
  profile: PlayerProfile;
  racer: RacerSnapshot;
  workshop: PlayerSave | null;
}

export const WORKSHOP_PLAYERS_KEY = 'workshop.players.v1';
export const SETTINGS_KEY = 'brainracer.settings.v1';
export const LOADOUTS_KEY = 'brainracer.loadouts.v1';
export const SECOND_PLAYER_KEY = 'brainracer.secondPlayer.v1';

function localStorageSafe(): Storage | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}
function readJson(key: string): unknown {
  try { const raw = localStorageSafe()?.getItem(key); return raw ? JSON.parse(raw) : undefined; } catch { return undefined; }
}
function writeJson(key: string, value: unknown): void {
  try { localStorageSafe()?.setItem(key, JSON.stringify(value)); } catch { /* storage adapter stays failure tolerant */ }
}
function writeJsonVerified(key: string, value: unknown): boolean {
  try {
    const storage = localStorageSafe();
    if (!storage) return false;
    const raw = JSON.stringify(value);
    storage.setItem(key, raw);
    return storage.getItem(key) === raw;
  } catch { return false; }
}
function record(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : undefined;
}

/** Validates just the per-profile pieces used for sync; unknown or malformed fields are omitted. */
export function parseRacerSnapshot(raw: unknown): RacerSnapshot | undefined {
  const r = record(raw);
  if (!r) return undefined;
  const allowed = new Set(['progress', 'jbq', 'settings', 'loadout']);
  if (Object.keys(r).some(k => !allowed.has(k))) return undefined;
  const out: RacerSnapshot = {};
  if ('progress' in r) {
    const v = record(r.progress);
    const overrides = v && record(v.overrides);
    if (!v || !Array.isArray(v.worlds) || !Array.isArray(v.items) || !overrides) return undefined;
    const knownContent = new Set<string>([...RACE_MAPS, ...COLLECTIBLES]);
    if (Object.keys(v).some(k => !['worlds', 'items', 'overrides'].includes(k))
      || v.worlds.some(x => typeof x !== 'string' || !RACE_MAPS.includes(x as typeof RACE_MAPS[number]))
      || v.items.some(x => typeof x !== 'string' || !COLLECTIBLES.includes(x as typeof COLLECTIBLES[number]))
      || Object.keys(overrides).some(k => !knownContent.has(k))
      || Object.values(overrides).some(x => typeof x !== 'boolean')) return undefined;
    out.progress = parseProgress(v);
  }
  if ('jbq' in r && !record(r.jbq)) return undefined;
  const jbq = record(r.jbq);
  if (jbq) {
    if (Object.values(jbq).some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0)) return undefined;
    out.jbq = parseJbqProgress({ profile: jbq }).profile ?? {};
  }
  if ('settings' in r && !record(r.settings)) return undefined;
  const settings = record(r.settings);
  if (settings) {
    const questionTypes = record(settings.questionTypes);
    const jbqSettings = record(settings.jbq);
    if (Object.keys(settings).some(k => !['difficulty', 'questionTypes', 'roundSec', 'jbq'].includes(k))) return undefined;
    if (typeof settings.difficulty !== 'string' || typeof settings.roundSec !== 'number'
      || !questionTypes || !jbqSettings) return undefined;
    if (Object.keys(questionTypes).length !== 3
      || ['math', 'reading', 'jbq'].some(k => typeof questionTypes[k] !== 'boolean')
      || Object.keys(jbqSettings).some(k => !['points', 'scope'].includes(k))
      || ![10, 20, 30, 'basics'].includes(jbqSettings.points as never)
      || !['week', 'month', 'all'].includes(jbqSettings.scope as string)
      || !['easy', 'easyPlus', 'normal', 'hard'].includes(settings.difficulty as string)
      || !Number.isFinite(settings.roundSec)) return undefined;
    out.settings = settings as unknown as RacerProfile;
  }
  if ('loadout' in r) {
    const loadout = record(r.loadout);
    if (!loadout || Object.keys(loadout).some(k => !['car', 'guide', 'devCar', 'devGuide'].includes(k))
      || typeof loadout.car !== 'string'
      || ['guide', 'devCar', 'devGuide'].some(k => loadout[k] !== undefined && typeof loadout[k] !== 'string')) return undefined;
    const cars = new Set(['dino', 'kart', ...UNLOCK_VEHICLE_IDS]);
    const guides = new Set(['dino', 'star', ...UNLOCK_GUIDE_IDS]);
    if (!cars.has(loadout.car)
      || (loadout.guide !== undefined && !guides.has(loadout.guide as string))
      || (loadout.devCar !== undefined && !cars.has(loadout.devCar as string))
      || (loadout.devGuide !== undefined && !guides.has(loadout.devGuide as string))) return undefined;
    out.loadout = loadout as unknown as RacerSnapshot['loadout'];
  }
  return out;
}

export function listLocalProfileIds(): string[] { return listProfiles().map(p => p.id); }

/** Reads only this profile's data. Workshop save is returned as stored, without normalization. */
export function readLocalProfile(id: string): ProfileSnapshot | undefined {
  migrateLegacyRacers();
  const profile = listProfiles().find(p => p.id === id);
  if (!profile) return undefined;
  return profileSnapshot(profile, readJson);
}

export function profileSnapshot(profile: PlayerProfile, read: (key: string) => unknown): ProfileSnapshot {
  const { id } = profile;
  const allProgress = record(read(PROGRESS_KEY));
  const allJbq = record(read(JBQ_PROGRESS_KEY));
  const settings = record(read(SETTINGS_KEY));
  const racer: RacerSnapshot = {};
  if (allProgress && id in allProgress) racer.progress = parseProgress(allProgress[id]);
  if (allJbq && id in allJbq) racer.jbq = parseJbqProgress({ [id]: allJbq[id] })[id];
  const rp = record(settings?.racerProfiles)?.[id];
  const questions = record(record(rp)?.questionTypes);
  const legacy = questions && Object.keys(questions).length === 3
    && ['addition', 'multiplication', 'spelling'].every(key => typeof questions[key] === 'boolean');
  const parsed = parseRacerSnapshot({ settings: legacy
    ? racerSettingsOf({ racerProfiles: { [id]: rp as RacerProfile } }, id) : rp });
  if (parsed?.settings) racer.settings = parsed.settings;
  const loadouts = record(read(LOADOUTS_KEY));
  const savedLoadout = record(loadouts?.[id]);
  const slots = Array.isArray(settings?.players) ? settings!.players as unknown[] : [];
  const fromSlot = slots.map(record).find(v => v?.profile === id);
  const second = record(read(SECOND_PLAYER_KEY));
  const loadout = savedLoadout ?? (fromSlot && typeof fromSlot.car === 'string' ? fromSlot : undefined)
    ?? (second?.profile === id && typeof second.car === 'string' ? second : undefined);
  if (loadout && typeof loadout.car === 'string') {
    const parsedLoadout = parseRacerSnapshot({ loadout: {
      car: loadout.car, ...(typeof loadout.guide === 'string' ? { guide: loadout.guide } : {}),
      ...(typeof loadout.devCar === 'string' ? { devCar: loadout.devCar } : {}),
      ...(typeof loadout.devGuide === 'string' ? { devGuide: loadout.devGuide } : {}),
    } });
    if (parsedLoadout?.loadout) racer.loadout = parsedLoadout.loadout;
  }
  const saves = record(read(WORKSHOP_PLAYERS_KEY));
  return { profile, racer, workshop: (saves?.[id] as PlayerSave | undefined) ?? null };
}

/** Applies one valid snapshot, preserving all other local profiles and device-wide settings. */
export function applyLocalProfile(snapshot: ProfileSnapshot): void {
  if (!snapshot || !snapshot.profile || typeof snapshot.profile.id !== 'string' || typeof snapshot.profile.name !== 'string') return;
  const p = snapshot.profile;
  bumpProfileSequence(p.id);
  const racer = parseRacerSnapshot(snapshot.racer);
  if (racer) {
    if (racer.progress) writeJson(PROGRESS_KEY, { ...(record(readJson(PROGRESS_KEY)) ?? {}), [p.id]: racer.progress });
    if (racer.jbq) writeJson(JBQ_PROGRESS_KEY, { ...(record(readJson(JBQ_PROGRESS_KEY)) ?? {}), [p.id]: racer.jbq });
    if (racer.settings) {
      const settings = record(readJson(SETTINGS_KEY)) ?? {};
      writeJson(SETTINGS_KEY, { ...settings, racerProfiles: { ...(record(settings.racerProfiles) ?? {}), [p.id]: racer.settings } });
    }
    if (racer.loadout) writeJson(LOADOUTS_KEY, { ...(record(readJson(LOADOUTS_KEY)) ?? {}), [p.id]: racer.loadout });
  }
  if (snapshot.workshop) writeJson(WORKSHOP_PLAYERS_KEY, { ...(record(readJson(WORKSHOP_PLAYERS_KEY)) ?? {}), [p.id]: snapshot.workshop });
  const profiles = listProfiles();
  writeShared('profiles', profiles.some(x => x.id === p.id)
    ? profiles.map(x => x.id === p.id ? p : x)
    : [...profiles, p]);
}

/** Removes only the visible identity; app data remains available for later recovery. */
export function hideLocalProfile(id: string): void {
  bumpProfileSequence(id);
  const profiles = listProfiles();
  if (profiles.some(p => p.id === id)) writeShared('profiles', profiles.filter(p => p.id !== id));
}

function bumpProfileSequence(id: string): void {
  const n = Number(/^p(\d+)$/.exec(id)?.[1] ?? 0);
  if (n > (Number(readShared<number>('profileSeq', 0)) || 0)) writeShared('profileSeq', n);
}

/** Reassigns a colliding local identity. Copies are verified before the visible identity changes. */
export function rekeyLocalProfile(oldId: string, newId: string): boolean {
  const profiles = listProfiles();
  const old = profiles.find(p => p.id === oldId);
  if (!old || !newId || profiles.some(p => p.id === newId)) return false;
  const copied: string[] = [];
  const copy = (key: string): boolean => {
    const all = record(readJson(key));
    if (!all || !(oldId in all)) return true;
    if (newId in all && JSON.stringify(all[newId]) !== JSON.stringify(all[oldId])) return false;
    if (!writeJsonVerified(key, { ...all, [newId]: all[oldId] })) return false;
    const check = record(readJson(key));
    if (!check || JSON.stringify(check[newId]) !== JSON.stringify(all[oldId]) || JSON.stringify(check[oldId]) !== JSON.stringify(all[oldId])) return false;
    copied.push(key);
    return true;
  };
  for (const key of [PROGRESS_KEY, JBQ_PROGRESS_KEY, WORKSHOP_PLAYERS_KEY, LOADOUTS_KEY]) {
    if (!copy(key)) return false;
  }
  const settings = record(readJson(SETTINGS_KEY));
  let movedSettings = false;
  if (settings) {
    const rp = record(settings.racerProfiles);
    const slots = Array.isArray(settings.players)
      ? settings.players.map(x => record(x)?.profile === oldId ? { ...record(x), profile: newId } : x)
      : settings.players;
    const racerProfiles = rp && oldId in rp ? { ...rp, [newId]: rp[oldId] } : rp;
    if (racerProfiles && oldId in racerProfiles) delete racerProfiles[oldId];
    if (!writeJsonVerified(SETTINGS_KEY, { ...settings, players: slots, racerProfiles })) return false;
    movedSettings = true;
  }
  const secondKey = SECOND_PLAYER_KEY;
  const second = record(readJson(secondKey));
  const movedSecond = !!second && second.profile === oldId;
  if (movedSecond && !writeJsonVerified(secondKey, { ...second, profile: newId })) {
    if (movedSettings && settings) writeJsonVerified(SETTINGS_KEY, settings);
    return false;
  }
  const nextProfiles = profiles.map(p => p.id === oldId ? { ...p, id: newId } : p);
  const replacements = readShared<Record<string, string | null>>(PROFILE_REPLACEMENTS, {});
  const nextReplacements = Object.fromEntries(Object.entries(replacements).map(([k, v]) => [k, v === oldId ? newId : v]));
  nextReplacements[oldId] = newId;
  const replacementsKey = `hub.${PROFILE_REPLACEMENTS}`;
  if (!writeJsonVerified(replacementsKey, nextReplacements) || !writeJsonVerified('hub.profiles', nextProfiles)) {
    writeJsonVerified(replacementsKey, replacements);
    if (movedSettings && settings) writeJsonVerified(SETTINGS_KEY, settings);
    if (movedSecond && second) writeJsonVerified(secondKey, second);
    return false;
  }
  bumpProfileSequence(oldId);
  const legacy = readShared<Record<string, string>>('legacyIds', {});
  writeShared('legacyIds', Object.fromEntries(Object.entries(legacy).map(([k, v]) => [k, v === oldId ? newId : v])));
  const identityTime = profileIdentityTime(oldId, old);
  if (identityTime !== undefined) rememberProfileIdentityTime(newId, old, identityTime);
  const edits = record(readJson(PROFILE_EDIT_TIMES_KEY));
  if (edits && Object.hasOwn(edits, oldId)) {
    edits[newId] = edits[oldId];
    delete edits[oldId];
    writeJson(PROFILE_EDIT_TIMES_KEY, edits);
  }
  // Cleanup is safe only after the new identity and settings are durable. Failed cleanup leaves
  // an orphaned duplicate entry, never a missing save.
  for (const key of copied) {
    const all = record(readJson(key));
    if (all && oldId in all) { const next = { ...all }; delete next[oldId]; writeJsonVerified(key, next); }
  }
  return true;
}
