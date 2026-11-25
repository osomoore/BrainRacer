import { MAX_PROFILES } from './store';
import type { ChangeResult, FamilyKey, Profile, ProfileChange, Snapshot, SyncStore } from './store';

// Structural types for the D1 methods used here. No Workers SDK is needed to typecheck.
type D1Value = string | number | null;
type D1Result = { results: unknown[]; success: boolean };

interface D1Statement {
  bind(...values: D1Value[]): D1Statement;
  first<T>(): Promise<T | null>;
}

export interface D1Database {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
}

type ProfileRow = Omit<Profile, 'deleted'> & { deleted: number };
type Watermark = { serverTime: number };
type Version = Pick<Profile, 'rev' | 'updatedAt'>;

const PROFILE_FIELDS = 'id, rev, updated_at AS updatedAt, deleted, data';

function profileFromRow(row: ProfileRow): Profile {
  return { ...row, deleted: row.deleted === 1 };
}

export class D1SyncStore implements SyncStore {
  constructor(private readonly db: D1Database) {}

  private statement(sql: string, ...params: D1Value[]) {
    return this.db.prepare(sql).bind(...params);
  }

  private async batch(...statements: D1Statement[]) {
    // D1 executes the batch in order within one transaction and rolls it back on failure.
    const results = await this.db.batch(statements);
    if (results.some((result) => !result.success)) throw new Error('D1 batch failed');
    return results.map((result) => result.results);
  }

  async createFamily({ id, codeHash }: FamilyKey, now: number): Promise<boolean> {
    const row = await this.statement(
      `INSERT INTO families (id, code_hash, created_at, last_seen)
       VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING id`,
      id, codeHash, now, now,
    ).first<{ id: string }>();
    return row !== null;
  }

  async findFamily(codeHash: string): Promise<FamilyKey | null> {
    // One result row for hits and misses, followed by a fixed-width hash check in the handler.
    const row = await this.statement(
      `SELECT f.id, f.code_hash AS codeHash
       FROM (SELECT ? AS code_hash) AS candidate
       LEFT JOIN families AS f ON f.code_hash = candidate.code_hash`,
      codeHash,
    ).first<{ id: string | null; codeHash: string | null }>();
    return row?.id && row.codeHash ? { id: row.id, codeHash: row.codeHash } : null;
  }

  async snapshot(familyId: string, since: number, now: number): Promise<Snapshot | null> {
    const [clock, profiles] = await this.batch(
      this.statement(
        `UPDATE families SET last_seen = MAX(last_seen, ?) WHERE id = ? RETURNING last_seen AS serverTime`,
        now, familyId,
      ),
      this.statement(
        `SELECT ${PROFILE_FIELDS} FROM profiles
         WHERE family_id = ? AND updated_at > ? ORDER BY updated_at`,
        familyId, since,
      ),
    );
    const watermark = clock[0] as Watermark | undefined;
    return watermark
      ? { ...watermark, profiles: (profiles as ProfileRow[]).map(profileFromRow) }
      : null;
  }

  async changeProfile(familyId: string, id: string, change: ProfileChange, now: number): Promise<ChangeResult> {
    const baseRev = change.kind === 'put' ? change.baseRev : null;
    const newAllowed = baseRev === null || baseRev === 0;
    const data = change.kind === 'put' ? change.data : 'null';
    const deleted = change.kind === 'delete' || change.deleted;
    const updateCondition = change.kind === 'put'
      ? 'profiles.rev = ?'
      : "(profiles.deleted = 0 OR profiles.data <> 'null')";
    const [clock, versions, profiles] = await this.batch(
      // Advance beyond any previous snapshot even if two requests share a millisecond.
      this.statement(
        `UPDATE families SET last_seen = MAX(last_seen + 1, ?) WHERE id = ? RETURNING last_seen AS serverTime`,
        now, familyId,
      ),
      this.statement(
        `INSERT INTO profiles (family_id, id, rev, updated_at, deleted, data)
         SELECT f.id, ?, 1, f.last_seen, ?, ? FROM families AS f
         WHERE f.id = ? AND (
           EXISTS (SELECT 1 FROM profiles WHERE family_id = f.id AND id = ?)
           OR (? = 1 AND (SELECT COUNT(*) FROM profiles WHERE family_id = f.id) < ?)
         )
         ON CONFLICT(family_id, id) DO UPDATE SET
           rev = profiles.rev + 1,
           updated_at = excluded.updated_at,
           deleted = excluded.deleted,
           data = excluded.data
         WHERE ${updateCondition}
         RETURNING rev, updated_at AS updatedAt`,
        id, Number(deleted), data, familyId, id, Number(newAllowed), MAX_PROFILES,
        ...(baseRev === null ? [] : [baseRev]),
      ),
      this.statement(
        `SELECT ${PROFILE_FIELDS} FROM profiles
         WHERE family_id = ? AND id = ?`,
        familyId, id,
      ),
    );
    const watermark = clock[0] as Watermark | undefined;
    if (!watermark) return { kind: 'missing-family' };
    const version = versions[0] as Version | undefined;
    if (version) return { kind: 'ok', ...version, ...watermark };

    const current = profiles[0] as ProfileRow | undefined;
    if (current && change.kind === 'delete') {
      return { kind: 'ok', rev: current.rev, updatedAt: current.updatedAt, ...watermark };
    }
    if (current || !newAllowed) return { kind: 'conflict', current: current ? profileFromRow(current) : null };
    return { kind: 'full' };
  }

  async deleteFamily(familyId: string): Promise<boolean> {
    const [families] = await this.batch(
      this.statement('DELETE FROM families WHERE id = ? RETURNING id', familyId),
      this.statement("DELETE FROM rate_limits WHERE scope = 'family' AND key = ?", familyId),
    );
    return families.length > 0;
  }

  async takeRateLimit(scope: string, key: string, now: number, windowMs: number, limit: number): Promise<boolean> {
    const expiresAt = now - now % windowMs + windowMs;
    const row = await this.statement(
      `INSERT INTO rate_limits (scope, key, expires_at, count) VALUES (?, ?, ?, 1)
       ON CONFLICT(scope, key) DO UPDATE SET
         count = CASE WHEN expires_at < excluded.expires_at THEN 1 ELSE count + 1 END,
         expires_at = MAX(expires_at, excluded.expires_at)
       WHERE expires_at < excluded.expires_at OR count < ?
       RETURNING count`,
      scope, key, expiresAt, limit,
    ).first<{ count: number }>();
    return row !== null;
  }
}
