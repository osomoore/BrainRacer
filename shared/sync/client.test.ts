import { describe, expect, it } from 'vitest';
import { engine } from '../../apps/workshop/logic';
import { combineProfileRecords } from '../profileManager';
import { FamilySyncClient, type LocalProfiles } from './client';
import { normalizeFamilyCode } from './code';
import { FakeFamilyServer } from './fake';
import { FamilyApi, type Fetch } from './protocol';
import { mergeProfile, type ProfileValue } from './record';
import type { ProfileSnapshot } from './storage';
import { FAMILY_WORDS } from './words';

const URL = 'https://family.test';
const ID = 'juniper';

function baseProfile(): ProfileSnapshot {
  const workshop = engine.newPlayerSave('medium');
  workshop.workshops.race = engine.progressOf(workshop, 'race');
  return { profile: { id: ID, name: 'June', createdAt: 10 }, racer: {}, workshop };
}

function device(send: Fetch, clock: number, initial?: ProfileSnapshot) {
  const saves = new Map<string, ProfileSnapshot>(initial ? [[initial.profile.id, initial]] : []);
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
  const transport: { offline: boolean; requests: Request[]; redirected: [string, string][] } = { offline: false, requests: [], redirected: [] };
  const local: LocalProfiles = {
    ids: () => [...saves.keys()], read: id => saves.get(id),
    apply: ({ profile, racer, workshop }) => { saves.set(profile.id, structuredClone({ profile, racer, workshop })); },
    hide: (id, target) => { saves.delete(id); if (target) transport.redirected.push([id, target]); },
    rekey: (id, next) => {
      const save = saves.get(id)!;
      saves.delete(id);
      saves.set(next, { ...save, profile: { ...save.profile, id: next } });
      return true;
    },
  };
  const api = new FamilyApi(URL, async (input, init) => {
    transport.requests.push(new Request(input, init));
    if (transport.offline) throw new TypeError('offline');
    return send(input, init);
  });
  const createClient = () => new FamilySyncClient(api, local, storage, 'sync', () => !transport.offline, () => clock, () => 'local-copy');
  return { local, saves, transport, createClient, client: createClient() };
}

function modify(d: ReturnType<typeof device>, change: (p: ProfileSnapshot) => void) {
  change(d.saves.get(ID)!);
  d.client.noteChange(ID);
}

