import { beforeEach, describe, expect, it } from 'vitest';
import { handleRequest, MAX_DATA_BYTES, RATE_LIMITS } from './handler';
import { sha256 } from './codes';
import { MemoryStore } from './memoryStore';
import { FAMILY_WORDS } from './words';

const code = 'RAPTOR-TURBO-FOSSIL-WHEEL';
const origin = 'http://localhost:5173';
let store: MemoryStore;
async function setup() {
  const key = { id: 'family1', codeHash: await sha256(code) };
  await store.createFamily(key, 1000);
  return key;
}
function req(path: string, method = 'GET', body?: unknown, auth = `Family ${code}`, extra: Record<string, string> = {}) {
  return new Request(`https://sync.test${path}`, { method, headers: { Authorization: auth, Origin: origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function call(path: string, method = 'GET', body?: unknown, auth?: string) {
  return handleRequest(req(path, method, body, auth), store, 1_000_000);
}
beforeEach(() => { store = new MemoryStore(); });

describe('family sync handler', () => {
  it('creates a family with correctly formatted generated code and stores only its hash', async () => {
    const response = await handleRequest(new Request('https://sync.test/v1/family', { method: 'POST' }), store, 42);
    const json = await response.json();
    expect(response.status).toBe(201);
    expect(json.code).toMatch(/^[A-Z]{3,8}(?:-[A-Z]{3,8}){3}$/);
    for (const word of String(json.code).split('-')) expect(FAMILY_WORDS).toContain(word);
    expect(FAMILY_WORDS).toHaveLength(512);
    expect(new Set(FAMILY_WORDS).size).toBe(512);
    expect(FAMILY_WORDS.every((word) => /^[A-Z]{3,8}$/.test(word))).toBe(true);
    expect(json.serverTime).toBe(42);
    const [family] = store.families.values();
    expect(family.id).toMatch(/^[a-f0-9]{32}$/);
    expect(family.codeHash).toBe(await sha256(json.code));
    expect(family.codeHash).not.toBe(json.code);
    const typed = String(json.code).toLowerCase().split('-').join(' - ');
    expect((await call('/v1/family', 'GET', undefined, `family ${typed}`)).status).toBe(200);
  });
  it('returns JSON CORS preflight and rejects disallowed origins/routes/methods', async () => {
    const preflight = await handleRequest(new Request('https://sync.test/v1/family', { method: 'OPTIONS', headers: { Origin: origin } }), store, 5);
    expect(preflight.status).toBe(200); expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect((await preflight.json()).serverTime).toBe(5);
    for (const allowed of ['https://osomoore.github.io', origin, 'http://127.0.0.1:5173', 'http://10.0.0.1:5173', 'http://172.31.0.1:5173', 'http://192.168.1.20:5173', 'http://[fd00::1]:5173']) {
      const response = await handleRequest(req('/v1/family/profile/p1', 'OPTIONS', undefined, '', { Origin: allowed }), store);
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(allowed);
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
    }
    for (const denied of ['https://evil.test', 'http://10.example.com:5173', 'http://172.32.0.1:5173', 'https://osomoore.github.io.evil.test']) {
      const response = await handleRequest(req('/v1/family', 'OPTIONS', undefined, '', { Origin: denied }), store);
      expect(response.status).toBe(403);
      expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
    }
    expect((await call('/missing')).status).toBe(404);
    const method = await call('/v1/family', 'PUT'); expect(method.status).toBe(405); expect(method.headers.get('Allow')).toContain('DELETE');
  });
  it('requires a valid code and validates since cursor and profile ID', async () => {
    await setup();
    for (const auth of ['', 'Family bad', 'Family RAPTOR-TURBO-FOSSIL-TIRE', 'Family RAPTOR-TURBO-FOSSIL-WHEELS']) {
      const response = await call('/v1/family', 'GET', undefined, auth);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Invalid family code', serverTime: 1_000_000 });
    }
    expect((await call('/v1/family?since=-1')).status).toBe(400);
    expect((await call('/v1/family?since=1.2')).status).toBe(400);
    expect((await call('/v1/family/profile/%00', 'DELETE')).status).toBe(400);
    expect((await call('/v1/family/profile/%ZZ', 'DELETE')).status).toBe(400);
  });
  it('supports put, conflict response, delete tombstones, and delete family', async () => {
    await setup();
    const put = await call('/v1/family/profile/kid%201', 'PUT', { baseRev: 0, data: { name: 'A' } });
    expect(put.status).toBe(200); expect(await put.json()).toMatchObject({ rev: 1, updatedAt: 1_000_000 });
    const conflict = await call('/v1/family/profile/kid%201', 'PUT', { baseRev: 0, data: { name: 'B' } });
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).current).toEqual({ id: 'kid 1', rev: 1, updatedAt: 1_000_000, deleted: false, data: { name: 'A' } });
    const del = await call('/v1/family/profile/kid%201', 'DELETE'); expect(del.status).toBe(200);
    expect((await (await call('/v1/family')).json()).profiles[0]).toMatchObject({ deleted: true, rev: 2, data: null });
    const staleEdit = await call('/v1/family/profile/kid%201', 'PUT', { baseRev: 1, data: { name: 'C' } });
    expect(staleEdit.status).toBe(409);
    expect((await staleEdit.json()).current).toMatchObject({ id: 'kid 1', rev: 2, deleted: true, data: null });
    expect(await (await call('/v1/family/profile/kid%201', 'DELETE')).json()).toMatchObject({ rev: 2 });
    const undelete = await call('/v1/family/profile/kid%201', 'PUT', { baseRev: 2, data: { name: 'C' }, deleted: false });
    expect(undelete.status).toBe(200);
    expect((await call('/v1/family', 'DELETE')).status).toBe(200);
    expect((await call('/v1/family')).status).toBe(401);
  });

  it('validates PUT envelopes and accepts PUT tombstones', async () => {
    await setup();
    for (const body of [null, [], { baseRev: 0 }, { baseRev: 0.5, data: null }, { baseRev: 0, deleted: 'true', data: null }]) {
      expect((await call('/v1/family/profile/a', 'PUT', body)).status).toBe(400);
    }
    const conflict = await call('/v1/family/profile/a', 'PUT', { baseRev: 1, data: null });
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).current).toEqual({ id: 'a', rev: 0, updatedAt: 0, deleted: false, data: null });
    expect((await call('/v1/family/profile/a', 'PUT', { baseRev: 0, data: null, deleted: true })).status).toBe(200);
    const snapshot = await (await call('/v1/family')).json();
    expect(snapshot.profiles[0]).toMatchObject({ id: 'a', rev: 1, deleted: true, data: null });
  });

  it('uses strict since cursors without missing later writes within the same millisecond', async () => {
    await setup();
    await handleRequest(req('/v1/family/profile/a', 'PUT', { baseRev: 0, data: { x: 1 } }), store, 2000);
    const first = await (await handleRequest(req('/v1/family'), store, 2000)).json();
    await handleRequest(req('/v1/family/profile/b', 'PUT', { baseRev: 0, data: { x: 2 } }), store, 2000);
    const delta = await (await handleRequest(req(`/v1/family?since=${first.serverTime}`), store, 2000)).json();
    expect(first.serverTime).toBe(2000);
    expect(delta.profiles.map((profile: { id: string }) => profile.id)).toEqual(['b']);
    expect(delta.serverTime).toBe(2001);
    expect((await (await handleRequest(req(`/v1/family?since=${delta.serverTime}`), store, 2000)).json()).profiles).toEqual([]);
  });
  it('enforces UTF-8 profile size and family capacity', async () => {
    await setup();
    const atLimit = 'é'.repeat((MAX_DATA_BYTES - 2) / 2);
    expect((await call('/v1/family/profile/p0', 'PUT', { baseRev: 0, data: atLimit })).status).toBe(200);
    expect((await call('/v1/family/profile/large', 'PUT', { baseRev: 0, data: atLimit + 'é' })).status).toBe(413);
    for (let i = 1; i < 20; i++) expect((await call(`/v1/family/profile/p${i}`, 'PUT', { baseRev: 0, data: null })).status).toBe(200);
    expect((await call('/v1/family/profile/p0', 'DELETE')).status).toBe(200);
    expect((await call('/v1/family/profile/p20', 'PUT', { baseRev: 0, data: null })).status).toBe(413);
  });

  it('rejects an oversized request body even without a Content-Length header', async () => {
    await setup();
    const request = new Request('https://sync.test/v1/family/profile/a', {
      method: 'PUT',
      headers: { Authorization: `Family ${code}` },
      body: ' '.repeat(7 * MAX_DATA_BYTES),
    });
    expect((await handleRequest(request, store, 1000)).status).toBe(413);
  });

  it('caps family creation per IP, then resets the window', async () => {
    const { limit, windowMs } = RATE_LIMITS.create;
    const create = (now: number) => handleRequest(req('/v1/family', 'POST'), store, now);
    for (let i = 0; i < limit; i++) {
      expect((await create(1000)).status).toBe(201);
    }
    expect((await create(1000)).status).toBe(429);
    expect((await create(windowMs)).status).toBe(201);
  });

  it('charges only authentication failures, then blocks guessing from that IP until the next hour', async () => {
    await setup();
    const { windowMs } = RATE_LIMITS.authFailure;
    const valid = `Family ${code}`;
    const unknown = 'Family RAPTOR-TURBO-FOSSIL-TIRE';
    const pull = (auth: string, now = 1000, ip = '192.0.2.1') =>
      handleRequest(req('/v1/family', 'GET', undefined, auth, { 'CF-Connecting-IP': ip }), store, now);
    for (let i = 0; i < 9; i++) {
      expect((await pull(unknown)).status).toBe(401);
      expect((await pull(valid)).status).toBe(200);
    }
    const lastAttempts = await Promise.all([pull(unknown), pull(unknown)]);
    expect(lastAttempts.map(response => response.status).sort()).toEqual([401, 429]);
    expect((await pull(valid, windowMs - 1)).status).toBe(429);
    expect((await pull(valid, 1000, '192.0.2.2')).status).toBe(200);
    expect((await pull(valid, windowMs)).status).toBe(200);
  });

  it('applies injected-time IP and family rate limits with Retry-After', async () => {
    await setup();
    for (let i = 0; i < 120; i++) {
      const request = req('/v1/family', 'GET', undefined, `Family ${code}`, { 'CF-Connecting-IP': `10.0.0.${i + 1}` });
      expect((await handleRequest(request, store, 60_000)).status).toBe(200);
    }
    const limited = await handleRequest(req('/v1/family', 'GET', undefined, `Family ${code}`, { 'CF-Connecting-IP': '10.1.0.1' }), store, 60_000);
    expect(limited.status).toBe(429); expect(limited.headers.get('Retry-After')).toBe('60');
    expect(limited.headers.get('Access-Control-Expose-Headers')).toBe('Retry-After');
  });
});
