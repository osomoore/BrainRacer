import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProfile, deleteProfile, ensureProfiles, getProfile, legacyIdMap, listProfiles, renameProfile, validProfileName } from './profiles';
import { removeShared } from './storage';

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  for (const k of ['profiles', 'profileSeq', 'legacyIds']) removeShared(k);
});
afterEach(() => vi.unstubAllGlobals());

describe('profile names', () => {
  it('normalizes and validates', () => {
    expect(validProfileName('  Mia   Lou ')).toBe('Mia Lou');
    expect(validProfileName('Abcdefghijklmnop')).toBe('Abcdefghij');
    expect(validProfileName('Zoë')).toBe('Zoë');
    for (const bad of ['', '   ', 'R2D2', 'a-b', 12, undefined, null]) expect(validProfileName(bad)).toBeUndefined();
  });
});

describe('shared profiles', () => {
  it('lists in creation order with opaque generated ids', () => {
    expect(listProfiles()).toEqual([]);
    const a = createProfile('Robin')!, b = createProfile(' Sam ')!;
    expect([a.id, b.id]).toEqual(['p1', 'p2']);
    expect(listProfiles().map(p => p.name)).toEqual(['Robin', 'Sam']);
    expect(getProfile('p2')).toMatchObject({ id: 'p2', name: 'Sam' });
    expect(getProfile('p9')).toBeUndefined();
    expect(getProfile(undefined)).toBeUndefined();
    expect(JSON.parse(store.get('hub.profiles')!)).toHaveLength(2);
  });

  it('rejects invalid names on create and rename', () => {
    expect(createProfile('')).toBeNull();
    expect(createProfile('R2')).toBeNull();
    const a = createProfile('Robin')!;
    expect(renameProfile(a.id, '!!')).toBe(false);
    expect(renameProfile('nope', 'Kim')).toBe(false);
    expect(renameProfile(a.id, 'Kim')).toBe(true);
    expect(getProfile(a.id)!.name).toBe('Kim');
  });

  it('deletes, and never reuses an id', () => {
    const a = createProfile('Robin')!, b = createProfile('Sam')!;
    deleteProfile(b.id);
    deleteProfile('nope');
    expect(listProfiles().map(p => p.id)).toEqual([a.id]);
    expect(createProfile('Kim')!.id).toBe('p3');
    deleteProfile('p3'); deleteProfile(a.id);
    expect(createProfile('Lee')!.id).toBe('p4');
  });

  it('ensureProfiles on a fresh device writes an empty list once and creates nothing', () => {
    ensureProfiles();
    expect(store.get('hub.profiles')).toBe('[]');
    expect(listProfiles()).toEqual([]);
    expect(legacyIdMap()).toEqual({});
    // Brain Racer data appearing later must not trigger the migration: it already ran (as "nothing").
    store.set('brainracer.settings.v1', '{}');
    ensureProfiles();
    expect(listProfiles()).toEqual([]);
  });

  it('ensureProfiles keeps existing profiles', () => {
    createProfile('Robin');
    ensureProfiles();
    expect(listProfiles().map(p => p.name)).toEqual(['Robin']);
  });

  it('survives corrupt storage', () => {
    store.set('hub.profiles', '{nope');
    expect(listProfiles()).toEqual([]);
    store.set('hub.profiles', JSON.stringify([{ id: 1 }, { id: 'p1', name: 'Robin', createdAt: 5 }]));
    expect(listProfiles()).toEqual([{ id: 'p1', name: 'Robin', createdAt: 5 }]);
  });
});
