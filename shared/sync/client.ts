import { normalizeFamilyCode } from './code';
import { newSyncProfileId } from './changes';
import { FamilyApi, object, profileId, stamp, SyncError } from './protocol';
import { gameSaveHash, identityTimeOf, mergeProfile, readRevision, snapshotHash, valueHash,
  type ProfileValue, type Revision } from './record';
import type { ProfileSnapshot } from './storage';

interface ProfileSync {
  rev: number;
  dirty: boolean;
  deleted: boolean;
  updatedAt: number;
  identityUpdatedAt?: number;
  identity?: ProfileSnapshot['profile'];
  gameHash?: string;
  hash: string;
  lastPushedHash?: string;
  mergedInto?: string;
  mergePending?: boolean;
}

interface DeviceState {
  code?: string;
  since?: number;
  lastSync?: number;
  profiles: Record<string, ProfileSync>;
}
type SyncStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface LocalProfiles {
  ids(): string[];
  read(id: string): ProfileSnapshot | undefined;
  editTime?(id: string, createdAt: number): number;
  identityTime?(id: string, profile: ProfileSnapshot['profile']): number | undefined;
  rememberIdentityTime?(id: string, profile: ProfileSnapshot['profile'], updatedAt: number): void;
  apply(snapshot: ProfileSnapshot): void;
  hide(id: string, mergedInto?: string): void;
  replacementOf?(id: string): string | undefined;
  rekey(oldId: string, newId: string): boolean;
}

export interface SyncView {
  code?: string;
  lastSync?: number;
  pending: number;
  error?: string;
  status: 'off' | 'synced' | 'offline' | 'error';
  busy: boolean;
}

class ProfileError extends SyncError {}

function readDevice(rawState: string | null): DeviceState {
  try {
    const raw: unknown = JSON.parse(rawState ?? 'null');
    if (object(raw) && typeof raw.code === 'string' && normalizeFamilyCode(raw.code) === raw.code) {
      const profiles = Object.entries(object(raw.profiles) ? raw.profiles : {}).filter(([id, p]) =>
        profileId(id) && object(p) && stamp(p.rev) && stamp(p.updatedAt) && typeof p.hash === 'string'
        && typeof p.dirty === 'boolean' && typeof p.deleted === 'boolean');
      return {
        code: raw.code, since: stamp(raw.since) ? raw.since : undefined,
        lastSync: stamp(raw.lastSync) ? raw.lastSync : undefined,
        profiles: Object.fromEntries(profiles) as DeviceState['profiles'],
      };
    }
  } catch { /* Start with clean sync metadata if it is inaccessible. */ }
  return { profiles: {} };
}

export class FamilySyncClient {
  private device: DeviceState;
  private savedDevice: string | null;
  private error?: string;
  private running?: Promise<boolean>;
  private readonly listeners = new Set<() => void>();
  private readonly profileListeners = new Set<(id: string) => void>();
  private readonly sendingOnHide = new WeakSet<ProfileSync>();

  constructor(private readonly api: FamilyApi | undefined, private readonly local: LocalProfiles,
    private readonly storage: SyncStorage | undefined, private readonly key: string,
    private readonly online: () => boolean = () => true, private readonly now: () => number = Date.now,
    private readonly newId: () => string = newSyncProfileId) {
    this.savedDevice = this.readSavedDevice();
    this.device = api ? readDevice(this.savedDevice) : { profiles: {} };
  }

