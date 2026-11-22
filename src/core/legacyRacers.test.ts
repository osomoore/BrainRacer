import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_FAMILY } from '../../shared/legacyProfiles';
import { ensureProfiles, listProfiles } from '../../shared/profiles';
import { removeShared } from '../../shared/storage';
import { BACKUP_KEY, legacyProgressFromSharedUnlocks, LEGACY_RACER_DEFAULTS, migrateLegacyRacers, remapProgress, remapSettings } from './legacyRacers';
import { loadAllProgress } from './racerProgress';
import { racerProfiles } from './racerProfiles';
import { loadSettings, savedSecondPlayer } from './settings';

const [ID1, ID2, ID3, ID4] = LEGACY_FAMILY.map(([id]) => id);
let store: Map<string, string>;
const get = (k: string) => JSON.parse(store.get(k)!);
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  for (const k of ['profiles', 'profileSeq', 'legacyIds']) removeShared(k);
});
afterEach(() => vi.unstubAllGlobals());

const progress = (worlds: string[], items: string[], overrides = {}) => ({ worlds, items, overrides });

describe('legacy Brain Racer data remap', () => {
  it('moves settings, per-racer settings, progress and the second player to the shared ids, losing nothing', () => {
    const custom = { difficulty: 'hard', questionTypes: { addition: true, multiplication: true, spelling: false }, roundSec: 240 };
    store.set('brainracer.settings.v1', JSON.stringify({
      map: 'farm', developerMode: false,
      players: [{ device: { type: 'keyboard', layout: 'left' }, difficulty: 'normal', car: 'kart', profile: ID2 }, { device: { type: 'keyboard', layout: 'right' }, difficulty: 'easy', car: 'dino', profile: 'u1' }],
      racerProfiles: { [ID1]: { name: 'Robin', difficulty: 'normal', questionTypes: { addition: true, multiplication: true, spelling: true }, roundSec: 420 }, u1: { name: 'Sam', ...custom } },
      customRacers: ['u1'],
    }));
    store.set('brainracer.secondPlayer.v1', JSON.stringify({ device: { type: 'keyboard', layout: 'right' }, difficulty: 'easy', car: 'dino', profile: 'u1' }));
    store.set('brainracer.racers.v1', JSON.stringify({
      [ID1]: progress(['industrial'], ['taxi'], { farm: true }), [ID2]: progress(['industrial', 'harbor'], ['owl']), [ID3]: progress([], []), [ID4]: progress([], []), u1: progress(['industrial'], ['rocket']),
    }));
    ensureProfiles();
    migrateLegacyRacers();

    const names = Object.fromEntries(listProfiles().map(p => [p.id, p.name]));
    expect(names).toMatchObject({ p1: 'Robin', p5: 'Sam' });
    const s = loadSettings();
    expect(s.map).toBe('farm');
    expect(s.players.map(p => p.profile)).toEqual(['p2', 'p5']);
    expect(savedSecondPlayer()!.profile).toBe('p5');
    expect((s as unknown as Record<string, unknown>).customRacers).toBeUndefined();
    const rp = racerProfiles(s);
    expect(rp.p1).toEqual({ difficulty: 'normal', questionTypes: { addition: true, multiplication: true, spelling: true }, roundSec: 420 });
    expect(rp.p5).toEqual(custom);
    expect(rp.p2).toEqual(LEGACY_RACER_DEFAULTS[ID2]);
    expect(rp.p3).toEqual(LEGACY_RACER_DEFAULTS[ID3]);
    expect(JSON.stringify(s)).not.toContain('"name"');
    const all = loadAllProgress();
    expect(all.p1).toEqual(progress(['industrial'], ['taxi'], { farm: true }));
    expect(all.p2).toEqual(progress(['industrial', 'harbor'], ['owl']));
    expect(all.p5).toEqual(progress(['industrial'], ['rocket']));
    expect(Object.keys(all).sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('keeps a raw backup of the old data before rewriting it', () => {
    const before = JSON.stringify({ [ID1]: progress(['industrial'], ['taxi']) });
    store.set('brainracer.racers.v1', before);
    ensureProfiles();
    migrateLegacyRacers();
    expect(get(BACKUP_KEY).keys['brainracer.racers.v1']).toBe(before);
    expect(Object.keys(get('brainracer.racers.v1'))).not.toContain(ID1);
  });

  it('runs once: later changes are not remapped again', () => {
    store.set('brainracer.racers.v1', JSON.stringify({ [ID1]: progress([], ['taxi']) }));
    ensureProfiles();
    migrateLegacyRacers();
    store.set('brainracer.racers.v1', JSON.stringify({ [ID1]: progress([], ['owl']) }));
    migrateLegacyRacers();
    expect(Object.keys(get('brainracer.racers.v1'))).toEqual([ID1]);
  });

  it('does nothing on a fresh device', () => {
    ensureProfiles();
    migrateLegacyRacers();
    expect([...store.keys()].sort()).toEqual(['hub.profiles']);
  });

  it('turns the old shared unlocks into progress for the first two racers, then remaps them', () => {
    store.set('brainracer.unlocks.v1', JSON.stringify(['taxi', 'comet']));
    store.set('brainracer.content.v1', JSON.stringify({ worlds: ['industrial'], overrides: { farm: true } }));
    ensureProfiles();
    migrateLegacyRacers();
    const all = loadAllProgress();
    const shared = progress(['industrial'], ['taxi', 'bombBuddy'], { farm: true });
    expect(all.p1).toEqual(shared);
    expect(all.p2).toEqual(shared);
    expect(all.p3).toEqual(progress([], []));
    expect(legacyProgressFromSharedUnlocks(undefined, undefined)[ID1]).toEqual(progress([], []));
  });

  it('keeps data of racers with no profile any more, and clears an unmapped player profile', () => {
    expect(remapProgress({ u9: progress([], ['taxi']), [ID1]: progress([], []) }, { [ID1]: 'p1' })).toEqual({ u9: progress([], ['taxi']), p1: progress([], []) });
    const s = remapSettings({ players: [{ profile: 'u9', car: 'dino' }] }, {});
    expect(s.players).toEqual([{ car: 'dino' }]);
  });
});
