import { afterEach, describe, expect, it, vi } from 'vitest';
import { engine } from '../apps/workshop/logic';
import { JbqProgressStore } from '../src/challenge/jbqProgress';
import { playerRacer } from '../src/core/racerProfiles';
import { loadSettings, savedSecondPlayer } from '../src/core/settings';
import { combineProfileRecords, deleteManagedProfile, mergeManagedProfiles, renameManagedProfile } from './profileManager';
import { listProfiles } from './profiles';
import { listenForProfileChanges, subscribeProfileReplacements } from './sync/changes';
import type { ProfileRecord } from './sync/record';
import { readLocalProfile } from './sync/storage';

function records() {
  const make = (id: string, name: string, createdAt: number, updatedAt: number): ProfileRecord => ({
    schema: 1, profile: { id, name, createdAt }, updatedAt, racer: {}, workshop: engine.newPlayerSave('medium'),
  });
  const target = make('p1', 'Ada', 1, 4);
  const source = make('p2', 'ADA', 2, 3);
  const race = engine.progressOf(target.workshop!, 'race');
  const [first, second] = race.active;
  const saved = { ...race, bought: ['wheels.mud'], wallet: 33 };
  saved.completed = { [first]: { build: race.model, wonAt: 4, payout: 2 } };
  target.workshop!.workshops.race = saved;
  const other = engine.progressOf(source.workshop!, 'race');
  // Two offline boards can reuse the same id for different cards.
  other.challenges[first] = { ...other.challenges[second], id: first };
  other.completed[first] = { build: other.model, wonAt: 3, payout: 8 };
  other.bought = ['gears.power'];
  other.buddies.unlocked.push('star');
  other.wallet = 10;
  source.workshop!.workshops.race = other;
  source.workshop!.workshops.dino = engine.progressOf(source.workshop!, 'dino');
  source.racer.progress = { worlds: ['underground'], items: ['motorTrike', 'firefly'], overrides: { farm: true } };
  target.racer.progress = { worlds: ['farm'], items: ['pickup'], overrides: { farm: false } };
  source.racer.jbq = { 1: 8, 2: 4 };
  target.racer.jbq = { 1: 3, 3: 6 };
  source.racer.settings = { difficulty: 'hard', roundSec: 300, questionTypes: { math: true, reading: false, jbq: false }, jbq: { points: 20, scope: 'all' } };
  target.racer.loadout = { car: 'pickup' };
  return { source, target };
}

afterEach(() => { listenForProfileChanges(); vi.unstubAllGlobals(); });

function installStorage(source: ProfileRecord, target: ProfileRecord) {
  const profiles = [target.profile, source.profile];
  const players = [
    { profile: source.profile.id, device: { type: 'keyboard', layout: 'left' }, car: 'motorTrike', guide: 'star' },
    { profile: target.profile.id, device: { type: 'gamepad', index: 2 }, car: 'pickup' },
  ];
  const values = new Map(Object.entries({
    'hub.profiles': profiles, 'hub.profileEditTimes.v1': { p1: target.updatedAt, p2: source.updatedAt },
    'hub.legacyIds': { oldAda: 'p2', other: 'p3' }, 'brainracer.legacyRemap.v1': true,
    'brainracer.racers.v1': { p1: target.racer.progress, p2: source.racer.progress },
    'brainracer.jbq.v1': { p1: target.racer.jbq, p2: source.racer.jbq },
    'brainracer.settings.v1': { players, racerProfiles: { p2: source.racer.settings }, map: 'farm' },
    'brainracer.secondPlayer.v1': { ...players[0], device: players[1].device },
    'brainracer.loadouts.v1': { p1: target.racer.loadout },
    'workshop.players.v1': { p1: target.workshop, p2: source.workshop },
    'workshop.device.v1': { adminMode: true },
  }).map(([key, value]) => [key, JSON.stringify(value)]));
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, raw: string) => { values.set(key, raw); }),
    removeItem: (key: string) => values.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
  return { values, storage, players };
}