describe('family sync', () => {
  it('round-trips all 512 distinct words through the client normalizer', () => {
    expect(FAMILY_WORDS).toHaveLength(512);
    expect(new Set(FAMILY_WORDS).size).toBe(512);
    for (const word of FAMILY_WORDS) {
      expect(normalizeFamilyCode(`  Raptor - turbo  FOSSIL  ${word.toLowerCase()}  `))
        .toBe(`RAPTOR-TURBO-FOSSIL-${word}`);
    }
  });

  it('requires four exact dictionary words without digits', () => {
    for (const code of ['RAPTOR-TURBO-FOSSIL', 'RAPTOR-TURBO-FOSSIL-42', 'RAPTOR-TURBO-FOSSIL-WHEELS',
      'RAPTOR-TURBO-FOSSIL-WHEEL-TIRE', 'RAPTOR-TURBO-FOSSILWHEEL', 'RAPTOR-TURBO-FOſSIL-WHEEL']) {
      expect(normalizeFamilyCode(code)).toBeNull();
    }
  });

  it('merges two offline branches on a 409 and converges on another pull', async () => {
    const server = new FakeFamilyServer();
    const a = device(server.fetch, 100, baseProfile());
    const b = device(server.fetch, 200);
    expect(await a.client.makeFamily()).toBe(true);
    const typed = a.client.state.code!.toLowerCase().replaceAll('-', ' ');
    expect(await b.client.joinFamily(typed)).toBe(true);
    expect(b.client.state.code).toBe(a.client.state.code);
    expect(b.saves.get(ID)).toEqual(a.saves.get(ID));
    a.transport.offline = b.transport.offline = true;
    modify(a, p => {
      p.racer.progress = { worlds: ['underground'], items: [], overrides: { underground: true } };
      p.racer.jbq = { 1: 3, 2: 1 };
      const progress = p.workshop!.workshops.race!;
      progress.bought.push('wheels.mud');
      progress.wallet = 15;
      const id = progress.active[0];
      progress.completed[id] = { build: progress.model, payout: 2, wonAt: 100 };
      progress.buddies.unlocked.push('star');
    });
    modify(b, p => {
      p.profile.name = 'Juniper';
      p.racer.progress = { worlds: ['farm'], items: [], overrides: {} };
      p.racer.jbq = { 1: 2, 3: 1 };
      const progress = p.workshop!.workshops.race!;
      progress.bought.push('gears.power');
      progress.wallet = 33;
      progress.buddies.progress = 4;
      const id = progress.active[1];
      progress.completed[id] = { build: progress.model, payout: 2, wonAt: 200 };
    });
    expect(await a.client.flush()).toBe(false);
    expect(a.client.state.status).toBe('offline');
    expect(a.client.state.pending).toBe(1);
    // Simulate an app reopening with its pending metadata intact.
    a.transport.offline = false;
    expect(await a.createClient().flush()).toBe(true);
    b.transport.offline = false;
    expect(await b.client.flush()).toBe(true);
    expect(b.transport.requests.filter(r => r.method === 'PUT')).toHaveLength(2);
    expect(await a.client.syncNow(ID)).toBe(true);
    expect(a.transport.requests.some(r => r.url.includes('?since='))).toBe(true);
    const aCurrent = a.saves.get(ID)!;
    expect(aCurrent).toEqual(b.saves.get(ID));
    expect(aCurrent.profile.name).toBe('Juniper');
    expect(aCurrent.racer.progress).toEqual({ worlds: ['underground', 'farm'], items: [], overrides: {} });
    expect(aCurrent.racer.jbq).toEqual({ 1: 3, 2: 1, 3: 1 });
    const race = aCurrent.workshop!.workshops.race!;
    expect(race.bought).toEqual(['wheels.mud', 'gears.power']);
    expect(race.wallet).toBe(33);
    expect(race.buddies.progress).toBe(4);
    expect(race.buddies.unlocked).toContain('star');
    expect(Object.keys(race.completed)).toHaveLength(2);
    expect(a.client.state.pending).toBe(0);
  });

  it('uploads the combined target before tombstoning the source and sends the replacement to another device', async () => {
    const server = new FakeFamilyServer();
    let rejectTarget = false;
    const send: Fetch = (input, init) => rejectTarget && init?.method === 'PUT' && String(input).endsWith(`/${ID}`)
      ? Promise.resolve(new Response('', { status: 413 })) : server.fetch(input, init);
    const source = baseProfile();
    source.profile = { id: 'source', name: 'June', createdAt: 20 };
    source.racer = { jbq: { 1: 4 } };
    const target = baseProfile();
    const a = device(send, 200, source);
    a.saves.set(ID, target);
    expect(await a.client.makeFamily()).toBe(true);
    const b = device(server.fetch, 300);
    expect(await b.client.joinFamily(a.client.state.code!)).toBe(true);

    const withMetadata = (snapshot: ProfileSnapshot) => ({ ...snapshot, schema: 1 as const, updatedAt: snapshot.profile.createdAt });
    const { profile, racer, workshop } = combineProfileRecords(withMetadata(source), withMetadata(target));
    a.saves.set(ID, { profile, racer, workshop });
    a.saves.delete('source');
    a.client.noteChange(ID);
    a.client.noteChange('source', true, ID);
    a.transport.requests.length = 0;
    rejectTarget = true;
    expect(await a.client.flush()).toBe(false);
    expect(a.transport.requests.filter(req => req.method === 'PUT').map(req => req.url.split('/').at(-1))).toEqual([ID]);
    await b.client.syncNow();
    expect(b.saves.has('source')).toBe(true);

    rejectTarget = false;
    a.transport.requests.length = 0;
    expect(await a.createClient().flush()).toBe(true);
    expect(a.transport.requests.filter(req => req.method === 'PUT').map(req => req.url.split('/').at(-1))).toEqual([ID, 'source']);
    expect(await b.client.syncNow()).toBe(true);
    expect(b.saves.has('source')).toBe(false);
    expect(b.saves.get(ID)?.racer.jbq).toEqual({ 1: 4 });
    expect(b.transport.redirected).toEqual([['source', ID]]);
  });

  it('keeps a duplicate visible when its unsynced local edit has not reached the combined save', async () => {
    const server = new FakeFamilyServer();
    const source = baseProfile();
    source.profile = { id: 'source', name: 'June', createdAt: 20 };
    const a = device(server.fetch, 300, source);
    a.saves.set(ID, baseProfile());
    await a.client.makeFamily();
    const b = device(server.fetch, 100);
    await b.client.joinFamily(a.client.state.code!);

    b.saves.get('source')!.racer.jbq = { 8: 3 };
    b.client.noteChange('source');
    a.saves.delete('source');
    a.client.noteChange('source', true, ID);
    expect(await a.client.flush()).toBe(true);
    expect(await b.client.syncNow()).toBe(true);
    expect(b.saves.get('source')?.racer.jbq).toEqual({ 8: 3 });
    expect(await a.client.syncNow()).toBe(true);
    expect(a.saves.get('source')?.racer.jbq).toEqual({ 8: 3 });
  });

  it.each(['PUT', 'DELETE'])('reconciles stale edits against a tombstone from %s on a 409', async (method) => {
    const server = new FakeFamilyServer();
    const a = device(server.fetch, 100, baseProfile());
    await a.client.makeFamily();
    const b = device(server.fetch, 200);
    const c = device(server.fetch, method === 'PUT' ? 300 : Date.now() + 60_000);
    await b.client.joinFamily(a.client.state.code!);
    await c.client.joinFamily(a.client.state.code!);
    modify(a, p => { p.profile.name = 'Old'; });
    modify(c, p => { p.profile.name = 'Newer'; });
    if (method === 'PUT') {
      b.local.hide(ID);
      b.client.noteChange(ID, true);
      expect(await b.client.flush()).toBe(true);
    } else {
      const del = await server.fetch(`${URL}/v1/family/profile/${ID}`, {
        method: 'DELETE', headers: { Authorization: `Family ${a.client.state.code}` },
      });
      expect(del.status).toBe(200);
    }
    const aBefore = a.transport.requests.filter(r => r.method === 'PUT').length;
    expect(await a.client.flush()).toBe(true);
    expect(a.transport.requests.filter(r => r.method === 'PUT')).toHaveLength(aBefore + 1);
    expect(a.saves.get(ID)).toBeUndefined();
    expect(await c.client.flush()).toBe(true);
    const retried = c.transport.requests.filter(r => r.method === 'PUT');
    expect(retried).toHaveLength(2);
    expect(await retried[1].json()).toMatchObject({ baseRev: 2, data: { profile: { name: 'Newer' } } });
    expect(await a.client.syncNow()).toBe(true);
    expect(a.saves.get(ID)?.profile.name).toBe('Newer');
  });

  it('preserves pre-sync profiles with colliding sequential IDs when joining', async () => {
    const server = new FakeFamilyServer();
    const first = baseProfile();
    first.profile.id = 'p1';
    const next = structuredClone(first);
    next.profile = { id: 'p1', name: 'Sam', createdAt: 11 };
    const a = device(server.fetch, 100, first);
    const b = device(server.fetch, 200, next);
    await a.client.makeFamily();
    expect(await b.client.joinFamily(a.client.state.code!)).toBe(true);
    expect(b.saves.get('p1')?.profile.name).toBe('June');
    expect(b.saves.get('local-copy')?.profile.name).toBe('Sam');
    expect(await a.client.syncNow()).toBe(true);
    expect(a.saves.get('local-copy')).toEqual(b.saves.get('local-copy'));
  });

  it('ignores malformed rows and keeps the local snapshot when auth or network fails', async () => {
    const server = new FakeFamilyServer();
    let garbled = false;
    const a = device(async (url, init) => {
      if (garbled) return Response.json({ serverTime: 1e15, profiles: [
        { id: ID, rev: 2, updatedAt: 20, data: { schema: 1, profile: baseProfile().profile, updatedAt: 20, racer: {}, workshop: { version: 2 } } },
        { id: 'nope', rev: 2, updatedAt: 20, data: { schema: 2 } },
      ] });
      return server.fetch(url, init);
    }, 100, baseProfile());
    expect(await a.client.joinFamily('raptor-turbo-fossil-wheel')).toBe(false);
    expect(a.saves.get(ID)).toEqual(baseProfile());
    expect(await a.client.makeFamily()).toBe(true);
    garbled = true;
    expect(await a.client.syncNow()).toBe(false);
    expect(a.client.state.error).toContain('unreadable');
    expect(a.saves.get(ID)).toEqual(baseProfile());
    a.transport.offline = true;
    expect(await a.client.deleteFamily()).toBe(false);
    expect(a.client.state.code).toBeDefined();
    a.transport.offline = false;
    garbled = false;
    expect(await a.client.deleteFamily()).toBe(true);
    expect(a.client.state.status).toBe('off');
    expect(a.saves.get(ID)).toEqual(baseProfile());
  });

  it('pulls valid profiles alongside unreadable server rows', async () => {
    const server = new FakeFamilyServer();
    const a = device(server.fetch, 100, baseProfile());
    await a.client.makeFamily();
    const b = device(async (url, init) => {
      const response = await server.fetch(url, init);
      const body = await response.json();
      body.profiles.push({ id: 'future-schema', rev: 2, updatedAt: 15, data: { schema: 2 } });
      return Response.json(body);
    }, 100);
    expect(await b.client.joinFamily(a.client.state.code!)).toBe(false);
    expect(b.client.state.code).toBe(a.client.state.code);
    expect(b.client.state.error).toContain('unreadable');
    expect(b.saves.get(ID)).toEqual(baseProfile());
    expect(b.saves.has('future-schema')).toBe(false);
  });

  it('keeps an oversized profile pending while sending the other profiles', async () => {
    const server = new FakeFamilyServer();
    const a = device(async (url, init) => String(url).endsWith('/oversized') && init?.method === 'PUT'
      ? Response.json({}, { status: 413 }) : server.fetch(url, init), 100);
    const profile = baseProfile();
    a.saves.set('oversized', { ...profile, profile: { ...profile.profile, id: 'oversized' } });
    a.saves.set(ID, profile);
    expect(await a.client.makeFamily()).toBe(false);
    expect(a.client.state.error).toContain('too large');
    expect(a.client.state.pending).toBe(1);
    const b = device(server.fetch, 100);
    expect(await b.client.joinFamily(a.client.state.code!)).toBe(true);
    expect(b.saves.get(ID)).toEqual(profile);
    expect(a.saves.has('oversized')).toBe(true);
  });

  it('dispatches a best-effort push with keepalive when hidden', async () => {
    const server = new FakeFamilyServer();
    const a = device(server.fetch, 100, baseProfile());
    await a.client.makeFamily();
    modify(a, p => { p.profile.name = 'Juniper'; });
    a.client.hide();
    expect(a.transport.requests.at(-1)?.method).toBe('PUT');
    expect(a.transport.requests.at(-1)?.keepalive).toBe(true);
  });
});

