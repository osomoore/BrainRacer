import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLocalProfile, hideLocalProfile, listLocalProfileIds, parseRacerSnapshot, readLocalProfile, rekeyLocalProfile } from './storage';
import { loadSettings, loadoutForProfile } from '../../src/core/settings';

let values: Map<string, string>;
let failKey: string | undefined;
beforeEach(() => {
  values = new Map();
  failKey = undefined;
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => { if (k === failKey) throw new Error('quota'); values.set(k, v); },
    removeItem: (k: string) => values.delete(k),
  });
  values.set('hub.profiles', JSON.stringify([{ id: 'p1', name: 'Robin', createdAt: 10 }]));
});
afterEach(() => vi.unstubAllGlobals());

describe('sync storage adapter', () => {
  it('rejects malformed Racer records and accepts an empty one', () => {
    expect(parseRacerSnapshot({})).toEqual({});
    expect(parseRacerSnapshot({ unexpected: true })).toBeUndefined();
    expect(parseRacerSnapshot({ jbq: { '4': 'bad' } })).toBeUndefined();
    expect(parseRacerSnapshot({ progress: { worlds: [], items: [], overrides: {}, extra: 1 } })).toBeUndefined();
    expect(parseRacerSnapshot({ progress: { worlds: ['not-a-world'], items: [], overrides: {} } })).toBeUndefined();
  });

  it('extracts and applies one profile without replacing another profile or device saves', () => {
    values.set('brainracer.racers.v1', JSON.stringify({ p1: { worlds: ['city'], items: [], overrides: {} }, p2: { worlds: [], items: [], overrides: {} } }));
    values.set('brainracer.jbq.v1', JSON.stringify({ p1: { '1': 3 }, p2: { '2': 1 } }));
    values.set('workshop.players.v1', JSON.stringify({ p1: { version: 2, reading: 'easy', workshops: {} }, p2: { marker: true } }));
    values.set('workshop.device.v1', '{"adminMode":true}');
    const snapshot = readLocalProfile('p1')!;
    expect(snapshot.racer.jbq).toEqual({ '1': 3 });
    expect(snapshot.workshop).toEqual({ version: 2, reading: 'easy', workshops: {} });
    applyLocalProfile({ ...snapshot, profile: { ...snapshot.profile, name: 'Rob' } });
    expect(JSON.parse(values.get('workshop.players.v1')!).p2).toEqual({ marker: true });
    expect(values.get('workshop.device.v1')).toBe('{"adminMode":true}');
    expect(JSON.parse(values.get('hub.profiles')!)[0].name).toBe('Rob');
  });

  it('syncs loadout without syncing device or slot choices', () => {
    const localSettings = {
      ...loadSettings(),
      players: [{ profile: 'p1', device: { type: 'keyboard', layout: 'left' }, difficulty: 'easy', car: 'kart' }],
    };
    values.set('brainracer.settings.v1', JSON.stringify(localSettings));
    values.set('brainracer.secondPlayer.v1', JSON.stringify({ profile: 'p1', device: { type: 'gamepad', index: 4 }, difficulty: 'easy', car: 'kart' }));
    const snapshot = readLocalProfile('p1')!;
    expect(snapshot.racer).not.toHaveProperty('playerSettings');
    expect(snapshot.racer.loadout).toMatchObject({ car: 'kart' });
    expect(snapshot.racer.loadout).not.toHaveProperty('device');
    applyLocalProfile({ ...snapshot, racer: { ...snapshot.racer, loadout: { car: 'ambulance', guide: 'star' } } });
    expect(JSON.parse(values.get('brainracer.settings.v1')!).players[0].device).toEqual({ type: 'keyboard', layout: 'left' });
    expect(JSON.parse(values.get('brainracer.secondPlayer.v1')!).device).toEqual({ type: 'gamepad', index: 4 });
    expect(loadSettings().players[0]).toMatchObject({ profile: 'p1', car: 'ambulance', guide: 'star', device: { type: 'keyboard', layout: 'left' } });
    expect(loadoutForProfile('p1')).toEqual({ car: 'ambulance', guide: 'star' });
  });

  it('rekeys identity and app data, while hiding leaves app saves untouched', () => {
    values.set('brainracer.racers.v1', JSON.stringify({ p1: { worlds: [], items: [], overrides: {} } }));
    values.set('workshop.players.v1', JSON.stringify({ p1: { version: 2, reading: 'easy', workshops: {} } }));
    rekeyLocalProfile('p1', 'p-new');
    expect(listLocalProfileIds()).toEqual(['p-new']);
    expect(JSON.parse(values.get('brainracer.racers.v1')!)).toHaveProperty('p-new');
    hideLocalProfile('p-new');
    expect(listLocalProfileIds()).toEqual([]);
    expect(JSON.parse(values.get('workshop.players.v1')!)).toHaveProperty('p-new');
  });

  it('does not change the visible identity when a rekey copy cannot be persisted', () => {
    values.set('brainracer.racers.v1', JSON.stringify({ p1: { worlds: [], items: [], overrides: {} } }));
    values.set('workshop.players.v1', JSON.stringify({ p1: { version: 2, reading: 'easy', workshops: {} } }));
    failKey = 'workshop.players.v1';
    expect(rekeyLocalProfile('p1', 'p-new')).toBe(false);
    expect(listLocalProfileIds()).toEqual(['p1']);
    expect(JSON.parse(values.get('brainracer.racers.v1')!)).toHaveProperty('p1');
    expect(JSON.parse(values.get('workshop.players.v1')!)).toHaveProperty('p1');
  });
});
