// Save writers use these hooks without depending on the network or scheduler.
let listener: ((id: string, deleted: boolean) => void) | undefined;

export function listenForProfileChanges(onChange?: (id: string, deleted: boolean) => void): void {
  listener = onChange;
}

export function useSyncProfileIds(): boolean { return listener !== undefined; }
export function notifyProfileChanged(id: string): void { listener?.(id, false); }
export function notifyProfileDeleted(id: string): void { listener?.(id, true); }

export function newSyncProfileId(): string {
  // Random UUIDs require a secure origin. Random bytes also work for HTTP dev previews.
  return crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)),
    byte => byte.toString(16).padStart(2, '0')).join('');
}