describe('mergeProfile', () => {
  it('prefers a tombstone at the same time and keeps a later edit', () => {
    const live: ProfileValue = { deleted: false, data: { ...baseProfile(), schema: 1, updatedAt: 100 } };
    const deleted: ProfileValue = { deleted: true, updatedAt: 100 };
    expect(mergeProfile(live, deleted)).toEqual(deleted);
    expect(mergeProfile(deleted, live)).toEqual(deleted);
    expect(mergeProfile({ ...deleted, updatedAt: 99 }, live)).toEqual(live);
  });

  it('keeps both completed cards when offline boards reused a generated ID', () => {
    const oldData = { ...baseProfile(), schema: 1 as const, updatedAt: 100 };
    const newData = { ...baseProfile(), schema: 1 as const, updatedAt: 101 };
    const a = oldData.workshop!.workshops.race!;
    const b = newData.workshop!.workshops.race!;
    const [first, second] = a.active;
    a.active = [];
    b.active = [];
    a.completed[first] = { build: a.model, payout: 1, wonAt: 100 };
    b.challenges[first] = { ...b.challenges[second], id: first };
    b.completed[first] = { build: b.model, payout: 2, wonAt: 101 };
    const aValue = { deleted: false, data: oldData } as const;
    const bValue = { deleted: false, data: newData } as const;
    const merged = mergeProfile(aValue, bValue);
    expect(merged.deleted).toBe(false);
    if (merged.deleted) throw new Error('Expected a live profile');
    const progress = merged.data.workshop!.workshops.race!;
    expect(Object.keys(progress.completed)).toHaveLength(2);
    expect(progress.challenges[first]).toEqual(b.challenges[first]);
    expect(mergeProfile(aValue, merged)).toEqual(merged);
  });
});
