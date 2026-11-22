import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_FAMILY } from './legacyProfiles';
import { ensureProfiles, legacyIdMap, listProfiles } from './profiles';
import { removeShared } from './storage';

const [ID1, ID2, ID3, ID4] = LEGACY_FAMILY.map(([id]) => id);
const NAME = (i: number) => LEGACY_FAMILY[i][1];
let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  for (const k of ['profiles', 'profileSeq', 'legacyIds']) removeShared(k);
});
afterEach(() => vi.unstubAllGlobals());

describe('legacy profile migration', () => {
  it('a fresh device gets nothing', () => {
    ensureProfiles();
    expect(listProfiles()).toEqual([]);
    expect(legacyIdMap()).toEqual({});
  });

  it('a device with Brain Racer data gets the four built-in racers in order, with an id map', () => {
    store.set('brainracer.racers.v1', '{}');
    ensureProfiles();
    expect(listProfiles().map(p => p.name)).toEqual(LEGACY_FAMILY.map(([, name]) => name));
    expect(legacyIdMap()).toEqual({ [ID1]: 'p1', [ID2]: 'p2', [ID3]: 'p3', [ID4]: 'p4' });
  });

  it.each(['brainracer.settings.v1', 'brainracer.secondPlayer.v1', 'brainracer.unlocks.v1', 'brainracer.content.v1', 'brainracer.tuning.v1'])('detects %s', (key) => {
    store.set(key, '{}');
    ensureProfiles();
    expect(listProfiles()).toHaveLength(4);
  });

  it('keeps saved renames and then creates custom racers in their saved order', () => {
    store.set('brainracer.settings.v1', JSON.stringify({
      racerProfiles: { [ID2]: { name: 'Robin' }, u3: { name: 'Kim' }, u1: { name: 'Sam' }, u2: { name: '12' } },
      customRacers: ['u3', 'u1', 'u2', 'u3', 'bad'],
    }));
    ensureProfiles();
    expect(listProfiles().map(p => p.name)).toEqual([NAME(0), 'Robin', NAME(2), NAME(3), 'Kim', 'Sam']);
    expect(legacyIdMap()).toEqual({ [ID1]: 'p1', [ID2]: 'p2', [ID3]: 'p3', [ID4]: 'p4', u3: 'p5', u1: 'p6' });
  });

  it('runs only once', () => {
    store.set('brainracer.racers.v1', '{}');
    ensureProfiles();
    ensureProfiles();
    expect(listProfiles()).toHaveLength(4);
    store.set('hub.legacyIds', '{}');
    ensureProfiles();
    expect(listProfiles()).toHaveLength(4);
  });

  it('tolerates unreadable settings', () => {
    store.set('brainracer.settings.v1', '{broken');
    ensureProfiles();
    expect(listProfiles()).toHaveLength(4);
  });
});
