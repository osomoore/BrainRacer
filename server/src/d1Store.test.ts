import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D1SyncStore } from './d1Store';
import type { ProfileChange } from './store';
import worker from './index';

const schema = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
const key = { id: 'family-1', codeHash: 'hash-1' };
const put = (baseRev: number, data = 'null'): ProfileChange => ({ kind: 'put', baseRev, data, deleted: false });
const del: ProfileChange = { kind: 'delete' };
let sql: DatabaseSync;
let store: D1SyncStore;

// Run the actual migration and SQL with the same statement order and rollback behavior as D1.
class SQLiteStatement {
  constructor(private readonly query: string, private readonly values: SQLInputValue[] = []) {}

  bind(...values: SQLInputValue[]) {
    return new SQLiteStatement(this.query, values);
  }

  async first<T>(): Promise<T | null> {
    return (this.all()[0] as T | undefined) ?? null;
  }

  all() {
    return sql.prepare(this.query).all(...this.values);
  }
}

const database = {
  prepare: (query: string) => new SQLiteStatement(query),
  async batch(statements: SQLiteStatement[]) {
    sql.exec('BEGIN');
    try {
      const results = statements.map((statement) => ({ success: true, results: statement.all() }));
      sql.exec('COMMIT');
      return results;
    } catch (error) {
      sql.exec('ROLLBACK');
      throw error;
    }
  },
};

beforeEach(() => {
  sql = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  sql.exec(schema);
  store = new D1SyncStore(database);
});

afterEach(() => sql.close());

describe('D1 storage SQL', () => {
  it('wires the Worker entry point to D1 and isolates each family', async () => {
    const origin = 'https://sync.test';
    const create = () => worker.fetch(new Request(`${origin}/v1/family`, { method: 'POST' }), { SYNC_DB: database });
    const first = await (await create()).json();
    const second = await (await create()).json();
    const request = (code: string, path = '/v1/family', method = 'GET', body?: string) =>
      worker.fetch(new Request(origin + path, { method, body, headers: { Authorization: `Family ${code}` } }), { SYNC_DB: database });
    expect((await request(first.code, '/v1/family/profile/p1', 'PUT', '{"baseRev":0,"data":{"name":"Ada"}}')).status).toBe(200);
    expect((await (await request(first.code)).json()).profiles).toMatchObject([{ id: 'p1', data: { name: 'Ada' } }]);
    expect((await (await request(second.code)).json()).profiles).toEqual([]);
    expect((await request(first.code, '/v1/family', 'DELETE')).status).toBe(200);
    expect((await request(first.code)).status).toBe(401);
    expect(sql.prepare('SELECT * FROM profiles').all()).toEqual([]);
    expect((await request(second.code)).status).toBe(200);
  });

  it('keeps unique family IDs and hashes and uses a consistent snapshot cursor', async () => {
    expect(await store.createFamily(key, 1)).toBe(true);
    expect(await store.createFamily({ ...key, id: 'different-id' }, 2)).toBe(false);
    expect(await store.createFamily({ ...key, codeHash: 'different-hash' }, 2)).toBe(false);
    expect(await store.findFamily('missing')).toBeNull();

    const before = await store.snapshot(key.id, -1, 100);
    expect(before).toEqual({ profiles: [], serverTime: 100 });
    const results = await Promise.all([
      store.changeProfile(key.id, 'p1', put(0, '"first"'), 100),
      store.changeProfile(key.id, 'p1', put(0, '"second"'), 100),
    ]);
    expect(results).toEqual([
      { kind: 'ok', rev: 1, updatedAt: 101, serverTime: 101 },
      { kind: 'conflict', current: { id: 'p1', rev: 1, updatedAt: 101, deleted: false, data: '"first"' } },
    ]);
    const after = await store.snapshot(key.id, 100, 99);
    expect(after?.serverTime).toBe(102);
    expect(after?.profiles.map((p) => p.id)).toEqual(['p1']);
    expect((await store.snapshot(key.id, 101, 100))?.profiles).toEqual([]);
  });

  it('enforces capacity with tombstones, supports repeated deletes and prevents orphan writes', async () => {
    await store.createFamily(key, 10);
    const creations = await Promise.all(Array.from({ length: 21 }, (_, i) =>
      store.changeProfile(key.id, `p${i}`, put(0, '"save"'), 10)));
    expect(creations.filter((result) => result.kind === 'ok')).toHaveLength(20);
    expect(creations[20]).toEqual({ kind: 'full' });
    expect(await store.changeProfile(key.id, 'missing', put(1), 10)).toEqual({ kind: 'conflict', current: null });

    expect(await store.changeProfile(key.id, 'p0', del, 10)).toMatchObject({ kind: 'ok', rev: 2 });
    expect(await store.changeProfile(key.id, 'p0', del, 10)).toMatchObject({ kind: 'ok', rev: 2 });
    expect((await store.snapshot(key.id, 30, 10))?.profiles).toMatchObject([{ id: 'p0', deleted: true, data: 'null' }]);
    expect(await store.changeProfile(key.id, 'missing', del, 10)).toEqual({ kind: 'full' });
    expect(await store.changeProfile(key.id, 'p0', put(2), 10)).toMatchObject({ kind: 'ok', rev: 3 });

    expect(await store.deleteFamily(key.id)).toBe(true);
    expect(await store.changeProfile(key.id, 'p0', put(0), 11)).toEqual({ kind: 'missing-family' });
    expect(await store.snapshot(key.id, 0, 11)).toBeNull();
  });

  it('counts independent rate buckets atomically and resets only on a newer window', async () => {
    expect(await Promise.all([
      store.takeRateLimit('ip', 'one', 0, 1000, 2),
      store.takeRateLimit('ip', 'one', 500, 1000, 2),
      store.takeRateLimit('ip', 'one', 999, 1000, 2),
    ])).toEqual([1000, 1000, null]);
    expect(await store.takeRateLimit('ip', 'two', 999, 1000, 2)).toBe(1000);
    expect(await store.takeRateLimit('create', 'one', 999, 1000, 2)).toBe(1000);
    expect(await store.takeRateLimit('ip', 'one', 1000, 1000, 2)).toBe(2000);
    expect(await store.takeRateLimit('ip', 'one', 500, 1000, 2)).toBe(2000);
    await store.releaseRateLimit('ip', 'one', 1000);
    expect(await store.takeRateLimit('ip', 'one', 1000, 1000, 2)).toBeNull();
    await store.releaseRateLimit('ip', 'one', 2000);
    expect(await store.takeRateLimit('ip', 'one', 1000, 1000, 2)).toBe(2000);
  });
});
