import { afterEach, describe, expect, it, vi } from 'vitest';
import { engine } from '../logic';
import { DEVICE_KEY, PLAYERS_KEY, SaveStore, type StorageLike } from './store';
import { createProfile, deleteProfile, listProfiles } from '../../../shared/profiles';
import { retireLocalProfile } from '../../../shared/profileManager';

function memStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
}

describe('SaveStore', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('round-trips a player save under workshop.players.v1', () => {
    const st = memStorage();
    const store = new SaveStore(st);
    const id = createProfile('Round Trip')!.id;
    expect(store.player(id)).toBeNull();
    store.setPlayer(id, engine.newPlayerSave('hard'));
    expect(JSON.parse(st.data.get(PLAYERS_KEY)!)[id].reading).toBe('hard');
    expect(new SaveStore(st).player(id)?.reading).toBe('hard');
    expect(store.hasPlayer('p2')).toBe(false);
  });
  it('device save defaults to Admin Mode off and persists', () => {
    const st = memStorage();
    const store = new SaveStore(st);
    expect(store.device()).toEqual({ version: 1, adminMode: false });
    store.setDevice({ version: 1, adminMode: true });
    expect(JSON.parse(st.data.get(DEVICE_KEY)!).adminMode).toBe(true);
    expect(new SaveStore(st).device().adminMode).toBe(true);
  });
  it('survives corrupt data and missing storage', () => {
    const st = memStorage();
    st.data.set(PLAYERS_KEY, '{not json');
    expect(new SaveStore(st).players()).toEqual({});
    const mem = new SaveStore(null);
    const id = createProfile('Memory Save')!.id;
    mem.setPlayer(id, engine.newPlayerSave('easy'));
    expect(mem.player(id)?.reading).toBe('easy');
  });
  it('survives a storage that throws', () => {
    const bad: StorageLike = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
    const store = new SaveStore(bad);
    store.setDevice({ version: 1, adminMode: true });
    expect(store.device().adminMode).toBe(true);
  });
  it('ignores a late write after the shared profile has been deleted', () => {
    const st = memStorage();
    const store = new SaveStore(st);
    const id = createProfile('Late Write')!.id;
    deleteProfile(id);
    store.setPlayer(id, engine.newPlayerSave('hard'));
    expect(st.data.has(PLAYERS_KEY)).toBe(false);
  });
  it('does not redirect a retired pane save over the merged target save', () => {
    const shared = memStorage();
    vi.stubGlobal('localStorage', shared);
    const st = memStorage();
    const store = new SaveStore(st);
    const source = createProfile('Old Player')!.id;
    const target = createProfile('Kept Player')!.id;
    shared.setItem('hub.profiles', JSON.stringify(listProfiles()));
    const combined = engine.newPlayerSave('hard');
    store.setPlayer(target, combined);
    expect(retireLocalProfile(source, target)).toBe(true);
    store.setPlayer(source, engine.newPlayerSave('easy'));
    expect(store.player(target)?.reading).toBe('hard');
    expect(store.player(source)).toBeNull();
  });
});
