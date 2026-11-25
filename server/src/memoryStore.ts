import { MAX_PROFILES } from './store';
import type { ChangeResult, FamilyKey, Profile, ProfileChange, Snapshot, SyncStore } from './store';

type Family = FamilyKey & { lastSeen: number; profiles: Map<string, Profile> };

/** Deterministic in-memory store for handler tests. */
export class MemoryStore implements SyncStore {
  readonly families = new Map<string, Family>();
  private readonly rates = new Map<string, { expiresAt: number; count: number }>();

  async createFamily(key: FamilyKey, now: number): Promise<boolean> {
    if (this.families.has(key.id) || [...this.families.values()].some((family) => family.codeHash === key.codeHash)) return false;
    this.families.set(key.id, { ...key, lastSeen: now, profiles: new Map() });
    return true;
  }

  async findFamily(codeHash: string): Promise<FamilyKey | null> {
    return [...this.families.values()].find((family) => family.codeHash === codeHash) ?? null;
  }

  async snapshot(familyId: string, since: number, now: number): Promise<Snapshot | null> {
    const family = this.families.get(familyId);
    if (!family) return null;
    family.lastSeen = Math.max(family.lastSeen, now);
    const profiles = [...family.profiles.values()].filter((profile) => profile.updatedAt > since);
    return { serverTime: family.lastSeen, profiles: profiles.sort((a, b) => a.updatedAt - b.updatedAt) };
  }

  async changeProfile(familyId: string, id: string, change: ProfileChange, now: number): Promise<ChangeResult> {
    const family = this.families.get(familyId);
    if (!family) return { kind: 'missing-family' };
    family.lastSeen = Math.max(family.lastSeen + 1, now);
    const current = family.profiles.get(id);
    if (change.kind === 'put' && (current?.rev ?? 0) !== change.baseRev) return { kind: 'conflict', current: current ?? null };
    if (!current && family.profiles.size >= MAX_PROFILES) return { kind: 'full' };
    if (change.kind === 'delete' && current?.deleted && current.data === 'null') {
      return { kind: 'ok', rev: current.rev, updatedAt: current.updatedAt, serverTime: family.lastSeen };
    }
    const next: Profile = {
      id,
      rev: (current?.rev ?? 0) + 1,
      updatedAt: family.lastSeen,
      deleted: change.kind === 'delete' || change.deleted,
      data: change.kind === 'delete' ? 'null' : change.data,
    };
    family.profiles.set(id, next);
    return { kind: 'ok', rev: next.rev, updatedAt: next.updatedAt, serverTime: family.lastSeen };
  }

  async deleteFamily(familyId: string): Promise<boolean> {
    this.rates.delete(`family:${familyId}`);
    return this.families.delete(familyId);
  }

  async takeRateLimit(scope: string, key: string, now: number, windowMs: number, limit: number): Promise<boolean> {
    const bucket = `${scope}:${key}`;
    const expiresAt = now - now % windowMs + windowMs;
    const current = this.rates.get(bucket);
    if (current && current.expiresAt >= expiresAt) {
      if (current.count >= limit) return false;
      current.count += 1;
    } else {
      this.rates.set(bucket, { expiresAt, count: 1 });
    }
    return true;
  }
}
