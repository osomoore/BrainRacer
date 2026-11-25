// Save writers use these hooks without depending on the network or scheduler.
let listener: ((id: string, deleted: boolean, mergedInto?: string) => void) | undefined;
let syncedEditTime: ((id: string) => number | undefined) | undefined;
const replacements = new Set<(sourceId: string, targetId?: string) => void>();
export const PROFILE_EDIT_TIMES_KEY = 'hub.profileEditTimes.v1';

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
  replacements.add(listener);
  return () => replacements.delete(listener);
}

export function publishProfileReplacement(sourceId: string, targetId?: string): void {
  replacements.forEach(listener => listener(sourceId, targetId));
}

export function newSyncProfileId(): string {
  // Random UUIDs require a secure origin. Random bytes also work for HTTP dev previews.
  return crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)),
    byte => byte.toString(16).padStart(2, '0')).join('');
}
