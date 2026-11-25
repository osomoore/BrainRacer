export const MAX_PROFILES = 20;

export interface FamilyKey {
  id: string;
  codeHash: string;
}

export interface Profile {
  id: string;
  rev: number;
  updatedAt: number;
  deleted: boolean;
  // Serialized JSON. The store never interprets a game's payload.
  data: string;
}

export interface Snapshot {
  serverTime: number;
  profiles: Profile[];
}

export type ProfileChange =
  | { kind: 'put'; baseRev: number; data: string; deleted: boolean }
  | { kind: 'delete' };

export type ChangeResult =
  | { kind: 'ok'; rev: number; updatedAt: number; serverTime: number }
  | { kind: 'conflict'; current: Profile | null }
  | { kind: 'full' }
  | { kind: 'missing-family' };

export interface SyncStore {
  // Returns false on a generated ID or hash collision.
  createFamily(key: FamilyKey, now: number): Promise<boolean>;
  findFamily(codeHash: string): Promise<FamilyKey | null>;
  // Read the rows and capture the high-water mark in one transaction.
  snapshot(familyId: string, since: number, now: number): Promise<Snapshot | null>;
  // Apply revision checks, enforce capacity and capture the change atomically.
  changeProfile(familyId: string, id: string, change: ProfileChange, now: number): Promise<ChangeResult>;
  deleteFamily(familyId: string): Promise<boolean>;
  // Reserve a request and return the bucket expiry, or null when the bucket is full.
  takeRateLimit(scope: string, key: string, now: number, windowMs: number, limit: number): Promise<number | null>;
  releaseRateLimit(scope: string, key: string, expiresAt: number): Promise<void>;
}
