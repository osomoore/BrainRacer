import { describe, expect, it } from 'vitest';
import { engine } from '../logic';
import { DEVICE_KEY, PLAYERS_KEY, SaveStore, type StorageLike } from './store';

function memStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
}

describe('SaveStore', () => {
  it('round-trips a player save under workshop.players.v1', () => {
    const st = memStorage();
    const store = new SaveStore(st);
    expect(store.player('p1')).toBeNull();
    store.setPlayer('p1', engine.newPlayerSave('hard'));
    expect(JSON.parse(st.data.get(PLAYERS_KEY)!).p1.reading).toBe('hard');
    expect(new SaveStore(st).player('p1')?.reading).toBe('hard');
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
    mem.setPlayer('p9', engine.newPlayerSave('easy'));
    expect(mem.player('p9')?.reading).toBe('easy');
  });
  it('survives a storage that throws', () => {
    const bad: StorageLike = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
    const store = new SaveStore(bad);
    store.setDevice({ version: 1, adminMode: true });
    expect(store.device().adminMode).toBe(true);
  });
});