  get state(): SyncView {
    const { code, lastSync, profiles } = this.device;
    return {
      code, lastSync, pending: Object.values(profiles).filter(p => p.dirty).length, error: this.error,
      status: !code ? 'off' : !this.online() ? 'offline' : this.error ? 'error' : 'synced', busy: !!this.running,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeProfiles(listener: (id: string) => void): () => void {
    this.profileListeners.add(listener);
    return () => this.profileListeners.delete(listener);
  }

  refreshView(): void { this.listeners.forEach(listener => listener()); }

  editTime(id: string): number | undefined { return this.device.profiles[id]?.updatedAt; }

  private readSavedDevice(): string | null {
    try { return this.storage?.getItem(this.key) ?? null; } catch { return null; }
  }

  reloadDevice(): void {
    const raw = this.readSavedDevice();
    if (raw === this.savedDevice) return;
    this.savedDevice = raw;
    const state = readDevice(raw);
    if (this.device.code !== state.code) this.error = undefined;
    // An in-flight pull or push must exit before it can apply revisions using stale local metadata.
    this.device = state;
    this.refreshView();
  }

  private persist(): void {
    try {
      const raw = JSON.stringify(this.device);
      this.storage?.setItem(this.key, raw);
      if (this.storage) this.savedDevice = raw;
    } catch { /* Keep playing if storage is blocked. */ }
    this.refreshView();
  }

  private observe(id: string, edited: boolean, identityOnly = false): void {
    if (!profileId(id)) return;
    const snapshot = this.local.read(id);
    if (!snapshot) return; // Only an explicit delete creates a tombstone.
    const prior = this.device.profiles[id];
    const hash = snapshotHash(snapshot);
    const gameHash = gameSaveHash(snapshot);
    const { profile } = snapshot;
    const storedIdentityTime = this.local.identityTime?.(id, profile);
    if (prior?.hash === hash) {
      // Populate the independent hashes for device state written by an older build.
      prior.gameHash ??= gameHash;
      prior.identity ??= { ...profile };
      return;
    }
    const identityChanged = prior?.identity
      ? prior.identity.name !== profile.name || prior.identity.createdAt !== profile.createdAt
      : identityOnly || storedIdentityTime !== undefined;
    const gameChanged = prior?.gameHash !== undefined ? prior.gameHash !== gameHash : !identityOnly;
    const priorIdentityTime = prior?.identityUpdatedAt ?? prior?.updatedAt ?? profile.createdAt;
    this.device.profiles[id] = {
      ...prior, rev: prior?.rev ?? 0, dirty: true, deleted: false, hash, gameHash, identity: { ...profile }, mergedInto: undefined,
      updatedAt: prior
        ? (gameChanged ? Math.max(this.now(), prior.updatedAt + 1) : prior.updatedAt)
        : this.local.editTime?.(id, profile.createdAt) ?? (edited && !identityOnly ? this.now() : profile.createdAt),
      identityUpdatedAt: prior && !prior.deleted
        ? (identityChanged ? Math.max(storedIdentityTime ?? this.now(), priorIdentityTime + 1) : priorIdentityTime)
        : storedIdentityTime ?? profile.createdAt,
    };
  }

  noteChange(id: string, deleted = false, mergedInto?: string, identityOnly = false): void {
    this.reloadDevice();
    if (!this.device.code || !profileId(id)) return;
    if (deleted) this.recordDeletion(id, mergedInto);
    else this.observe(id, true, identityOnly);
    this.persist();
  }

  private recordDeletion(id: string, mergedInto?: string): void {
    const prior = this.device.profiles[id];
    const tombstone = { deleted: true as const,
      updatedAt: Math.max(this.now(), Math.max(prior?.updatedAt ?? 0, prior?.identityUpdatedAt ?? 0) + 1), mergedInto };
    this.device.profiles[id] = { ...prior, ...tombstone, rev: prior?.rev ?? 0, dirty: true, hash: valueHash(tombstone) };
    // Verify the destination with the server even if the combined save has the same content.
    if (mergedInto) {
      const target = this.device.profiles[mergedInto];
      if (target && !target.deleted) this.device.profiles[mergedInto] = { ...target, dirty: true, mergePending: true };
    }
  }

  private observeAll(): void {
    const visible = new Set(this.local.ids());
    visible.forEach(id => this.observe(id, false));
    for (const [id, meta] of Object.entries(this.device.profiles)) {
      if (meta.deleted || visible.has(id)) continue;
      // The browser may have closed after committing the local retirement but before queuing its upload.
      const target = this.local.replacementOf?.(id);
      if (target && target !== id) this.recordDeletion(id, target);
    }
    this.persist();
  }

  private value(id: string): ProfileValue | undefined {
    const meta = this.device.profiles[id];
    if (!meta) return undefined;
    if (meta.deleted) return { deleted: true, updatedAt: meta.updatedAt, mergedInto: meta.mergedInto };
    const snapshot = this.local.read(id);
    if (!snapshot) return undefined;
    const data = { ...snapshot, schema: 1 as const, updatedAt: meta.updatedAt,
      identityUpdatedAt: meta.identityUpdatedAt ?? meta.updatedAt };
    if (!readRevision({ id, rev: 1, updatedAt: meta.updatedAt, data })) {
      throw new ProfileError('A local profile could not be read for sync. Its save is still on this device.');
    }
    return { deleted: false, data };
  }

  private accept(remote: Revision): void {
    const { id, rev, value } = remote;
    this.observe(id, false); // Include edits made while fetch was in flight.
    const prior = this.device.profiles[id];
    if (prior && rev < prior.rev) return;
    let local = this.value(id);
    const pendingMergeTarget = prior?.mergePending || Object.entries(this.device.profiles).some(([source, meta]) =>
      meta.deleted && meta.dirty && this.resolveMergeTarget(source, meta.mergedInto) === id);
    if (prior?.rev === 0 && /^p\d+$/.test(id) && local && !local.deleted
      && (value.deleted ? !pendingMergeTarget : local.data.profile.createdAt !== value.data.profile.createdAt)) {
      // Sequential IDs predate sync. The two devices created different profiles with the same ID.
      const newId = this.newId();
      const rekeyed = this.local.rekey(id, newId);
      const copy = this.local.read(newId);
      if (!rekeyed || !copy || snapshotHash(copy) !== snapshotHash({ ...local.data, profile: { ...local.data.profile, id: newId } })) {
        throw new ProfileError('Could not keep both local profiles. Check device storage.');
      }
      this.observe(newId, false);
      if (pendingMergeTarget) {
        this.device.profiles[newId].mergePending = true;
        for (const [source, meta] of Object.entries(this.device.profiles)) {
          if (meta.dirty && meta.mergedInto === id) {
            const tombstone = { ...meta, deleted: true as const, mergedInto: newId };
            this.device.profiles[source] = { ...tombstone, hash: valueHash(tombstone) };
          }
        }
      }
      local = undefined;
    }
    const remoteHash = valueHash(value);
    // A source edited elsewhere since the last pull may contain progress the grown-up never
    // saw. Keep that version visible so it can be reviewed and merged in a second pass.
    const unseenRemoteSource = local?.deleted && local.mergedInto && prior?.dirty && !value.deleted
      && rev > prior.rev && remoteHash !== prior.lastPushedHash;
    let merged = unseenRemoteSource || !local ? value : mergeProfile(local, value);
    if (local && !local.deleted && value.deleted && (pendingMergeTarget || (prior?.dirty && value.mergedInto))) {
      merged = { deleted: false, data: { ...local.data, updatedAt: Math.max(local.data.updatedAt, value.updatedAt + 1) } };
    }
    const hash = valueHash(merged);
    const changed = !local || valueHash(local) !== hash;
    if (changed) {
      if (merged.deleted) {
        try { this.local.hide(id, this.resolveMergeTarget(id, merged.mergedInto)); }
        catch { throw new ProfileError('Could not update the local profile selection. Check device storage.'); }
      }
      else this.local.apply(merged.data);
    }
    const stored = this.local.read(id);
    if (merged.deleted ? !!stored : !stored || snapshotHash(stored) !== hash) {
      throw new ProfileError('Could not save the synced profile. Check device storage.');
    }
    if (!merged.deleted) this.local.rememberIdentityTime?.(id, merged.data.profile, identityTimeOf(merged.data));
    const dirty = hash !== remoteHash || (merged.deleted && value.deleted
      ? merged.updatedAt !== value.updatedAt
      : !merged.deleted && !value.deleted
        && (merged.data.updatedAt !== value.data.updatedAt || identityTimeOf(merged.data) !== identityTimeOf(value.data)));
    this.device.profiles[id] = {
      rev, hash, lastPushedHash: remoteHash, deleted: merged.deleted,
      updatedAt: merged.deleted ? merged.updatedAt : merged.data.updatedAt,
      identityUpdatedAt: merged.deleted ? undefined : identityTimeOf(merged.data),
      identity: merged.deleted ? undefined : merged.data.profile,
      gameHash: merged.deleted ? undefined : gameSaveHash(merged.data),
      mergedInto: merged.deleted ? merged.mergedInto : undefined,
      dirty, mergePending: dirty && !merged.deleted && pendingMergeTarget ? true : undefined,
    };
    this.persist();
    if (changed) this.profileListeners.forEach(listener => listener(id));
  }

  private resolveMergeTarget(id: string, target: string | undefined): string | undefined {
    const visited = new Set([id]);
    while (target && !visited.has(target)) {
      visited.add(target);
      const next = this.device.profiles[target]?.mergedInto;
      if (!next) return target;
      target = next;
    }
    return undefined;
  }

  private acceptPull(pull: { profiles: unknown[]; serverTime: number }, first?: string) {
    const blocked = new Set<string>();
    let error: SyncError | undefined;
    const rows: Revision[] = [];
    for (const raw of pull.profiles) {
      const row = readRevision(raw);
      if (row) rows.push(row);
      else {
        if (object(raw) && profileId(raw.id)) blocked.add(raw.id);
        error = new SyncError('Some server profiles were unreadable and were skipped.');
      }
    }
    // GET is a family-wide endpoint. Prioritize applying the chosen profile locally.
    const chosen = rows.findIndex(row => row.id === first);
    if (chosen > 0) rows.unshift(rows.splice(chosen, 1)[0]);
    const ordered = [...rows.filter(row => !row.value.deleted), ...rows.filter(row => row.value.deleted)];
    for (const row of ordered) {
      if (blocked.has(row.id)) continue;
      const target = row.value.deleted ? this.resolveMergeTarget(row.id, row.value.mergedInto) : undefined;
      if (target && blocked.has(target)) {
        blocked.add(row.id);
        continue;
      }
      try { this.accept(row); } catch (failure) {
        if (!(failure instanceof ProfileError)) throw failure;
        blocked.add(row.id);
        error ??= failure;
      }
    }
    // Retain the cursor so an unreadable or unwritten profile is requested again.
    if (!error) this.device.since = Math.max(this.device.since ?? 0, pull.serverTime);
    this.persist();
    return { blocked, error };
  }

  private body(id: string, value: ProfileValue): Record<string, unknown> {
    const baseRev = this.device.profiles[id].rev;
    return value.deleted
      ? { baseRev, deleted: true, data: { schema: 1, deleted: true, updatedAt: value.updatedAt, mergedInto: value.mergedInto } }
      : { baseRev, data: value.data };
  }

  private recordReceipt(id: string, sent: ProfileSync, rev: number): void {
    this.observe(id, false);
    const latest = this.device.profiles[id];
    if (rev <= latest.rev) return;
    const dirty = latest.hash !== sent.hash || latest.updatedAt !== sent.updatedAt || latest.identityUpdatedAt !== sent.identityUpdatedAt;
    this.device.profiles[id] = {
      ...latest, rev, lastPushedHash: sent.hash,
      dirty, mergePending: dirty ? latest.mergePending : undefined,
    };
    this.persist();
  }

  private async pushProfile(device: DeviceState, id: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (device !== this.device) return;
      const sent = device.profiles[id];
      if (!sent.dirty) return;
      const value = this.value(id);
      if (!value) return;
      const result = await this.api!.put(device.code!, id, this.body(id, value), false);
      this.reloadDevice();
      if (device !== this.device) return;
      if ('rev' in result) {
        this.recordReceipt(id, sent, result.rev);
        return;
      }
      const current = readRevision(result.current);
      if (!current || current.id !== id) throw new ProfileError('The server sent an unreadable conflict.');
      this.accept(current);
    }
    if (device.profiles[id].dirty) throw new ProfileError('That profile is still syncing on another device. Try again.');
  }

  private async push(device: DeviceState, blocked?: Set<string>): Promise<SyncError | undefined> {
    let error: SyncError | undefined;
    const ids = Object.keys(device.profiles);
    // Save the combined records before removing their sources. A rejected or interrupted target
    // upload leaves its source available on the server until the target can be synced.
    const ordered = [...ids.filter(id => !device.profiles[id].mergedInto), ...ids.filter(id => device.profiles[id].mergedInto)];
    for (const id of ordered) {
      if (device !== this.device) return;
      if (blocked?.has(id) || !device.profiles[id].dirty) continue;
      if (!this.mergeTargetReady(device, id, blocked)) {
        error ??= new ProfileError('The combined profile must finish syncing before its duplicate can be removed.');
        continue;
      }
      try { await this.pushProfile(device, id); } catch (failure) {
        if (!(failure instanceof ProfileError || (failure instanceof SyncError && failure.status === 413))) throw failure;
        error ??= failure;
      }
    }
    return error;
  }

  private mergeTargetReady(device: DeviceState, id: string, blocked?: Set<string>): boolean {
    const visited = new Set([id]);
    let target = device.profiles[id].mergedInto;
    while (target) {
      if (visited.has(target) || blocked?.has(target)) return false;
      visited.add(target);
      const meta = device.profiles[target];
      if (!meta?.mergedInto) return !!meta?.rev && !meta.dirty && !meta.deleted;
      target = meta.mergedInto;
    }
    return true;
  }

  private perform(action: () => Promise<void>): Promise<boolean> {
    if (this.running) return this.running;
    if (!this.api) return Promise.resolve(false);
    this.running = Promise.resolve().then(action).then(() => {
      this.error = undefined;
      return true;
    }, (error: unknown) => {
      this.error = error instanceof SyncError ? error.message : 'Family sync could not finish.';
      return false;
    }).finally(() => {
      this.running = undefined;
      this.refreshView();
    });
    this.refreshView();
    return this.running;
  }

  private async sync(device: DeviceState, pull: boolean, first?: string): Promise<void> {
    this.observeAll();
    let received: ReturnType<typeof this.acceptPull> | undefined;
    if (pull || device.since === undefined) {
      const incoming = await this.api!.pull(device.code!, device.since);
      this.reloadDevice();
      if (device !== this.device) return;
      received = this.acceptPull(incoming, first);
    }
    await this.finishSync(device, received);
  }

  private async finishSync(device: DeviceState, received?: ReturnType<typeof this.acceptPull>): Promise<void> {
    const pushError = await this.push(device, received?.blocked);
    if (device !== this.device) return;
    const error = received?.error ?? pushError;
    if (error) throw error;
    device.lastSync = this.now();
    this.persist();
  }

  async syncNow(first?: string): Promise<boolean> {
    if (this.running) await this.running;
    this.reloadDevice();
    const device = this.device;
    return device.code ? this.perform(() => this.sync(device, true, first)) : false;
  }

  async flush(): Promise<boolean> {
    if (this.running) await this.running;
    this.reloadDevice();
    const device = this.device;
    return device.code ? this.perform(() => this.sync(device, !!this.error)) : false;
  }

  hide(): void {
    this.reloadDevice();
    const device = this.device;
    if (!device.code || !this.online() || device.since === undefined) return;
    // Dispatch immediately even if a regular sync is waiting on a pull. The next pull
    // reconciles any receipts the browser could not process before the page closed.
    this.observeAll();
    for (const [id, meta] of Object.entries(device.profiles)) {
      if (!meta.dirty || this.sendingOnHide.has(meta) || !this.mergeTargetReady(device, id)) continue;
      let value: ProfileValue | undefined;
      try { value = this.value(id); } catch { continue; } // Leave an unreadable local save pending.
      if (!value) continue;
      this.sendingOnHide.add(meta);
      void this.api!.put(device.code, id, this.body(id, value), true).then(result => {
        this.reloadDevice();
        if (device === this.device && 'rev' in result) this.recordReceipt(id, meta, result.rev);
      }).catch(() => {}).finally(() => this.sendingOnHide.delete(meta));
    }
  }

  makeFamily(): Promise<boolean> {
    if (this.device.code) return Promise.resolve(false);
    const startingDevice = this.device;
    return this.perform(async () => {
      const raw = await this.api!.create();
      const code = typeof raw === 'string' ? normalizeFamilyCode(raw) : null;
      if (!code) throw new SyncError('The server sent an unreadable family code.');
      if (startingDevice !== this.device) return;
      this.device = { code, profiles: {} };
      this.persist();
      await this.sync(this.device, true);
    });
  }

  joinFamily(input: string): Promise<boolean> {
    if (this.device.code) return Promise.resolve(false);
    const startingDevice = this.device;
    return this.perform(async () => {
      const code = normalizeFamilyCode(input);
      if (!code) throw new SyncError('Enter all four words from the family code.');
      const incoming = await this.api!.pull(code);
      if (startingDevice !== this.device) return;
      this.device = { code, profiles: {} };
      this.observeAll();
      await this.finishSync(this.device, this.acceptPull(incoming));
    });
  }

  leaveFamily(): void {
    if (this.running) return;
    this.clearMembership();
  }

  private clearMembership(): void {
    this.device = { profiles: {} };
    this.error = undefined;
    this.persist();
  }

  deleteFamily(): Promise<boolean> {
    const device = this.device;
    const code = device.code;
    if (!code) return Promise.resolve(false);
    return this.perform(async () => {
      await this.api!.delete(code);
      if (device === this.device) this.clearMembership();
    });
  }
}