describe('profile manager', () => {
  it('combines partial saves with the sync rules and keeps the selected identity', () => {
    const { source, target } = records();
    const combined = combineProfileRecords(source, target);
    expect(combined.profile).toEqual(target.profile);
    expect(combined.workshop!.workshops.dino).toEqual(source.workshop!.workshops.dino);
    const shop = combined.workshop!.workshops.race!;
    expect(shop.bought).toEqual(['gears.power', 'wheels.mud']);
    expect(shop.wallet).toBe(33);
    expect(shop.buddies.unlocked).toContain('star');
    expect(Object.values(shop.completed).map(win => win.payout).sort()).toEqual([2, 8]);
    expect(combined.racer).toMatchObject({
      progress: { worlds: expect.arrayContaining(['underground', 'farm']), items: ['motorTrike', 'firefly', 'pickup'], overrides: { farm: false } },
      jbq: { 1: 8, 2: 4, 3: 6 }, settings: source.racer.settings, loadout: target.racer.loadout,
    });
    expect(combineProfileRecords(source, combined)).toEqual(combined);
    const newerSource = combineProfileRecords({ ...source, updatedAt: 5 }, target);
    expect(newerSource.profile).toEqual(target.profile);
    expect(newerSource.workshop?.workshops.race?.wallet).toBe(10);
    expect(newerSource.racer.progress?.overrides).toEqual({ farm: true });
  });

  it('updates both games and all persistent references once, then queues target and tombstone', () => {
    const { source, target } = records();
    const { values, players } = installStorage(source, target);
    const changed = vi.fn();
    const replaced = vi.fn();
    listenForProfileChanges(changed);
    const unsubscribe = subscribeProfileReplacements(replaced);
    try {
      mergeManagedProfiles('p2', 'p1');
      const saved = readLocalProfile('p1');
      const combined = combineProfileRecords(source, target);
      expect(saved).toEqual({ profile: target.profile, racer: combined.racer, workshop: combined.workshop });
      expect(listProfiles()).toEqual([target.profile]);
      expect(loadSettings().players).toEqual(players.map(({ guide: _guide, ...p }) => ({ ...p, profile: 'p1', car: 'pickup' })));
      expect(savedSecondPlayer()).toEqual({ profile: 'p1', car: 'pickup', device: players[1].device });
      expect(JSON.parse(values.get('hub.legacyIds')!)).toEqual({ oldAda: 'p1', other: 'p3' });
      for (const key of ['brainracer.racers.v1', 'brainracer.jbq.v1', 'brainracer.loadouts.v1', 'workshop.players.v1']) {
        expect(JSON.parse(values.get(key)!)).not.toHaveProperty('p2');
      }
      expect(loadSettings().racerProfiles).toEqual({ p1: source.racer.settings });
      expect(values.get('workshop.device.v1')).toBe('{"adminMode":true}');
      const committed = new Map(values);
      mergeManagedProfiles('p2', 'p1');
      expect(values).toEqual(committed);
      expect(changed.mock.calls).toEqual([['p1', false], ['p2', true, 'p1']]);
      expect(replaced.mock.calls).toEqual([['p2', 'p1']]);
      expect(playerRacer({ profile: 'p2' }, 1)).toBe('p1');
      const jbq = new JbqProgressStore();
      jbq.recordCorrect('p2', 1);
      expect(jbq.count('p1', 1)).toBe(9);
      expect(JSON.parse(values.get('brainracer.jbq.v1')!)).not.toHaveProperty('p2');
    } finally { unsubscribe(); }
  });

  it('rolls back a failed final write and leaves both identities and game data intact', () => {
    const { source, target } = records();
    const { values, storage } = installStorage(source, target);
    const before = new Map(values);
    storage.setItem.mockImplementation((key, raw) => {
      if (key === 'hub.profiles') throw new DOMException('Quota', 'QuotaExceededError');
      values.set(key, raw);
    });
    const changed = vi.fn();
    listenForProfileChanges(changed);
    expect(() => mergeManagedProfiles('p2', 'p1')).toThrow('Check this device');
    expect(values).toEqual(before);
    expect(changed).not.toHaveBeenCalled();
  });

  it('renames and deletes the shared profile while retaining recoverable game saves', () => {
    const { source, target } = records();
    const { values } = installStorage(source, target);
    renameManagedProfile('p2', 'Ada Two');
    expect(listProfiles()[1].name).toBe('Ada Two');
    deleteManagedProfile('p2');
    expect(listProfiles()).toEqual([target.profile]);
    expect(loadSettings().players[0].profile).toBeUndefined();
    expect(savedSecondPlayer()?.profile).toBeUndefined();
    expect(JSON.parse(values.get('workshop.players.v1')!)).toHaveProperty('p2');
  });
});
