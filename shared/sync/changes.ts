// Save writers use these hooks without depending on the network or scheduler.
import { readShared, SHARED_PREFIX, writeShared } from '../storage';

let listener: ((id: string, deleted: boolean, mergedInto?: string, identityOnly?: boolean) => void) | undefined;
let syncedEditTime: ((id: string) => number | undefined) | undefined;
const replacements = new Set<(sourceId: string, targetId?: string) => void>();
const identityListeners = new Set<(id: string) => void>();
export const PROFILE_EDIT_TIMES_KEY = 'hub.profileEditTimes.v1';
export const PROFILE_REPLACEMENTS = 'profileReplacements.v1';
export const PROFILE_IDENTITY_TIMES = 'profileIdentityTimes.v1';

export function listenForProfileChanges(onChange?: typeof listener, editTime?: typeof syncedEditTime): void {
  listener = onChange;
  syncedEditTime = editTime;
}

export function useSyncProfileIds(): boolean { return listener !== undefined; }
export function notifyProfileChanged(id: string): void {
  rememberProfileEditTime(id, Date.now());
  listener?.(id, false);
}
export function notifyProfileDeleted(id: string, mergedInto?: string): void { listener?.(id, true, mergedInto); }

export function notifyProfileRenamed(id: string): void {
  listener?.(id, false, undefined, true);
  publishProfileIdentity(id);
}

type IdentityEdit = { name: string; createdAt: number; updatedAt: number };

export function profileIdentityTime(id: string, profile: Pick<IdentityEdit, 'name' | 'createdAt'>): number | undefined {
  const edits = readShared<Record<string, IdentityEdit>>(PROFILE_IDENTITY_TIMES, {});
  const edit = edits?.[id];
  return edit?.name === profile.name && edit.createdAt === profile.createdAt
    && Number.isSafeInteger(edit.updatedAt) && edit.updatedAt >= profile.createdAt ? edit.updatedAt : undefined;
}

export function rememberProfileIdentityTime(id: string, profile: Pick<IdentityEdit, 'name' | 'createdAt'>, updatedAt: number): void {
  if (profileIdentityTime(id, profile) === updatedAt) return;
  const edits = readShared<Record<string, IdentityEdit>>(PROFILE_IDENTITY_TIMES, {});
  writeShared(PROFILE_IDENTITY_TIMES, { ...edits, [id]: { name: profile.name, createdAt: profile.createdAt, updatedAt } });
}

export function rememberProfileEditTime(id: string, updatedAt: number): void {
  try {
    const times = readEditTimes();
    times[id] = updatedAt;
    globalThis.localStorage?.setItem(PROFILE_EDIT_TIMES_KEY, JSON.stringify(times));
  } catch { /* A save remains usable without edit metadata. */ }
}

function readEditTimes(): Record<string, number> {
  const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(PROFILE_EDIT_TIMES_KEY) ?? '{}');
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, number> : {};
}

export function profileEditTime(id: string, createdAt: number): number {
  const synced = syncedEditTime?.(id);
  if (synced !== undefined) return synced;
  try {
    const edited = readEditTimes()[id];
    if (Number.isSafeInteger(edited) && edited >= createdAt) return edited;
  } catch { /* Older saves may only have a creation date. */ }
  return createdAt;
}

export function subscribeProfileReplacements(listener: (sourceId: string, targetId?: string) => void): () => void {
  return subscribe(replacements, listener);
}

export function publishProfileReplacement(sourceId: string, targetId?: string): void {
  replacements.forEach(listener => listener(sourceId, targetId));
  publishProfileIdentity(sourceId);
  if (targetId) publishProfileIdentity(targetId);
}

export function subscribeProfileIdentities(listener: (id: string) => void): () => void {
  return subscribe(identityListeners, listener);
}

function publishProfileIdentity(id: string): void {
  identityListeners.forEach(listener => listener(id));
}

function subscribe<T>(listeners: Set<T>, listener: T): () => void {
  if (!identityListeners.size && !replacements.size) globalThis.addEventListener?.('storage', onProfileStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!identityListeners.size && !replacements.size) globalThis.removeEventListener?.('storage', onProfileStorage);
  };
}

function profilesFromStorage(raw: string | null): Map<string, string> {
  try {
    const list: unknown = JSON.parse(raw ?? '[]');
    if (Array.isArray(list)) return new Map(list.filter(p => typeof p?.id === 'string' && typeof p.name === 'string')
      .map(p => [p.id, JSON.stringify([p.name, p.createdAt])]));
  } catch { /* Ignore unreadable profile lists. */ }
  return new Map();
}

function onProfileStorage(event: StorageEvent): void {
  if (event.key !== `${SHARED_PREFIX}profiles` || (event.storageArea && event.storageArea !== globalThis.localStorage)) return;
  const before = profilesFromStorage(event.oldValue);
  const after = profilesFromStorage(event.newValue);
  const retired = readShared<Record<string, string | null>>(PROFILE_REPLACEMENTS, {});
  for (const id of before.keys()) {
    if (!after.has(id)) publishProfileReplacement(id, retired?.[id] ?? undefined);
  }
  for (const [id, identity] of after) {
    if (before.get(id) !== identity) publishProfileIdentity(id);
  }
}

export function newSyncProfileId(): string {
  // Random UUIDs require a secure origin. Random bytes also work for HTTP dev previews.
  return crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)),
    byte => byte.toString(16).padStart(2, '0')).join('');
}
